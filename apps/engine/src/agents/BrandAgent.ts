import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import type { BriefAnalysis, DesignSystem, GeneratedFile } from '@genesis/shared';
import { streamCode } from '../llm';

// ─── Public contract ────────────────────────────────────────────────

export interface BrandResult {
  /** /tmp/genesis/<siteId>/brand */
  path: string;
  files: string[];
  generatedFiles: GeneratedFile[];
  /** Relative file paths of the four logo variants. */
  logos: { horizontal: string; square: string; icon: string; white: string };
  /** true only if the PDF/PNG render script actually ran. */
  rendered: boolean;
  /** Human-readable status, DeployerAgent-style. */
  note: string;
}

export interface BrandInput {
  siteId: string;
  analysis: BriefAnalysis;
  design: DesignSystem;
  language?: { code: string; name: string };
}

/**
 * Step — generate a complete visual identity (brand kit) for the client.
 *
 * The engine NEVER imports puppeteer / sharp (neither is installed). Instead it
 * (1) asks Claude to design ONE primary geometric logo mark as clean SVG (with a
 * deterministic geometric fallback so a logo ALWAYS exists), (2) derives every
 * logo variant, business card, kakemono and social asset deterministically as
 * REAL, complete SVG/HTML strings, and (3) emits a self-contained
 * `render-assets.mjs` that — ONLY IF puppeteer/sharp are present — turns the
 * print-ready HTML/SVG into PDFs and PNGs. By default it does NOT run that heavy
 * render (`rendered:false`); like DeployerAgent it degrades gracefully and never
 * throws on missing optional tooling.
 */
export async function runBrand(input: BrandInput): Promise<BrandResult> {
  const root = join('/tmp', 'genesis', input.siteId, 'brand');

  // Step 1 — primary logo mark (AI), with deterministic fallback.
  const mark = await generateMark(input);

  // Step 2 — deterministic brand kit.
  const ctx = buildContext(input, mark);
  const generatedFiles = buildBrandFiles(ctx);

  for (const f of generatedFiles) {
    const abs = join(root, f.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, f.content, 'utf8');
  }

  const logos = {
    horizontal: 'logo/logo-horizontal.svg',
    square: 'logo/logo-square.svg',
    icon: 'logo/logo-icon.svg',
    white: 'logo/logo-white.svg',
  };

  const puppeteerReady = existsSync(join(root, 'node_modules', 'puppeteer'));
  const sharpReady = existsSync(join(root, 'node_modules', 'sharp'));

  // Step 3 — optional inline render, strictly behind an env guard so generation
  // stays fast by default. Best-effort: needs deps installed; never throws.
  let rendered = false;
  if (process.env.GENESIS_BRAND_RENDER === '1') {
    rendered = tryInlineRender(root);
  }

  const note = rendered
    ? `Charte graphique rendue : charte-graphique.pdf + cartes de visite PDF et PNG (favicon/apple-touch/logos) dans ${root}.`
    : `Identité visuelle générée (logos SVG, charte graphique HTML, carte de visite 85x54mm, ` +
      `kakemono 80x200cm, pack réseaux sociaux) dans ${root}, mais non rasterisée pendant la génération. ` +
      `Lance \`cd ${root} && npm i puppeteer sharp && node render-assets.mjs\` pour produire ` +
      `la charte-graphique.pdf, les cartes de visite PDF et les PNG (favicon.ico/apple-touch-icon.png/logos 512-1024). ` +
      `puppeteer ${puppeteerReady ? 'détecté → PDF' : 'absent → pas de PDF'} ; ` +
      `sharp ${sharpReady ? 'détecté → PNG' : 'absent → pas de PNG'}. ` +
      `Les SVG et HTML sont complets et imprimables tels quels. Mets GENESIS_BRAND_RENDER=1 pour tenter un rendu inline.`;

  return {
    path: root,
    files: generatedFiles.map((f) => f.path),
    generatedFiles,
    logos,
    rendered,
    note,
  };
}

// ─── Step 1: primary logo mark (AI + deterministic fallback) ─────────

/** A reusable, coordinate-agnostic logo mark — embedded via nested <svg>. */
interface Mark {
  inner: string;
  viewBox: string;
}

async function generateMark(input: BrandInput): Promise<Mark> {
  const { analysis, design } = input;
  const ini = initials(analysis.businessName);
  const p = design.palette;

  const system = [
    'You are a senior brand designer.',
    'Output ONLY a single valid <svg>…</svg> element — no markdown, no commentary, no raster.',
    'The <svg> MUST declare viewBox="0 0 100 100" and contain a memorable, distinctive geometric mark only',
    '(NO wordmark / business name text — the wordmark is added separately).',
    'Use these exact brand colors and nothing else:',
    `  primary ${p.primary}, secondary ${p.secondary}, accent ${p.accent}, surface ${p.surface}.`,
    'Favor clean vector shapes (paths, polygons, circles), good negative space, and a balanced composition.',
  ].join('\n');

  const user = [
    `Design a logo mark for "${analysis.businessName}" (${analysis.sector}, tone: ${analysis.tone}).`,
    `It may subtly incorporate the monogram "${ini}" but stay primarily a geometric symbol.`,
    'Return the <svg> only, viewBox="0 0 100 100".',
  ].join('\n');

  try {
    const raw = await streamCode({ system, user, maxTokens: 1500, label: 'brand-logo' });
    return parseMark(stripFences(raw));
  } catch {
    return fallbackMark(input);
  }
}

