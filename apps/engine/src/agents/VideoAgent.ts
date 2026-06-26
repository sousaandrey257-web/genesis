import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import type {
  BriefAnalysis,
  CompetitorReport,
  DesignSystem,
  GeneratedFile,
} from '@genesis/shared';
import { askJSON } from '../llm';

// ─── Public contract ────────────────────────────────────────────────

export interface VideoScene {
  id: string;
  durationInFrames: number;
  heading: string;
  subtext: string;
  voiceover: string;
}

export interface VideoScript {
  title: string;
  totalSeconds: number;
  scenes: VideoScene[];
  cta: string;
}

export interface VideoResult {
  /** /tmp/genesis/<siteId>/videos — the Remotion project root. */
  path: string;
  files: string[];
  generatedFiles: GeneratedFile[];
  script: VideoScript;
  /** Intended mp4 output paths (produced by `npm run render:all`). */
  outputs: { landscape: string; portrait: string; square: string };
  /** true only if we actually rendered the mp4s during generation. */
  rendered: boolean;
  /** Human-readable status, DeployerAgent-style. */
  note: string;
}

export interface VideoInput {
  siteId: string;
  analysis: BriefAnalysis;
  design: DesignSystem;
  competitors: CompetitorReport;
  language?: { code: string; name: string };
}

const FPS = 30;
const TOTAL_FRAMES = 1800; // 60s @ 30fps

/** Brand tokens passed into the generated Remotion composition as props. */
interface Brand {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
  border: string;
  gradient: string;
  fontHeading: string;
  fontBody: string;
  radius: string;
  businessName: string;
}

interface VideoProps {
  title: string;
  totalSeconds: number;
  scenes: VideoScene[];
  cta: string;
  brand: Brand;
}

/**
 * Step 8 — generate a 60-second promo video project for the site.
 *
 * The engine NEVER imports remotion / ffmpeg / elevenlabs (none are installed).
 * Instead it (1) asks Claude to write a video SCRIPT, (2) emits a complete,
 * self-contained Remotion project as string files (remotion deps live in the
 * generated project's own package.json), (3) writes a render pipeline that does
 * the real work — ElevenLabs voiceover + ffmpeg mux — ONLY when those tools are
 * present, and (4) by default returns a dry-run result (`rendered:false`) since
 * a real render is far too slow to run inline. Like DeployerAgent, it degrades
 * gracefully and never throws on missing optional tooling.
 */
export async function runVideo(input: VideoInput): Promise<VideoResult> {
  const root = join('/tmp', 'genesis', input.siteId, 'videos');
  const lang = input.language ?? {
    code: input.analysis.location.locale,
    name: 'la langue locale du client',
  };

  // Step 1 — script (with deterministic fallback).
  const script = await generateScript(input, lang);

  // Step 2 — deterministic Remotion project files.
  const brand = buildBrand(input.design, input.analysis);
  const props: VideoProps = {
    title: script.title,
    totalSeconds: script.totalSeconds,
    scenes: script.scenes,
    cta: script.cta,
    brand,
  };
  const generatedFiles = buildProjectFiles(input.siteId, props);

  for (const f of generatedFiles) {
    const abs = join(root, f.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, f.content, 'utf8');
  }

  const outputs = {
    landscape: join(root, 'out', 'presentation-landscape.mp4'),
    portrait: join(root, 'out', 'presentation-portrait.mp4'),
    square: join(root, 'out', 'presentation-square.mp4'),
  };

  const elevenReady = Boolean(process.env.ELEVENLABS_API_KEY);
  const ffmpegReady = commandExists('ffmpeg');

  // Step 3 — optional inline render, strictly behind an env guard so generation
  // stays fast by default. Best-effort: needs deps installed; never throws.
  let rendered = false;
  if (process.env.GENESIS_VIDEO_RENDER === '1') {
    rendered = tryInlineRender(root, outputs);
  }

  const note = rendered
    ? `Vidéo rendue : 3 mp4 (paysage/portrait/carré) dans ${join(root, 'out')}.` +
      ` Voix off ElevenLabs ${elevenReady ? 'activée' : 'désactivée (ELEVENLABS_API_KEY absent)'},` +
      ` mux ffmpeg ${ffmpegReady ? 'disponible' : 'indisponible'}.`
    : `Projet Remotion généré (Landscape 1920x1080, Portrait 1080x1920, Square 1080x1080 — 60s @${FPS}fps),` +
      ` mais non rendu pendant la génération. Lance \`cd ${root} && npm install && npm run render:all\`` +
      ` pour produire les 3 mp4, ou \`node render.mjs\` pour le pipeline complet` +
      ` (ELEVENLABS_API_KEY ${elevenReady ? 'détecté → voix off' : 'absent → pas de voix off'} ;` +
      ` ffmpeg ${ffmpegReady ? 'trouvé → mux audio' : 'introuvable → pas de mux'}).` +
      ' Mets GENESIS_VIDEO_RENDER=1 pour tenter un rendu inline (deps requises).';

  return {
    path: root,
    files: generatedFiles.map((f) => f.path),
    generatedFiles,
    script,
    outputs,
    rendered,
    note,
  };
}

// ─── Step 1: script generation ──────────────────────────────────────

async function generateScript(
  input: VideoInput,
  lang: { code: string; name: string },
): Promise<VideoScript> {
  const { analysis, competitors } = input;

  const system = [
    'You are an award-winning creative director and scriptwriter for short, high-converting promo videos.',
    `Write a tight, energetic 60-second promo script for the business "${analysis.businessName}".`,
    `Every human-visible string (title, heading, subtext, voiceover, cta) MUST be written in ${lang.name} (${lang.code}).`,
    'The script drives an animated Remotion video, so keep headings punchy (max ~6 words) and subtext to one short sentence.',
    'Voiceover lines are spoken aloud — natural, persuasive, ~12-22 words each.',
  ].join('\n');

  const user = [
    'Produce a JSON object with EXACTLY this shape:',
    '{',
    '  "title": string,',
    '  "totalSeconds": 60,',
    '  "scenes": [ { "id": string, "durationInFrames": number, "heading": string, "subtext": string, "voiceover": string } ],',
    '  "cta": string',
    '}',
    '',
    `Use 5 to 6 scenes. durationInFrames are at ${FPS}fps and MUST sum to exactly ${TOTAL_FRAMES} (= 60s).`,
    'Scene arc: (1) intro on the business name, (2) the core value proposition,',
    '(3-5) two or three concrete strengths that beat the competition, (6) a final call to action.',
    '',
    `Business sector: ${analysis.sector}. Audience: ${analysis.audience}. Tone: ${analysis.tone}.`,
    `Value proposition: ${analysis.valueProposition}.`,
    `Key features: ${analysis.features.join(', ') || 'n/a'}.`,
    `How we beat competitors (positioning): ${competitors.positioning}.`,
    `Competitor weaknesses to exploit: ${competitors.topWeaknesses.join('; ') || 'n/a'}.`,
    `Differentiators to highlight: ${competitors.recommendedDifferentiators.join('; ') || 'n/a'}.`,
    'The final "cta" is also spoken at the end — keep it short and imperative.',
  ].join('\n');

  try {
    const raw = await askJSON<VideoScript>({
      system,
      user,
      maxTokens: 2000,
      label: 'video-script',
    });
    if (!raw || !Array.isArray(raw.scenes) || raw.scenes.length === 0) {
      return fallbackScript(input, lang);
    }
    return normalizeScript(raw);
  } catch {
    return fallbackScript(input, lang);
  }
}