/** Extract a coordinate-agnostic mark (inner content + viewBox) from an SVG. */
function parseMark(svg: string): Mark {
  const open = svg.match(/<svg\b[^>]*>/i);
  const close = svg.lastIndexOf('</svg>');
  if (!open || open.index === undefined || close === -1) {
    throw new Error('no <svg> in model output');
  }
  const inner = svg.slice(open.index + open[0].length, close).trim();
  if (!inner) throw new Error('empty mark');
  const vb = open[0].match(/viewBox\s*=\s*["']([^"']+)["']/i);
  return { inner, viewBox: vb ? vb[1].trim() : '0 0 100 100' };
}

/** Distinctive deterministic geometric mark used when the AI call fails. */
function fallbackMark(input: BrandInput): Mark {
  const p = input.design.palette;
  const ini = initials(input.analysis.businessName);
  const inner = [
    '<defs>',
    '<linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">',
    `<stop offset="0" stop-color="${p.primary}"/>`,
    `<stop offset="1" stop-color="${p.secondary}"/>`,
    '</linearGradient>',
    '</defs>',
    '<rect x="6" y="6" width="88" height="88" rx="24" fill="url(#brandGrad)"/>',
    `<path d="M50 18 L82 36 L82 64 L50 82 L18 64 L18 36 Z" fill="none" stroke="${p.accent}" stroke-width="3" opacity="0.55"/>`,
    `<circle cx="74" cy="26" r="9" fill="${p.accent}"/>`,
    `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="'Arial', sans-serif" font-size="38" font-weight="800" fill="${p.surface}">${esc(ini)}</text>`,
  ].join('');
  return { inner, viewBox: '0 0 100 100' };
}

// ─── Step 2: deterministic brand kit ────────────────────────────────

interface BrandContext {
  businessName: string;
  tagline: string;
  slogan: string;
  sector: string;
  ini: string;
  slug: string;
  website: string;
  email: string;
  location: string;
  features: string[];
  mark: Mark;
  bg: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
  border: string;
  cssGradient: string;
  fontHeading: string;
  fontBody: string;
  radius: string;
}

function buildContext(input: BrandInput, mark: Mark): BrandContext {
  const { analysis, design } = input;
  const p = design.palette;
  const slug = slugify(analysis.businessName);
  const location = [analysis.location.city, analysis.location.country]
    .filter(Boolean)
    .join(', ');
  return {
    businessName: analysis.businessName,
    tagline: analysis.valueProposition,
    slogan: analysis.valueProposition,
    sector: analysis.sector,
    ini: initials(analysis.businessName),
    slug,
    website: `www.${slug}.com`,
    email: `hello@${slug}.com`,
    location: location || (analysis.location.locale ?? ''),
    features: analysis.features.slice(0, 5),
    mark,
    bg: p.background,
    surface: p.surface,
    primary: p.primary,
    secondary: p.secondary,
    accent: p.accent,
    text: p.text,
    muted: p.muted,
    border: p.border,
    cssGradient: design.gradient,
    fontHeading: design.fonts.heading,
    fontBody: design.fonts.body,
    radius: design.radius,
  };
}

function buildBrandFiles(c: BrandContext): GeneratedFile[] {
  const horizontal = logoHorizontal(c);
  const white = logoWhite(c);
  const recto = cardRecto(c);
  const verso = cardVerso(c);
  return [
    { path: 'logo/logo-horizontal.svg', content: horizontal },
    { path: 'logo/logo-square.svg', content: logoSquare(c) },
    { path: 'logo/logo-icon.svg', content: logoIcon(c) },
    { path: 'logo/logo-white.svg', content: white },
    { path: 'logo/favicon.svg', content: favicon(c) },
    { path: 'charte-graphique.html', content: charteHtml(c, horizontal, white, recto, verso) },
    { path: 'carte-de-visite-recto.svg', content: recto },
    { path: 'carte-de-visite-verso.svg', content: verso },
    { path: 'carte-de-visite.html', content: cardHtml(c, recto, verso) },
    { path: 'kakemono.svg', content: kakemono(c) },
    { path: 'social/profile-picture.svg', content: socialProfile(c) },
    { path: 'social/facebook-banner.svg', content: socialFacebook(c) },
    { path: 'social/linkedin-banner.svg', content: socialLinkedin(c) },
    { path: 'social/instagram-story-template.svg', content: socialInstagram(c) },
    { path: 'render-assets.mjs', content: renderAssetsMjs() },
    { path: 'README.md', content: readmeMd(c) },
  ];
}

// ─── Logo variants ──────────────────────────────────────────────────

/** Embed a coordinate-agnostic mark into a known box via a nested <svg>. */
function placeMark(mark: Mark, x: number, y: number, w: number, h: number): string {
  return (
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${mark.viewBox}" ` +
    `preserveAspectRatio="xMidYMid meet">${mark.inner}</svg>`
  );
}

/** Force every fill/stroke/stop in a mark to a single colour (white version). */
function monochrome(inner: string, color: string): string {
  return inner
    .replace(/fill\s*=\s*"(?!none)[^"]*"/gi, `fill="${color}"`)
    .replace(/fill\s*=\s*'(?!none)[^']*'/gi, `fill="${color}"`)
    .replace(/stroke\s*=\s*"(?!none)[^"]*"/gi, `stroke="${color}"`)
    .replace(/stroke\s*=\s*'(?!none)[^']*'/gi, `stroke="${color}"`)
    .replace(/stop-color\s*=\s*"[^"]*"/gi, `stop-color="${color}"`)
    .replace(/stop-color\s*=\s*'[^']*'/gi, `stop-color="${color}"`);
}