/** Coerce a model script into valid shape with frames summing to TOTAL_FRAMES. */
function normalizeScript(raw: VideoScript): VideoScript {
  const scenes: VideoScene[] = raw.scenes.map((s, i) => ({
    id: typeof s.id === 'string' && s.id ? s.id : `scene-${i + 1}`,
    durationInFrames: Math.max(1, Math.round(Number(s.durationInFrames) || 0)),
    heading: String(s.heading ?? ''),
    subtext: String(s.subtext ?? ''),
    voiceover: String(s.voiceover ?? ''),
  }));

  const sum = scenes.reduce((a, s) => a + s.durationInFrames, 0);
  if (sum !== TOTAL_FRAMES) {
    const scale = TOTAL_FRAMES / sum;
    for (const s of scenes) s.durationInFrames = Math.max(1, Math.round(s.durationInFrames * scale));
    const drift = TOTAL_FRAMES - scenes.reduce((a, s) => a + s.durationInFrames, 0);
    const last = scenes[scenes.length - 1];
    last.durationInFrames = Math.max(1, last.durationInFrames + drift);
  }

  return {
    title: String(raw.title ?? 'Promo'),
    totalSeconds: 60,
    scenes,
    cta: String(raw.cta ?? ''),
  };
}

/** Deterministic, language-agnostic script used when the LLM call fails. */
function fallbackScript(
  input: VideoInput,
  _lang: { code: string; name: string },
): VideoScript {
  const { analysis, competitors } = input;
  const w = competitors.topWeaknesses;
  const diffs = competitors.recommendedDifferentiators;
  const strengthA = diffs[0] ?? competitors.positioning;
  const strengthB = diffs[1] ?? analysis.features[0] ?? analysis.valueProposition;
  const strengthC = w[0] ?? analysis.features[1] ?? competitors.positioning;

  const scenes: VideoScene[] = [
    {
      id: 'intro',
      durationInFrames: 300,
      heading: analysis.businessName,
      subtext: analysis.valueProposition,
      voiceover: `${analysis.businessName}. ${analysis.valueProposition}.`,
    },
    {
      id: 'value',
      durationInFrames: 300,
      heading: analysis.valueProposition,
      subtext: analysis.audience,
      voiceover: `${analysis.valueProposition} — ${analysis.sector}, ${analysis.audience}.`,
    },
    {
      id: 'strength-1',
      durationInFrames: 300,
      heading: strengthA,
      subtext: competitors.positioning,
      voiceover: `${strengthA}. ${competitors.positioning}.`,
    },
    {
      id: 'strength-2',
      durationInFrames: 300,
      heading: strengthB,
      subtext: analysis.features.slice(0, 3).join(' · '),
      voiceover: `${strengthB}.`,
    },
    {
      id: 'strength-3',
      durationInFrames: 300,
      heading: strengthC,
      subtext: w.slice(0, 2).join(' · '),
      voiceover: `${strengthC}.`,
    },
    {
      id: 'cta',
      durationInFrames: 300,
      heading: analysis.businessName,
      subtext: analysis.valueProposition,
      voiceover: `${analysis.businessName} — ${analysis.valueProposition}.`,
    },
  ];

  return {
    title: `${analysis.businessName} — ${analysis.sector}`,
    totalSeconds: 60,
    scenes,
    cta: analysis.businessName,
  };
}

// ─── Brand mapping ──────────────────────────────────────────────────

function buildBrand(d: DesignSystem, a: BriefAnalysis): Brand {
  return {
    background: d.palette.background,
    surface: d.palette.surface,
    primary: d.palette.primary,
    secondary: d.palette.secondary,
    accent: d.palette.accent,
    text: d.palette.text,
    muted: d.palette.muted,
    border: d.palette.border,
    gradient: d.gradient,
    fontHeading: d.fonts.heading,
    fontBody: d.fonts.body,
    radius: d.radius,
    businessName: a.businessName,
  };
}

// ─── Optional inline render (behind GENESIS_VIDEO_RENDER) ────────────

function commandExists(cmd: string): boolean {
  try {
    const probe = process.platform === 'win32' ? 'where' : 'which';
    return spawnSync(probe, [cmd], { stdio: 'ignore' }).status === 0;
  } catch {
    return false;
  }
}