function font(c: BrandContext, which: 'heading' | 'body'): string {
  const f = which === 'heading' ? c.fontHeading : c.fontBody;
  return `'${f}', system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
}

function logoHorizontal(c: BrandContext): string {
  const fs = 48;
  const wm = Math.ceil(c.businessName.length * fs * 0.6);
  const w = 132 + wm + 24;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="100" viewBox="0 0 ${w} 100" role="img" aria-label="${esc(c.businessName)}">`,
    placeMark(c.mark, 0, 0, 100, 100),
    `<text x="132" y="50" dominant-baseline="middle" font-family="${font(c, 'heading')}" font-size="${fs}" font-weight="700" fill="${c.text}">${esc(c.businessName)}</text>`,
    '</svg>',
  ].join('');
}

function logoSquare(c: BrandContext): string {
  const fs = 40;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260" role="img" aria-label="' +
      esc(c.businessName) +
      '">',
    placeMark(c.mark, 80, 20, 100, 100),
    `<text x="130" y="170" text-anchor="middle" font-family="${font(c, 'heading')}" font-size="${fs}" font-weight="700" fill="${c.text}">${esc(truncate(c.businessName, 18))}</text>`,
    `<text x="130" y="200" text-anchor="middle" font-family="${font(c, 'body')}" font-size="14" letter-spacing="1.5" fill="${c.muted}">${esc(truncate(c.tagline, 30).toUpperCase())}</text>`,
    '</svg>',
  ].join('');
}

function logoIcon(c: BrandContext): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" role="img" aria-label="' +
      esc(c.businessName) +
      ' icon">',
    c.mark.inner,
    '</svg>',
  ].join('');
}

function logoWhite(c: BrandContext): string {
  const fs = 48;
  const wm = Math.ceil(c.businessName.length * fs * 0.6);
  const w = 132 + wm + 24;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="100" viewBox="0 0 ${w} 100" role="img" aria-label="${esc(c.businessName)}">`,
    placeMark({ inner: monochrome(c.mark.inner, '#ffffff'), viewBox: c.mark.viewBox }, 0, 0, 100, 100),
    `<text x="132" y="50" dominant-baseline="middle" font-family="${font(c, 'heading')}" font-size="${fs}" font-weight="700" fill="#ffffff">${esc(c.businessName)}</text>`,
    '</svg>',
  ].join('');
}

function favicon(c: BrandContext): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="favicon">',
    '<defs><linearGradient id="fav" x1="0" y1="0" x2="1" y2="1">',
    `<stop offset="0" stop-color="${c.primary}"/><stop offset="1" stop-color="${c.secondary}"/>`,
    '</linearGradient></defs>',
    '<rect width="32" height="32" rx="7" fill="url(#fav)"/>',
    placeMark({ inner: monochrome(c.mark.inner, '#ffffff'), viewBox: c.mark.viewBox }, 5, 5, 22, 22),
    '</svg>',
    '<!-- favicon.ico and apple-touch-icon.png are produced from this file by render-assets.mjs (needs sharp). -->',
  ].join('');
}

// ─── Business card (85x54mm) ────────────────────────────────────────

function svgGradDef(id: string, c: BrandContext): string {
  return (
    `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${c.primary}"/><stop offset="1" stop-color="${c.secondary}"/>` +
    '</linearGradient>'
  );
}

function cardRecto(c: BrandContext): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="85mm" height="54mm" viewBox="0 0 85 54" role="img" aria-label="carte de visite recto">',
    `<defs>${svgGradDef('g', c)}</defs>`,
    `<rect width="85" height="54" fill="${c.surface}"/>`,
    '<rect width="4" height="54" fill="url(#g)"/>',
    placeMark(c.mark, 8, 7, 15, 15),
    `<text x="27" y="14" font-family="${font(c, 'heading')}" font-size="6" font-weight="700" fill="${c.text}">${esc(truncate(c.businessName, 22))}</text>`,
    `<text x="27" y="20" font-family="${font(c, 'body')}" font-size="2.6" fill="${c.muted}">${esc(truncate(c.tagline, 42))}</text>`,
    `<line x1="8" y1="33" x2="77" y2="33" stroke="${c.border}" stroke-width="0.25"/>`,
    `<text x="8" y="41" font-family="${font(c, 'body')}" font-size="2.8" fill="${c.text}">${esc(c.website)}</text>`,
    `<text x="8" y="46" font-family="${font(c, 'body')}" font-size="2.8" fill="${c.text}">${esc(c.email)}</text>`,
    c.location
      ? `<text x="8" y="51" font-family="${font(c, 'body')}" font-size="2.8" fill="${c.muted}">${esc(c.location)}</text>`
      : '',
    '</svg>',
  ].join('');
}

function cardVerso(c: BrandContext): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="85mm" height="54mm" viewBox="0 0 85 54" role="img" aria-label="carte de visite verso">',
    `<defs>${svgGradDef('g', c)}</defs>`,
    '<rect width="85" height="54" fill="url(#g)"/>',
    placeMark({ inner: monochrome(c.mark.inner, '#ffffff'), viewBox: c.mark.viewBox }, 34.5, 11, 16, 16),
    `<text x="42.5" y="38" text-anchor="middle" font-family="${font(c, 'heading')}" font-size="4" font-weight="600" fill="#ffffff">${esc(truncate(c.slogan, 38))}</text>`,
    '</svg>',
  ].join('');
}