/** Best-effort: only runs if deps are installed; returns true iff all mp4s exist. */
function tryInlineRender(
  root: string,
  outputs: VideoResult['outputs'],
): boolean {
  if (!existsSync(join(root, 'node_modules'))) return false;
  try {
    spawnSync('node', ['render.mjs'], { cwd: root, stdio: 'inherit', env: process.env });
  } catch {
    return false;
  }
  return [outputs.landscape, outputs.portrait, outputs.square].every((p) => existsSync(p));
}

// ─── Step 2: deterministic Remotion project ─────────────────────────

function buildProjectFiles(siteId: string, props: VideoProps): GeneratedFile[] {
  return [
    { path: 'package.json', content: pkgJson(siteId) },
    { path: 'remotion.config.ts', content: remotionConfig() },
    { path: 'tsconfig.json', content: tsConfig() },
    { path: 'props.json', content: JSON.stringify(props, null, 2) + '\n' },
    { path: 'src/index.ts', content: indexTs() },
    { path: 'src/Root.tsx', content: rootTsx() },
    { path: 'src/Video.tsx', content: videoTsx() },
    { path: 'src/data.ts', content: dataTs(props) },
    { path: 'public/audio/.gitkeep', content: '' },
    { path: 'README.md', content: readme(props.brand.businessName) },
    { path: 'render.mjs', content: renderMjs() },
  ];
}

function pkgJson(siteId: string): string {
  const name =
    'genesis-video-' +
    siteId.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
  const pkg = {
    name,
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      studio: 'remotion studio',
      'render:landscape':
        'remotion render src/index.ts Landscape out/presentation-landscape.mp4 --props=./props.json',
      'render:portrait':
        'remotion render src/index.ts Portrait out/presentation-portrait.mp4 --props=./props.json',
      'render:square':
        'remotion render src/index.ts Square out/presentation-square.mp4 --props=./props.json',
      'render:all':
        'npm run render:landscape && npm run render:portrait && npm run render:square',
    },
    dependencies: {
      remotion: '^4.0.0',
      '@remotion/cli': '^4.0.0',
      '@remotion/player': '^4.0.0',
      react: '^18.3.1',
      'react-dom': '^18.3.1',
    },
    devDependencies: {
      '@types/react': '^18.3.3',
      '@types/react-dom': '^18.3.0',
      typescript: '^5.5.3',
    },
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

function remotionConfig(): string {
  return [
    "import { Config } from '@remotion/cli/config';",
    '',
    "Config.setVideoImageFormat('jpeg');",
    'Config.setOverwriteOutput(true);',
    '',
  ].join('\n');
}

function tsConfig(): string {
  const cfg = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      lib: ['dom', 'dom.iterable', 'esnext'],
      noEmit: true,
    },
    include: ['src', 'render.mjs'],
  };
  return JSON.stringify(cfg, null, 2) + '\n';
}

function indexTs(): string {
  return [
    "import { registerRoot } from 'remotion';",
    "import { RemotionRoot } from './Root';",
    '',
    'registerRoot(RemotionRoot);',
    '',
  ].join('\n');
}

function rootTsx(): string {
  return [
    "import React from 'react';",
    "import { Composition } from 'remotion';",
    "import { Video } from './Video';",
    "import { defaultProps } from './data';",
    '',
    'export const RemotionRoot: React.FC = () => {',
    '  return (',
    '    <>',
    '      <Composition',
    '        id="Landscape"',
    '        component={Video}',
    '        durationInFrames={1800}',
    '        fps={30}',
    '        width={1920}',
    '        height={1080}',
    '        defaultProps={defaultProps}',
    '      />',
    '      <Composition',
    '        id="Portrait"',
    '        component={Video}',
    '        durationInFrames={1800}',
    '        fps={30}',
    '        width={1080}',
    '        height={1920}',
    '        defaultProps={defaultProps}',
    '      />',
    '      <Composition',
    '        id="Square"',
    '        component={Video}',
    '        durationInFrames={1800}',
    '        fps={30}',
    '        width={1080}',
    '        height={1080}',
    '        defaultProps={defaultProps}',
    '      />',
    '    </>',
    '  );',
    '};',
    '',
  ].join('\n');
}

/**
 * The creative core. One composition, parameterised so the SAME component
 * renders correctly at all three aspect ratios (sizing derives from
 * useVideoConfig). No backticks / template strings so it embeds cleanly here.
 */
function videoTsx(): string {
  return [
    "import React from 'react';",
    'import {',
    '  AbsoluteFill,',
    '  Sequence,',
    '  useCurrentFrame,',
    '  useVideoConfig,',
    '  interpolate,',
    '  spring,',
    "} from 'remotion';",
    "import type { VideoProps, VideoScene, Brand } from './data';",
    '',
    'function appearSpring(frame: number, fps: number): number {',
    '  return spring({ frame, fps, config: { damping: 200 } });',
    '}',
    '',
    'const BrowserMock: React.FC<{',
    '  brand: Brand;',
    '  base: number;',
    '  appear: number;',
    '  portrait: boolean;',
    '}> = ({ brand, base, appear, portrait }) => {',
    '  const w = base * (portrait ? 0.82 : 0.5);',
    '  const h = w * (portrait ? 1.1 : 0.62);',
    '  const dot = base * 0.014;',
    '  return (',
    '    <div',
    '      style={{',
    '        marginTop: base * 0.05,',
    '        width: w,',
    '        height: h,',
    '        borderRadius: brand.radius,',
    "        overflow: 'hidden',",
    "        border: '1px solid ' + brand.border,",
    '        background: brand.surface,',
    "        boxShadow: '0 30px 80px rgba(0,0,0,0.35)',",
    "        transform: 'scale(' + interpolate(appear, [0, 1], [0.92, 1]) + ')',",
    '      }}',
    '    >',
    '      <div',
    '        style={{',
    "          display: 'flex',",
    "          alignItems: 'center',",
    '          gap: base * 0.012,',
    '          padding: base * 0.016,',
    '          background: brand.background,',
    "          borderBottom: '1px solid ' + brand.border,",
    '        }}',
    '      >',
    "        <span style={{ width: dot, height: dot, borderRadius: '50%', background: brand.primary, display: 'inline-block' }} />",
    "        <span style={{ width: dot, height: dot, borderRadius: '50%', background: brand.secondary, display: 'inline-block' }} />",
    "        <span style={{ width: dot, height: dot, borderRadius: '50%', background: brand.accent, display: 'inline-block' }} />",
    '      </div>',
    '      <div style={{ padding: base * 0.03 }}>',
    "        <div style={{ width: '42%', height: base * 0.03, borderRadius: brand.radius, backgroundImage: brand.gradient, marginBottom: base * 0.02 }} />",
    "        <div style={{ width: '88%', height: base * 0.016, borderRadius: 6, background: brand.muted, opacity: 0.4, marginBottom: base * 0.012 }} />",
    "        <div style={{ width: '70%', height: base * 0.016, borderRadius: 6, background: brand.muted, opacity: 0.4, marginBottom: base * 0.025 }} />",
    "        <div style={{ display: 'flex', gap: base * 0.02 }}>",
    '          <div style={{ flex: 1, height: base * 0.08, borderRadius: brand.radius, background: brand.primary, opacity: 0.85 }} />',
    '          <div style={{ flex: 1, height: base * 0.08, borderRadius: brand.radius, background: brand.secondary, opacity: 0.85 }} />',
    '        </div>',
    '      </div>',
    '    </div>',
    '  );',
    '};',
    '',
    'const ProgressBar: React.FC<{ brand: Brand }> = ({ brand }) => {',
    '  const frame = useCurrentFrame();',
    '  const { durationInFrames, width } = useVideoConfig();',
    "  const w = interpolate(frame, [0, durationInFrames], [0, width], { extrapolateRight: 'clamp' });",
    '  return (',
    "    <AbsoluteFill style={{ justifyContent: 'flex-end' }}>",
    '      <div style={{ height: 6, width: w, backgroundImage: brand.gradient }} />',
    '    </AbsoluteFill>',
    '  );',
    '};',
    '',
    'const SceneView: React.FC<{',
    '  scene: VideoScene;',
    '  brand: Brand;',
    '  index: number;',
    '  total: number;',
    '  cta: string;',
    '}> = ({ scene, brand, index, total, cta }) => {',
    '  const frame = useCurrentFrame();',
    '  const { fps, width, height } = useVideoConfig();',
    '  const base = Math.min(width, height);',
    '  const portrait = height > width;',
    '  const isLast = index === total - 1;',
    '',
    '  const appear = appearSpring(frame, fps);',
    '  const enterY = interpolate(appear, [0, 1], [60, 0]);',
    '  const fade = interpolate(',
    '    frame,',
    '    [scene.durationInFrames - 15, scene.durationInFrames],',
    '    [1, 0],',
    "    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },",
    '  );',
    '',
    '  const headingSize = base * (portrait ? 0.085 : 0.062);',
    '  const subSize = base * (portrait ? 0.04 : 0.03);',
    '',
    '  return (',
    '    <AbsoluteFill',
    '      style={{',
    '        opacity: fade,',
    '        padding: base * 0.08,',
    "        justifyContent: 'center',",
    "        alignItems: portrait ? 'center' : 'flex-start',",
    "        textAlign: portrait ? 'center' : 'left',",
    '        fontFamily: brand.fontBody,',
    '      }}',
    '    >',
    "      <div style={{ transform: 'translateY(' + enterY + 'px)', opacity: appear, maxWidth: portrait ? '92%' : '60%' }}>",
    '        <div',
    '          style={{',
    "            display: 'inline-block',",
    '            fontSize: subSize * 0.62,',
    '            letterSpacing: 2,',
    "            textTransform: 'uppercase',",
    '            color: brand.accent,',
    '            marginBottom: base * 0.02,',
    '          }}',
    '        >',
    '          {brand.businessName}',
    '        </div>',
    '        <h1',
    '          style={{',
    '            fontFamily: brand.fontHeading,',
    '            fontSize: headingSize,',
    '            lineHeight: 1.05,',
    '            margin: 0,',
    '            color: brand.text,',
    '            fontWeight: 800,',
    '          }}',
    '        >',
    '          {scene.heading}',
    '        </h1>',
    '        <p style={{ fontSize: subSize, lineHeight: 1.4, marginTop: base * 0.03, color: brand.muted }}>',
    '          {scene.subtext}',
    '        </p>',
    '        {isLast ? (',
    '          <div',
    '            style={{',
    '              marginTop: base * 0.05,',
    "              display: 'inline-block',",
    "              padding: base * 0.026 + 'px ' + base * 0.05 + 'px',",
    '              borderRadius: brand.radius,',
    '              backgroundImage: brand.gradient,',
    "              color: '#ffffff',",
    '              fontSize: subSize,',
    '              fontWeight: 700,',
    '            }}',
    '          >',
    '            {cta}',
    '          </div>',
    '        ) : (',
    '          <BrowserMock brand={brand} base={base} appear={appear} portrait={portrait} />',
    '        )}',
    '      </div>',
    '    </AbsoluteFill>',
    '  );',
    '};',
    '',
    'export const Video: React.FC<VideoProps> = ({ scenes, cta, brand }) => {',
    '  let offset = 0;',
    '  const total = scenes.length;',
    '  return (',
    '    <AbsoluteFill style={{ background: brand.background }}>',
    '      <AbsoluteFill style={{ backgroundImage: brand.gradient, opacity: 0.12 }} />',
    '      {scenes.map((scene, i) => {',
    '        const from = offset;',
    '        offset += scene.durationInFrames;',
    '        return (',
    '          <Sequence key={scene.id} from={from} durationInFrames={scene.durationInFrames}>',
    '            <SceneView scene={scene} brand={brand} index={i} total={total} cta={cta} />',
    '          </Sequence>',
    '        );',
    '      })}',
    '      <ProgressBar brand={brand} />',
    '    </AbsoluteFill>',
    '  );',
    '};',
    '',
  ].join('\n');
}