function cardHtml(c: BrandContext, recto: string, verso: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(c.businessName)} — Carte de visite</title>
<style>
  @page { size: 85mm 54mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #e9e9ee; font-family: ${font(c, 'body')}; padding: 24px; }
  h1 { font-family: ${font(c, 'heading')}; font-size: 18px; margin-bottom: 16px; color: #1a1a1a; }
  .sheet { display: flex; flex-wrap: wrap; gap: 24px; }
  .card { width: 85mm; height: 54mm; box-shadow: 0 8px 24px rgba(0,0,0,.18); border-radius: 2mm; overflow: hidden; background: #fff; }
  .card svg { width: 85mm; height: 54mm; display: block; }
  .label { font-size: 11px; color: #555; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
  @media print {
    body { background: #fff; padding: 0; }
    h1, .label { display: none; }
    .sheet { gap: 0; }
    .card { box-shadow: none; border-radius: 0; page-break-after: always; }
  }
</style>
</head>
<body>
  <h1>${esc(c.businessName)} — Carte de visite 85×54mm</h1>
  <div class="sheet">
    <div>
      <div class="label">Recto</div>
      <div class="card">${recto}</div>
    </div>
    <div>
      <div class="label">Verso</div>
      <div class="card">${verso}</div>
    </div>
  </div>
</body>
</html>
`;
}

// ─── Kakemono / roll-up (80x200cm) ──────────────────────────────────

function kakemono(c: BrandContext): string {
  const headingLines = wrapText(c.tagline, 22);
  const headingSvg = headingLines
    .map(
      (l, i) =>
        `<tspan x="400" y="${940 + i * 96}">${esc(l)}</tspan>`,
    )
    .join('');
  const featureSvg = c.features
    .map(
      (feat, i) =>
        `<g transform="translate(150 ${1320 + i * 92})">` +
        `<circle cx="0" cy="-12" r="11" fill="${c.accent}"/>` +
        `<text x="34" y="0" font-family="${font(c, 'body')}" font-size="34" fill="${c.text}">${esc(truncate(feat, 36))}</text>` +
        '</g>',
    )
    .join('');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="800mm" height="2000mm" viewBox="0 0 800 2000" role="img" aria-label="kakemono ' +
      esc(c.businessName) +
      '">',
    `<defs>${svgGradDef('g', c)}</defs>`,
    `<rect width="800" height="2000" fill="${c.bg}"/>`,
    // Header band
    '<rect width="800" height="560" fill="url(#g)"/>',
    placeMark({ inner: monochrome(c.mark.inner, '#ffffff'), viewBox: c.mark.viewBox }, 310, 110, 180, 180),
    `<text x="400" y="380" text-anchor="middle" font-family="${font(c, 'heading')}" font-size="72" font-weight="800" fill="#ffffff">${esc(truncate(c.businessName, 22))}</text>`,
    `<text x="400" y="445" text-anchor="middle" font-family="${font(c, 'body')}" font-size="32" letter-spacing="3" fill="#ffffff" opacity="0.9">${esc(truncate(c.sector.toUpperCase(), 40))}</text>`,
    // Value proposition heading
    `<text text-anchor="middle" font-family="${font(c, 'heading')}" font-size="80" font-weight="800" fill="${c.primary}">${headingSvg}</text>`,
    // Features
    featureSvg,
    // CTA band
    '<rect x="0" y="1760" width="800" height="240" fill="url(#g)"/>',
    `<text x="400" y="1860" text-anchor="middle" font-family="${font(c, 'heading')}" font-size="48" font-weight="700" fill="#ffffff">${esc(c.website)}</text>`,
    c.email
      ? `<text x="400" y="1916" text-anchor="middle" font-family="${font(c, 'body')}" font-size="34" fill="#ffffff" opacity="0.9">${esc(c.email)}</text>`
      : '',
    '</svg>',
  ].join('');
}

// ─── Social pack ────────────────────────────────────────────────────

function socialProfile(c: BrandContext): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="' +
      esc(c.businessName) +
      ' profile">',
    `<defs>${svgGradDef('g', c)}</defs>`,
    '<rect width="400" height="400" fill="url(#g)"/>',
    placeMark({ inner: monochrome(c.mark.inner, '#ffffff'), viewBox: c.mark.viewBox }, 110, 78, 180, 180),
    `<text x="200" y="320" text-anchor="middle" font-family="${font(c, 'heading')}" font-size="40" font-weight="700" fill="#ffffff">${esc(truncate(c.businessName, 16))}</text>`,
    '</svg>',
  ].join('');
}

function socialFacebook(c: BrandContext): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="820" height="312" viewBox="0 0 820 312" role="img" aria-label="' +
      esc(c.businessName) +
      ' facebook banner">',
    `<defs>${svgGradDef('g', c)}</defs>`,
    '<rect width="820" height="312" fill="url(#g)"/>',
    placeMark({ inner: monochrome(c.mark.inner, '#ffffff'), viewBox: c.mark.viewBox }, 64, 86, 140, 140),
    `<text x="240" y="150" font-family="${font(c, 'heading')}" font-size="54" font-weight="800" fill="#ffffff">${esc(truncate(c.businessName, 22))}</text>`,
    `<text x="240" y="196" font-family="${font(c, 'body')}" font-size="24" fill="#ffffff" opacity="0.9">${esc(truncate(c.tagline, 48))}</text>`,
    '</svg>',
  ].join('');
}

function socialLinkedin(c: BrandContext): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1584" height="396" viewBox="0 0 1584 396" role="img" aria-label="' +
      esc(c.businessName) +
      ' linkedin banner">',
    `<defs>${svgGradDef('g', c)}</defs>`,
    '<rect width="1584" height="396" fill="url(#g)"/>',
    placeMark({ inner: monochrome(c.mark.inner, '#ffffff'), viewBox: c.mark.viewBox }, 120, 118, 160, 160),
    `<text x="330" y="180" font-family="${font(c, 'heading')}" font-size="66" font-weight="800" fill="#ffffff">${esc(truncate(c.businessName, 28))}</text>`,
    `<text x="330" y="236" font-family="${font(c, 'body')}" font-size="30" fill="#ffffff" opacity="0.9">${esc(truncate(c.tagline, 60))}</text>`,
    `<text x="330" y="296" font-family="${font(c, 'body')}" font-size="26" fill="#ffffff" opacity="0.8">${esc(c.website)}</text>`,
    '</svg>',
  ].join('');
}

function socialInstagram(c: BrandContext): string {
  const lines = wrapText(c.tagline, 16);
  const headingSvg = lines
    .map((l, i) => `<tspan x="540" y="${820 + i * 110}">${esc(l)}</tspan>`)
    .join('');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" role="img" aria-label="' +
      esc(c.businessName) +
      ' instagram story">',
    `<defs>${svgGradDef('g', c)}</defs>`,
    '<rect width="1080" height="1920" fill="url(#g)"/>',
    placeMark({ inner: monochrome(c.mark.inner, '#ffffff'), viewBox: c.mark.viewBox }, 440, 260, 200, 200),
    `<text x="540" y="560" text-anchor="middle" font-family="${font(c, 'heading')}" font-size="56" font-weight="700" fill="#ffffff" opacity="0.92">${esc(truncate(c.businessName, 22))}</text>`,
    `<text text-anchor="middle" font-family="${font(c, 'heading')}" font-size="84" font-weight="800" fill="#ffffff">${headingSvg}</text>`,
    `<text x="540" y="1780" text-anchor="middle" font-family="${font(c, 'body')}" font-size="38" fill="#ffffff" opacity="0.9">${esc(c.website)}</text>`,
    '</svg>',
  ].join('');
}

// ─── Charte graphique (print-ready HTML brand guide) ────────────────

function charteHtml(
  c: BrandContext,
  logoHorizontalSvg: string,
  logoWhiteSvg: string,
  recto: string,
  verso: string,
): string {
  const swatches: Array<{ label: string; hex: string }> = [
    { label: 'Primary', hex: c.primary },
    { label: 'Secondary', hex: c.secondary },
    { label: 'Accent', hex: c.accent },
    { label: 'Background', hex: c.bg },
    { label: 'Surface', hex: c.surface },
    { label: 'Text', hex: c.text },
    { label: 'Muted', hex: c.muted },
    { label: 'Border', hex: c.border },
  ];

  const swatchCards = swatches
    .map((s) => {
      const rgb = hexToRgb(s.hex);
      const rgbStr = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '—';
      const cmykStr = rgb ? rgbToCmyk(rgb) : '—';
      const light = rgb ? isLight(rgb) : false;
      const labelColor = light ? '#111' : '#fff';
      return `<div class="swatch">
        <div class="chip" style="background:${esc(s.hex)};color:${labelColor}">
          <span>${esc(s.label)}</span>
        </div>
        <div class="meta">
          <div><b>HEX</b> ${esc(s.hex.toUpperCase())}</div>
          <div><b>RGB</b> ${esc(rgbStr)}</div>
          <div><b>CMYK</b> ${esc(cmykStr)}</div>
        </div>
      </div>`;
    })
    .join('\n');

  const featureItems = c.features.length
    ? c.features.map((f) => `<li>${esc(f)}</li>`).join('')
    : `<li>${esc(c.tagline)}</li>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(c.businessName)} — Charte graphique</title>
<style>
  @page { size: A4; margin: 0; }
  :root {
    --bg: ${c.bg}; --surface: ${c.surface}; --primary: ${c.primary};
    --secondary: ${c.secondary}; --accent: ${c.accent}; --text: ${c.text};
    --muted: ${c.muted}; --border: ${c.border}; --radius: ${c.radius};
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${font(c, 'body')}; color: var(--text); background: #fff; }
  h1, h2, h3 { font-family: ${font(c, 'heading')}; }
  .page {
    width: 210mm; min-height: 297mm; padding: 22mm 20mm; margin: 0 auto;
    background: #fff; position: relative; page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  .section-title { font-size: 12pt; letter-spacing: 3px; text-transform: uppercase; color: var(--primary); margin-bottom: 6mm; }
  .section-title::after { content: ""; display: block; width: 24mm; height: 3px; background: ${c.cssGradient}; margin-top: 3mm; }
  p.lead { color: var(--muted); font-size: 11pt; line-height: 1.6; max-width: 150mm; }

  /* Cover */
  .cover { background: ${c.cssGradient}; color: #fff; display: flex; flex-direction: column; justify-content: center; }
  .cover .brandmark { width: 120mm; max-width: 100%; margin-bottom: 14mm; }
  .cover .brandmark svg { width: 100%; height: auto; }
  .cover h1 { font-size: 30pt; margin-bottom: 4mm; }
  .cover .sub { font-size: 13pt; opacity: .92; letter-spacing: 1px; }
  .cover .foot { position: absolute; bottom: 22mm; left: 20mm; right: 20mm; font-size: 10pt; opacity: .85; display: flex; justify-content: space-between; }

  /* Palette */
  .swatches { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm; }
  .swatch { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .swatch .chip { height: 34mm; display: flex; align-items: flex-end; padding: 5mm; font-family: ${font(c, 'heading')}; font-weight: 700; font-size: 13pt; }
  .swatch .meta { padding: 5mm; font-size: 9.5pt; line-height: 1.7; color: var(--text); }
  .swatch .meta b { color: var(--muted); font-weight: 600; margin-right: 4px; }

  /* Typography */
  .type-block { border: 1px solid var(--border); border-radius: var(--radius); padding: 8mm; margin-bottom: 8mm; }
  .type-block .name { font-size: 10pt; color: var(--muted); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4mm; }
  .type-heading { font-family: ${font(c, 'heading')}; font-size: 30pt; color: var(--text); line-height: 1.1; }
  .type-body { font-family: ${font(c, 'body')}; font-size: 12pt; color: var(--text); line-height: 1.6; }
  .alphabet { color: var(--muted); font-size: 12pt; margin-top: 4mm; word-break: break-all; }

  /* Logo usage */
  .usage-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .usage-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 8mm; display: flex; align-items: center; justify-content: center; min-height: 45mm; }
  .usage-card.dark { background: var(--text); }
  .usage-card svg { max-width: 100%; height: auto; }
  .rules { margin-top: 8mm; columns: 2; column-gap: 10mm; font-size: 10.5pt; line-height: 1.7; color: var(--text); }
  .rules li { margin-bottom: 3mm; }

  /* Applications */
  .apps { display: flex; flex-direction: column; gap: 10mm; }
  .cards { display: flex; gap: 8mm; flex-wrap: wrap; }
  .cards .biz { width: 85mm; height: 54mm; box-shadow: 0 6px 18px rgba(0,0,0,.15); border-radius: 2mm; overflow: hidden; }
  .cards .biz svg { width: 85mm; height: 54mm; display: block; }
  .letterhead { border: 1px solid var(--border); border-radius: var(--radius); padding: 12mm; }
  .letterhead .lh-top { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid var(--primary); padding-bottom: 6mm; }
  .letterhead .lh-top .lh-logo { width: 70mm; }
  .letterhead .lh-top .lh-logo svg { width: 100%; height: auto; }
  .letterhead .lh-contact { text-align: right; font-size: 9pt; color: var(--muted); line-height: 1.6; }
  .letterhead .lh-body { margin-top: 8mm; }
  .letterhead .lh-line { height: 3mm; background: var(--border); border-radius: 2mm; margin-bottom: 5mm; }
  .letterhead .lh-line.short { width: 55%; }

  /* Do / Don't */
  .donts { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .dont { border: 1px solid var(--border); border-radius: var(--radius); padding: 7mm; }
  .dont .tag { display: inline-block; background: #c0392b; color: #fff; font-size: 9pt; font-weight: 700; padding: 1mm 3mm; border-radius: 3mm; letter-spacing: 1px; margin-bottom: 4mm; }
  .dont p { font-size: 10.5pt; color: var(--text); line-height: 1.5; }

  @media print { body { background: #fff; } .page { margin: 0; } }
</style>
</head>
<body>

  <!-- Cover -->
  <section class="page cover">
    <div class="brandmark">${logoWhiteSvg}</div>
    <h1>Charte graphique</h1>
    <div class="sub">${esc(c.businessName)} — ${esc(c.sector)}</div>
    <div class="foot">
      <span>Identité visuelle</span>
      <span>${esc(c.website)}</span>
    </div>
  </section>

  <!-- Palette -->
  <section class="page">
    <h2 class="section-title">Palette de couleurs</h2>
    <p class="lead">Les couleurs de la marque, déclinées en HEX (écran), RGB (web) et CMYK (impression). Respectez ces valeurs sur tous les supports.</p>
    <div style="height:8mm"></div>
    <div class="swatches">
      ${swatchCards}
    </div>
  </section>

  <!-- Typography -->
  <section class="page">
    <h2 class="section-title">Typographie</h2>
    <p class="lead">Deux familles structurent la communication : une police de titrage forte et une police de texte lisible.</p>
    <div style="height:8mm"></div>
    <div class="type-block">
      <div class="name">Titres — ${esc(c.fontHeading)}</div>
      <div class="type-heading">${esc(c.businessName)}</div>
      <div class="alphabet" style="font-family:${font(c, 'heading')}">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</div>
    </div>
    <div class="type-block">
      <div class="name">Texte courant — ${esc(c.fontBody)}</div>
      <div class="type-body">${esc(c.tagline)}</div>
      <div class="alphabet" style="font-family:${font(c, 'body')}">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</div>
    </div>
  </section>

  <!-- Logo usage -->
  <section class="page">
    <h2 class="section-title">Le logo</h2>
    <p class="lead">Le logo se décline en version principale, monochrome blanche (fonds sombres) et icône. Préservez toujours une zone de protection autour du mark.</p>
    <div style="height:8mm"></div>
    <div class="usage-grid">
      <div class="usage-card">${logoHorizontalSvg}</div>
      <div class="usage-card dark">${logoWhiteSvg}</div>
    </div>
    <ul class="rules">
      <li>Conservez une marge de respiration égale à la hauteur du mark.</li>
      <li>Sur fond sombre, utilisez exclusivement la version blanche.</li>
      <li>N'altérez jamais les couleurs, proportions ou l'orientation.</li>
      <li>Taille minimale conseillée : 24&nbsp;px de hauteur pour l'icône.</li>
    </ul>
  </section>

  <!-- Applications -->
  <section class="page">
    <h2 class="section-title">Applications</h2>
    <p class="lead">Exemples d'application de l'identité sur les supports imprimés.</p>
    <div style="height:8mm"></div>
    <div class="apps">
      <div>
        <div class="name" style="font-size:10pt;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:4mm">Carte de visite</div>
        <div class="cards">
          <div class="biz">${recto}</div>
          <div class="biz">${verso}</div>
        </div>
      </div>
      <div class="letterhead">
        <div class="lh-top">
          <div class="lh-logo">${logoHorizontalSvg}</div>
          <div class="lh-contact">
            ${esc(c.website)}<br/>${esc(c.email)}${c.location ? '<br/>' + esc(c.location) : ''}
          </div>
        </div>
        <div class="lh-body">
          <ul style="list-style:none;font-size:10.5pt;color:var(--text);line-height:1.8">${featureItems}</ul>
          <div style="height:6mm"></div>
          <div class="lh-line"></div>
          <div class="lh-line"></div>
          <div class="lh-line short"></div>
        </div>
      </div>
    </div>
  </section>

  <!-- Do not -->
  <section class="page">
    <h2 class="section-title">À ne pas faire</h2>
    <p class="lead">Pour préserver la cohérence de la marque, évitez ces usages.</p>
    <div style="height:8mm"></div>
    <div class="donts">
      <div class="dont"><span class="tag">NON</span><p>Ne déformez pas le logo (étirement horizontal ou vertical).</p></div>
      <div class="dont"><span class="tag">NON</span><p>Ne remplacez pas les couleurs de la marque par d'autres teintes.</p></div>
      <div class="dont"><span class="tag">NON</span><p>Ne placez pas le logo couleur sur un fond qui nuit à sa lisibilité.</p></div>
      <div class="dont"><span class="tag">NON</span><p>Ne recréez pas le logo avec une autre police que ${esc(c.fontHeading)}.</p></div>
    </div>
  </section>

</body>
</html>
`;
}

// ─── render-assets.mjs (guarded, never imported by the engine) ──────

function renderAssetsMjs(): string {
  return [
    '// GENESIS — brand asset renderer. Converts the print-ready HTML/SVG sources',
    '// into PDFs and PNGs, but ONLY if puppeteer / sharp are installed. Each step',
    '// is guarded and best-effort: a missing optional dependency never throws.',
    "import { existsSync, readFileSync, mkdirSync } from 'node:fs';",
    "import { join, dirname } from 'node:path';",
    "import process from 'node:process';",
    '',
    'const root = process.cwd();',
    'const produced = [];',
    '',
    'function read(rel) {',
    "  return readFileSync(join(root, rel), 'utf8');",
    '}',
    '',
    'async function load(name) {',
    '  try {',
    '    const m = await import(name);',
    '    return m.default || m;',
    '  } catch {',
    '    return null;',
    '  }',
    '}',
    '',
    'async function htmlToPdf(browser, htmlRel, pdfRel, opts) {',
    '  if (!existsSync(join(root, htmlRel))) return;',
    '  try {',
    '    const page = await browser.newPage();',
    "    await page.setContent(read(htmlRel), { waitUntil: 'networkidle0' });",
    '    const out = join(root, pdfRel);',
    '    mkdirSync(dirname(out), { recursive: true });',
    '    await page.pdf(Object.assign({ path: out, printBackground: true }, opts || {}));',
    '    await page.close();',
    '    produced.push(pdfRel);',
    '  } catch (e) {',
    "    console.log('[brand] skip ' + pdfRel + ': ' + (e && e.message ? e.message : e));",
    '  }',
    '}',
    '',
    'async function svgToPdf(browser, svgRel, pdfRel, widthMm, heightMm) {',
    '  if (!existsSync(join(root, svgRel))) return;',
    '  try {',
    '    const svg = read(svgRel);',
    "    const wrap = '<!doctype html><html><head><style>*{margin:0;padding:0}html,body{width:' +",
    "      widthMm + 'mm;height:' + heightMm + 'mm}svg{width:' + widthMm + 'mm;height:' + heightMm +",
    "      'mm;display:block}</style></head><body>' + svg + '</body></html>';",
    '    const page = await browser.newPage();',
    "    await page.setContent(wrap, { waitUntil: 'networkidle0' });",
    '    const out = join(root, pdfRel);',
    "    await page.pdf({ path: out, printBackground: true, width: widthMm + 'mm', height: heightMm + 'mm' });",
    '    await page.close();',
    '    produced.push(pdfRel);',
    '  } catch (e) {',
    "    console.log('[brand] skip ' + pdfRel + ': ' + (e && e.message ? e.message : e));",
    '  }',
    '}',
    '',
    'async function svgToPng(sharp, svgRel, pngRel, size) {',
    '  if (!existsSync(join(root, svgRel))) return;',
    '  try {',
    '    const buf = readFileSync(join(root, svgRel));',
    '    const out = join(root, pngRel);',
    '    mkdirSync(dirname(out), { recursive: true });',
    '    await sharp(buf, { density: 384 })',
    "      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })",
    '      .png()',
    '      .toFile(out);',
    '    produced.push(pngRel);',
    '  } catch (e) {',
    "    console.log('[brand] skip ' + pngRel + ': ' + (e && e.message ? e.message : e));",
    '  }',
    '}',
    '',
    'async function main() {',
    "  const puppeteer = await load('puppeteer');",
    '  if (puppeteer) {',
    '    let browser = null;',
    '    try {',
    "      browser = await puppeteer.launch({ args: ['--no-sandbox'] });",
    "      await htmlToPdf(browser, 'charte-graphique.html', 'charte-graphique.pdf', { format: 'A4' });",
    "      await htmlToPdf(browser, 'carte-de-visite.html', 'carte-de-visite.pdf', { width: '85mm', height: '54mm' });",
    "      await svgToPdf(browser, 'carte-de-visite-recto.svg', 'carte-de-visite-recto.pdf', 85, 54);",
    "      await svgToPdf(browser, 'carte-de-visite-verso.svg', 'carte-de-visite-verso.pdf', 85, 54);",
    '    } catch (e) {',
    "      console.log('[brand] puppeteer error: ' + (e && e.message ? e.message : e));",
    '    } finally {',
    '      if (browser) {',
    '        try {',
    '          await browser.close();',
    '        } catch {',
    '          /* ignore */',
    '        }',
    '      }',
    '    }',
    '  } else {',
    '    console.log(\'[brand] puppeteer not installed — run "npm i puppeteer" to get the PDFs.\');',
    '  }',
    '',
    "  const sharp = await load('sharp');",
    '  if (sharp) {',
    "    await svgToPng(sharp, 'logo/favicon.svg', 'favicon-32.png', 32);",
    "    await svgToPng(sharp, 'logo/favicon.svg', 'favicon.ico', 32);",
    "    await svgToPng(sharp, 'logo/logo-icon.svg', 'apple-touch-icon.png', 180);",
    "    await svgToPng(sharp, 'logo/logo-square.svg', 'logo/logo-square-512.png', 512);",
    "    await svgToPng(sharp, 'logo/logo-square.svg', 'logo/logo-square-1024.png', 1024);",
    "    await svgToPng(sharp, 'logo/logo-icon.svg', 'logo/logo-icon-512.png', 512);",
    '  } else {',
    '    console.log(\'[brand] sharp not installed — run "npm i sharp" to get the PNG/ICO assets.\');',
    '  }',
    '',
    '  console.log(',
    '    produced.length',
    "      ? '[brand] produced: ' + produced.join(', ')",
    "      : '[brand] nothing produced (install puppeteer and/or sharp).',",
    '  );',
    '}',
    '',
    'main().catch(function (e) {',
    "  console.error('[brand] renderer error:', e && e.message ? e.message : e);",
    '});',
    '',
  ].join('\n');
}

function readmeMd(c: BrandContext): string {
  return [
    '# ' + c.businessName + ' — Identité visuelle (GENESIS)',
    '',
    'Kit de marque complet, prêt à l\'emploi : logos, charte graphique, carte de visite,',
    'kakemono et pack réseaux sociaux. Tous les fichiers SVG et HTML sont **réels et',
    'imprimables tels quels** — aucun placeholder.',
    '',
    '## Contenu',
    '',
    '- `logo/` — `logo-horizontal.svg`, `logo-square.svg`, `logo-icon.svg`, `logo-white.svg`, `favicon.svg`',
    '- `charte-graphique.html` — la charte graphique imprimable (source du PDF, format A4)',
    '- `carte-de-visite-recto.svg` / `carte-de-visite-verso.svg` — carte 85×54mm',
    '- `carte-de-visite.html` — recto + verso prêts à imprimer',
    '- `kakemono.svg` — roll-up 80×200cm grand format',
    '- `social/` — `profile-picture.svg` (400×400), `facebook-banner.svg` (820×312),',
    '  `linkedin-banner.svg` (1584×396), `instagram-story-template.svg` (1080×1920)',
    '',
    '## Produire les PDF et PNG',
    '',
    'Les SVG/HTML sont prêts. Pour générer les PDF (charte, cartes) et les PNG/ICO',
    '(favicon, apple-touch-icon, logos 512/1024), installez les outils optionnels puis',
    'lancez le script :',
    '',
    '```bash',
    'npm i puppeteer sharp',
    'node render-assets.mjs',
    '```',
    '',
    'Le script est **tolérant aux pannes** : si `puppeteer` ou `sharp` est absent, il',
    'saute l\'étape correspondante et affiche ce qui a été produit, sans jamais planter.',
    '',
    'Sorties attendues :',
    '',
    '- `charte-graphique.pdf`',
    '- `carte-de-visite.pdf`, `carte-de-visite-recto.pdf`, `carte-de-visite-verso.pdf`',
    '- `favicon-32.png`, `apple-touch-icon.png`, `logo/logo-square-512.png`, `logo/logo-square-1024.png`',
    '',
  ].join('\n');
}

// ─── Optional inline render (behind GENESIS_BRAND_RENDER) ───────────

function tryInlineRender(root: string): boolean {
  if (!existsSync(join(root, 'node_modules'))) return false;
  try {
    spawnSync('node', ['render-assets.mjs'], { cwd: root, stdio: 'inherit', env: process.env });
  } catch {
    return false;
  }
  return existsSync(join(root, 'charte-graphique.pdf'));
}

// ─── Small deterministic helpers ────────────────────────────────────

function stripFences(text: string): string {
  return text
    .replace(/^\s*```[a-zA-Z]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GS';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
  return s || 'brand';
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…';
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines.slice(0, 5) : [text];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToCmyk(rgb: { r: number; g: number; b: number }): string {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return '0, 0, 0, 100';
  const c = Math.round(((1 - r - k) / (1 - k)) * 100);
  const m = Math.round(((1 - g - k) / (1 - k)) * 100);
  const y = Math.round(((1 - b - k) / (1 - k)) * 100);
  return `${c}, ${m}, ${y}, ${Math.round(k * 100)}`;
}

function isLight(rgb: { r: number; g: number; b: number }): boolean {
  // Perceived luminance (ITU-R BT.601).
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 150;
}