function dataTs(props: VideoProps): string {
  return [
    '// Typed props shape for the GENESIS promo composition + baked-in default data.',
    'export interface Brand {',
    '  background: string;',
    '  surface: string;',
    '  primary: string;',
    '  secondary: string;',
    '  accent: string;',
    '  text: string;',
    '  muted: string;',
    '  border: string;',
    '  gradient: string;',
    '  fontHeading: string;',
    '  fontBody: string;',
    '  radius: string;',
    '  businessName: string;',
    '}',
    '',
    'export interface VideoScene {',
    '  id: string;',
    '  durationInFrames: number;',
    '  heading: string;',
    '  subtext: string;',
    '  voiceover: string;',
    '}',
    '',
    'export interface VideoProps {',
    '  title: string;',
    '  totalSeconds: number;',
    '  scenes: VideoScene[];',
    '  cta: string;',
    '  brand: Brand;',
    '}',
    '',
    'export const defaultProps: VideoProps = ' + JSON.stringify(props, null, 2) + ';',
    '',
  ].join('\n');
}

function readme(businessName: string): string {
  return [
    '# GENESIS — 60s Promo Video',
    '',
    'A self-contained [Remotion](https://www.remotion.dev) project that renders a',
    '60-second promo video for **' + businessName + '** in three aspect ratios.',
    '',
    '## Render',
    '',
    '```bash',
    'npm install',
    'npm run render:all      # landscape + portrait + square -> out/*.mp4',
    '```',
    '',
    'Outputs:',
    '- `out/presentation-landscape.mp4`  (1920x1080)',
    '- `out/presentation-portrait.mp4`   (1080x1920)',
    '- `out/presentation-square.mp4`     (1080x1080)',
    '',
    '## Preview in the studio',
    '',
    '```bash',
    'npm run studio',
    '```',
    '',
    '## Voiceover & music',
    '',
    'Run the full pipeline (AI voiceover + render + audio mux):',
    '',
    '```bash',
    'node render.mjs',
    '```',
    '',
    '- Set `ELEVENLABS_API_KEY` (and optionally `ELEVENLABS_VOICE_ID`) to synthesize',
    '  an AI voiceover from the script into `public/audio/voiceover.mp3`.',
    '- If `ffmpeg` is on your PATH, the voiceover is muxed into `out/*-vo.mp4`.',
    '- To bake audio directly into the composition instead, drop an mp3 at',
    '  `public/audio/voiceover.mp3` and add',
    '  `<Audio src={staticFile("audio/voiceover.mp3")} />` inside `src/Video.tsx`.',
    '- Background music: add another `<Audio/>` layer in `src/Video.tsx`.',
    '',
    'With no API key and no ffmpeg, the silent renders still work out of the box.',
    '',
  ].join('\n');
}

/**
 * Render pipeline. Pure guards, no throw: ElevenLabs voiceover only if the key
 * is set, ffmpeg mux only if the binary is on PATH. Written without backticks /
 * template strings so it embeds cleanly in this generator.
 */
function renderMjs(): string {
  return [
    '// GENESIS — promo video render pipeline. Degrades gracefully; never throws',
    '// just because an optional tool (ElevenLabs key / ffmpeg) is missing.',
    "import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
    "import { spawnSync } from 'node:child_process';",
    "import { join } from 'node:path';",
    "import process from 'node:process';",
    '',
    'const root = process.cwd();',
    "const outDir = join(root, 'out');",
    'mkdirSync(outDir, { recursive: true });',
    "mkdirSync(join(root, 'public', 'audio'), { recursive: true });",
    '',
    'function has(cmd) {',
    "  const probe = process.platform === 'win32' ? 'where' : 'which';",
    "  return spawnSync(probe, [cmd], { stdio: 'ignore' }).status === 0;",
    '}',
    '',
    'async function makeVoiceover() {',
    '  const key = process.env.ELEVENLABS_API_KEY;',
    '  if (!key) {',
    "    console.log('[genesis] ELEVENLABS_API_KEY not set - skipping AI voiceover.');",
    '    return null;',
    '  }',
    "  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';",
    "  const props = JSON.parse(readFileSync(join(root, 'props.json'), 'utf8'));",
    '  const lines = props.scenes.map(function (s) { return s.voiceover; });',
    '  lines.push(props.cta);',
    "  const text = lines.join(' ');",
    "  const url = 'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId;",
    "  console.log('[genesis] Requesting ElevenLabs voiceover...');",
    '  let res;',
    '  try {',
    '    res = await fetch(url, {',
    "      method: 'POST',",
    "      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },",
    "      body: JSON.stringify({ text: text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.4, similarity_boost: 0.7 } }),",
    '    });',
    '  } catch (err) {',
    "    console.log('[genesis] ElevenLabs request error - continuing without voiceover:', err && err.message ? err.message : err);",
    '    return null;',
    '  }',
    '  if (!res.ok) {',
    "    console.log('[genesis] ElevenLabs request failed (' + res.status + ') - continuing without voiceover.');",
    '    return null;',
    '  }',
    '  const buf = Buffer.from(await res.arrayBuffer());',
    "  const dest = join(root, 'public', 'audio', 'voiceover.mp3');",
    '  writeFileSync(dest, buf);',
    "  console.log('[genesis] Voiceover saved to ' + dest);",
    '  return dest;',
    '}',
    '',
    'function render(comp, file) {',
    "  console.log('[genesis] Rendering ' + comp + '...');",
    "  const r = spawnSync('npx', ['remotion', 'render', 'src/index.ts', comp, join('out', file), '--props=./props.json'], { stdio: 'inherit', cwd: root });",
    '  return r.status === 0 && existsSync(join(outDir, file));',
    '}',
    '',
    'function mux(silent, voice, withAudio) {',
    "  console.log('[genesis] Muxing audio into ' + withAudio + '...');",
    "  const r = spawnSync('ffmpeg', ['-y', '-i', join('out', silent), '-i', voice, '-c:v', 'copy', '-c:a', 'aac', '-shortest', join('out', withAudio)], { stdio: 'inherit', cwd: root });",
    '  return r.status === 0;',
    '}',
    '',
    'async function main() {',
    '  const voice = await makeVoiceover();',
    '  const targets = [',
    "    { comp: 'Landscape', file: 'presentation-landscape.mp4' },",
    "    { comp: 'Portrait', file: 'presentation-portrait.mp4' },",
    "    { comp: 'Square', file: 'presentation-square.mp4' },",
    '  ];',
    '  const ok = [];',
    '  for (const t of targets) {',
    '    if (render(t.comp, t.file)) ok.push(t.file);',
    '  }',
    '  if (voice && has(\'ffmpeg\')) {',
    '    for (const t of targets) {',
    '      if (existsSync(join(outDir, t.file))) {',
    "        mux(t.file, voice, t.file.replace('.mp4', '-vo.mp4'));",
    '      }',
    '    }',
    '  } else if (voice) {',
    "    console.log('[genesis] ffmpeg not on PATH - voiceover saved but not muxed.');",
    '  }',
    "  console.log('[genesis] Done. Rendered: ' + (ok.length ? ok.join(', ') : 'none'));",
    '}',
    '',
    'main().catch(function (e) {',
    "  console.error('[genesis] render pipeline error:', e && e.message ? e.message : e);",
    '  process.exitCode = 1;',
    '});',
    '',
  ].join('\n');
}
