import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  BriefAnalysis,
  CompetitorReport,
  DesignSystem,
  GeneratedFile,
} from '@genesis/shared';
import { streamCode } from '../llm';
import { getTemplate } from '../templates';
import type { SiteContent } from './ContentAgent';
import type { SEOPack } from './SEOAgent';

export type Plan = 'starter' | 'pro' | 'business' | 'enterprise' | 'agency';

/** Input contract for the CoderAgent. */
export interface CoderInput {
  siteId: string;
  idea: string;
  analysis: BriefAnalysis;
  competitors: CompetitorReport;
  design: DesignSystem;
  plan: Plan;
  language?: { code: string; name: string; rtl: boolean };
  /** Real persuasive copy from ContentAgent. Falls back to template defaults. */
  content?: SiteContent;
  /** Localized SEO/meta + JSON-LD from SEOAgent. Falls back to basic metadata. */
  seo?: SEOPack;
}

/** Streamed per-file progress event. */
export interface CoderProgress {
  step: 'planning' | 'generating' | 'saving' | 'done';
  file?: string;
  index: number;
  total: number;
}

/** Final result. `generatedFiles` carries contents for downstream review/deploy. */
export interface CoderResult {
  siteId: string;
  path: string;
  files: string[];
  ready: boolean;
  generatedFiles: GeneratedFile[];
}

const PLAN_RANK: Record<Plan, number> = {
  starter: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
  agency: 5,
};

interface FileDescriptor {
  path: string;
  kind: 'static' | 'ai';
  make?: () => string;
  ai?: { user: string; maxTokens?: number };
}

/**
 * Generate a complete Next.js 14 project for a client and stream progress.
 *
 * Infrastructure/config files are produced deterministically (guaranteed valid
 * — you never want an LLM hallucinating your tsconfig), while the creative
 * surface (layout, landing page, nav/footer, admin, login) is generated file by
 * file with claude-sonnet-4-6 using the unique design tokens and the detected
 * language. Every file is written to /tmp/genesis/<siteId>/ as it completes.
 */
export async function* runCoder(
  input: CoderInput,
): AsyncGenerator<CoderProgress, CoderResult> {
  const root = join('/tmp', 'genesis', input.siteId);
  const lang = input.language ?? {
    code: input.analysis.location.locale,
    name: 'la langue locale du client',
    rtl: false,
  };
  const hasAuth = PLAN_RANK[input.plan] >= PLAN_RANK.pro;
  const hasPay = Boolean(input.analysis.needsPayment);
  const template = getTemplate(input.analysis.type);

  const descriptors = buildPlan(input, { lang, hasAuth, hasPay, template });
  const total = descriptors.length;

  yield { step: 'planning', index: 0, total };

  const generatedFiles: GeneratedFile[] = [];
  let i = 0;

  for (const d of descriptors) {
    i += 1;
    yield { step: 'generating', file: d.path, index: i, total };

    let content: string;
    if (d.kind === 'static' && d.make) {
      content = d.make();
    } else {
      const raw = await streamCode({
        system: aiSystem(input, { lang, template }),
        user: d.ai!.user,
        maxTokens: d.ai?.maxTokens ?? 8000,
      });
      content = stripFences(raw);
    }

    const abs = join(root, d.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');

    generatedFiles.push({ path: d.path, content });
    yield { step: 'saving', file: d.path, index: i, total };
  }

  yield { step: 'done', index: total, total };

  return {
    siteId: input.siteId,
    path: root,
    files: descriptors.map((d) => d.path),
    ready: true,
    generatedFiles,
  };
}

// ─── File plan ──────────────────────────────────────────────────────

function buildPlan(
  input: CoderInput,
  ctx: {
    lang: { code: string; name: string; rtl: boolean };
    hasAuth: boolean;
    hasPay: boolean;
    template: ReturnType<typeof getTemplate>;
  },
): FileDescriptor[] {
  const { analysis, design } = input;
  const { lang, hasAuth, hasPay, template } = ctx;
  const files: FileDescriptor[] = [];

  // ── deterministic infra/config ──
  files.push({ path: 'package.json', kind: 'static', make: () => pkgJson(input, { hasAuth, hasPay }) });
  files.push({ path: 'next.config.mjs', kind: 'static', make: nextConfig });
  files.push({ path: 'tsconfig.json', kind: 'static', make: tsConfig });
  files.push({ path: 'postcss.config.js', kind: 'static', make: postcssConfig });
  files.push({ path: 'tailwind.config.ts', kind: 'static', make: () => tailwindConfig(design) });
  files.push({ path: 'app/globals.css', kind: 'static', make: () => globalsCss(design) });
  files.push({ path: 'lib/design-tokens.ts', kind: 'static', make: () => designTokens(design) });
  files.push({ path: 'data/content.json', kind: 'static', make: () => contentSeed(input, lang, template) });
  files.push({ path: 'lib/content.ts', kind: 'static', make: contentStore });
  files.push({ path: 'lib/seo.ts', kind: 'static', make: () => seoModule(input, lang, template) });
  files.push({ path: 'app/api/chat/route.ts', kind: 'static', make: () => chatRoute(analysis) });
  files.push({ path: 'app/api/content/route.ts', kind: 'static', make: () => contentRoute(hasAuth) });
  files.push({ path: 'app/sitemap.ts', kind: 'static', make: sitemap });
  files.push({ path: 'app/robots.ts', kind: 'static', make: robots });
  files.push({ path: 'components/ChatWidget.tsx', kind: 'static', make: () => chatWidget(lang) });
  files.push({ path: '.env.example', kind: 'static', make: () => envExample({ hasAuth, hasPay }) });
  files.push({ path: 'README.md', kind: 'static', make: () => readme(input) });

  if (hasAuth) {
    files.push({ path: 'auth.ts', kind: 'static', make: authConfig });
    files.push({ path: 'app/api/auth/[...nextauth]/route.ts', kind: 'static', make: authRoute });
    files.push({ path: 'middleware.ts', kind: 'static', make: middleware });
  }

  if (hasPay) {
    files.push({ path: 'lib/stripe.ts', kind: 'static', make: stripeLib });
    files.push({ path: 'app/api/checkout/route.ts', kind: 'static', make: checkoutRoute });
    files.push({ path: 'app/api/webhook/route.ts', kind: 'static', make: webhookRoute });
  }

  // ── AI-generated creative surface ──
  files.push({
    path: 'app/layout.tsx',
    kind: 'ai',
    ai: {
      maxTokens: 4000,
      user:
        `Generate app/layout.tsx (Server Component). Set <html lang="${lang.code}"` +
        (lang.rtl ? ' dir="rtl"' : '') +
        `> and import "./globals.css". Re-export the SEO metadata: ` +
        `\`export { metadata } from "@/lib/seo";\`. Import \`jsonLd\` from "@/lib/seo" ` +
        `and inject it in <head> as <script type="application/ld+json" ` +
        `dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />. ` +
        `Render <Navbar/>, {children}, <Footer/> and <ChatWidget/> (import from ` +
        `@/components/...). Body background var(--bg), text var(--text). ` +
        `Do NOT redefine metadata yourself — only re-export it from @/lib/seo.`,
    },
  });
  files.push({
    path: 'app/page.tsx',
    kind: 'ai',
    ai: {
      user:
        `Generate app/page.tsx — the marketing landing. It is a Server Component ` +
        `that calls getContent() from '@/lib/content' and renders these sections ` +
        `in order: ${template.sections.map((s) => s.id).join(', ')}. Conversion ` +
        `goal: ${template.conversionGoal}. ${ctx.hasPay ? 'Include a pricing section whose CTA POSTs to /api/checkout. ' : ''}` +
        `Use the design tokens (bg-primary, text-text, the gradient for primary ` +
        `CTAs), real persuasive copy from the content, and be fully responsive.`,
    },
  });
  files.push({
    path: 'components/Navbar.tsx',
    kind: 'ai',
    ai: { maxTokens: 3000, user: 'Generate components/Navbar.tsx: a responsive, accessible sticky navbar (client component) with the business name, anchor links to the page sections, a mobile burger menu, and a primary CTA button using the gradient.' },
  });
  files.push({
    path: 'components/Footer.tsx',
    kind: 'ai',
    ai: { maxTokens: 3000, user: 'Generate components/Footer.tsx: a footer with business name, contact info, quick links, social placeholders, current year, and legal links. Use var(--surface) background.' },
  });
  files.push({
    path: 'app/admin/page.tsx',
    kind: 'ai',
    ai: {
      maxTokens: 5000,
      user:
        'Generate app/admin/page.tsx — a client-side admin panel so the owner ' +
        'edits their site content. On mount it GETs /api/content, renders an ' +
        'editable form for every text field (hero, sections, services, contact), ' +
        'and a Save button that PUTs the updated JSON to /api/content with a ' +
        'success toast. Clean, usable, responsive.',
    },
  });

  if (hasAuth) {
    files.push({
      path: 'app/login/page.tsx',
      kind: 'ai',
      ai: { maxTokens: 3000, user: 'Generate app/login/page.tsx — a styled client login form (email + password) that calls signIn("credentials", { redirect:false }) from next-auth/react and on success pushes to /admin. Show errors inline.' },
    });
  }

  return files;
}

// ─── Shared AI system prompt ────────────────────────────────────────

function aiSystem(
  input: CoderInput,
  ctx: { lang: { code: string; name: string; rtl: boolean }; template: ReturnType<typeof getTemplate> },
): string {
  const { analysis, competitors, design } = input;
  return [
    'You are an elite Next.js 14 (App Router) + TypeScript + Tailwind engineer.',
    'Output ONLY the raw file content — no markdown fences, no commentary.',
    'The code must be production-ready: zero placeholders, zero TODO, no lorem ipsum.',
    '',
    `Write ALL human-visible text in: ${ctx.lang.name} (${ctx.lang.code}).` +
      (ctx.lang.rtl ? ' The layout is RTL.' : ''),
    '',
    'Design tokens are exposed both as CSS variables in globals.css and as Tailwind',
    'theme colors. Use Tailwind classes: bg-bg, bg-surface, bg-primary, text-text,',
    'text-muted, border-border, etc. For primary CTAs use the gradient utility',
    '`.btn-gradient` (defined in globals.css). Respect these values:',
    `  primary ${design.palette.primary}, secondary ${design.palette.secondary},`,
    `  accent ${design.palette.accent}, radius ${design.radius}.`,
    `  Heading font: ${design.fonts.heading}; body font: ${design.fonts.body}.`,
    '',
    `Business: ${analysis.businessName} — ${analysis.valueProposition}.`,
    `Sector: ${analysis.sector}. Audience: ${analysis.audience}.`,
    `Beat competitors via: ${competitors.positioning}.`,
    '',
    'Available imports: @/components/Navbar, @/components/Footer,',
    '@/components/ChatWidget, @/lib/content (export getContent), @/lib/design-tokens',
    '(export tokens), @/lib/seo (export metadata, jsonLd). Content lives in',
    'data/content.json with shape { businessName, tagline, hero: { title, subtitle,',
    'cta }, sections: { [id]: { heading, body } }, services: string[], faq: [{ q, a }],',
    'testimonials: [{ name, text }], contact: { phone, email, address } }. Use this',
    'real copy verbatim — never invent placeholder text. Render the FAQ and',
    'testimonials when the section list includes them.',
    '',
    'Mobile-first, responsive, accessible (WCAG AA, semantic HTML, alt text, labels).',
  ].join('\n');
}

// ─── Deterministic file generators ──────────────────────────────────

function pkgJson(input: CoderInput, o: { hasAuth: boolean; hasPay: boolean }): string {
  const deps: Record<string, string> = {
    '@anthropic-ai/sdk': '^0.27.3',
    next: '14.2.4',
    react: '^18.3.1',
    'react-dom': '^18.3.1',
  };
  if (o.hasAuth) deps['next-auth'] = '5.0.0-beta.20';
  if (o.hasPay) deps['stripe'] = '^16.8.0';

  const pkg = {
    name: 'genesis-site-' + input.siteId.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30),
    version: '1.0.0',
    private: true,
    scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
    dependencies: deps,
    devDependencies: {
      '@types/node': '^20.14.8',
      '@types/react': '^18.3.3',
      '@types/react-dom': '^18.3.0',
      autoprefixer: '^10.4.19',
      postcss: '^8.4.38',
      tailwindcss: '^3.4.4',
      typescript: '^5.5.3',
    },
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

function nextConfig(): string {
  return [
    '/** @type {import(\'next\').NextConfig} */',
    'const nextConfig = { reactStrictMode: true };',
    'export default nextConfig;',
    '',
  ].join('\n');
}

function tsConfig(): string {
  const cfg = {
    compilerOptions: {
      target: 'ES2021',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  };
  return JSON.stringify(cfg, null, 2) + '\n';
}

function postcssConfig(): string {
  return 'module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };\n';
}

function tailwindConfig(d: DesignSystem): string {
  const colors = [
    "        bg: 'var(--bg)',",
    "        surface: 'var(--surface)',",
    "        primary: 'var(--primary)',",
    "        secondary: 'var(--secondary)',",
    "        accent: 'var(--accent)',",
    "        text: 'var(--text)',",
    "        muted: 'var(--muted)',",
    "        border: 'var(--border)',",
  ].join('\n');
  return [
    "import type { Config } from 'tailwindcss';",
    'const config: Config = {',
    "  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],",
    '  theme: {',
    '    extend: {',
    '      colors: {',
    colors,
    '      },',
    '      borderRadius: { brand: ' + JSON.stringify(d.radius) + ' },',
    "      fontFamily: { heading: ['var(--font-heading)'], body: ['var(--font-body)'] },",
    '    },',
    '  },',
    '  plugins: [],',
    '};',
    'export default config;',
    '',
  ].join('\n');
}

function fontImport(d: DesignSystem): string {
  const fam = (name: string) => name.trim().replace(/\s+/g, '+');
  const h = fam(d.fonts.heading);
  const b = fam(d.fonts.body);
  const w = d.typography.headingWeight;
  return (
    "@import url('https://fonts.googleapis.com/css2?family=" +
    h +
    ':wght@400;' +
    w +
    '&family=' +
    b +
    ":wght@400;500;600&display=swap');"
  );
}

function globalsCss(d: DesignSystem): string {
  return [
    fontImport(d),
    '@tailwind base;',
    '@tailwind components;',
    '@tailwind utilities;',
    '',
    ':root {',
    '  --bg: ' + d.palette.background + ';',
    '  --surface: ' + d.palette.surface + ';',
    '  --primary: ' + d.palette.primary + ';',
    '  --secondary: ' + d.palette.secondary + ';',
    '  --accent: ' + d.palette.accent + ';',
    '  --text: ' + d.palette.text + ';',
    '  --muted: ' + d.palette.muted + ';',
    '  --border: ' + d.palette.border + ';',
    '  --radius: ' + d.radius + ';',
    "  --font-heading: '" + d.fonts.heading + "', system-ui, sans-serif;",
    "  --font-body: '" + d.fonts.body + "', system-ui, sans-serif;",
    '}',
    '',
    'html, body { background: var(--bg); color: var(--text); }',
    'body { font-family: var(--font-body); }',
    'h1, h2, h3, h4 { font-family: var(--font-heading); font-weight: ' +
      d.typography.headingWeight +
      '; }',
    '',
    '@layer components {',
    '  .btn-gradient {',
    '    background-image: ' + d.gradient + ';',
    '    color: #fff;',
    '    border-radius: var(--radius);',
    '  }',
    '}',
    '',
  ].join('\n');
}

function designTokens(d: DesignSystem): string {
  return 'export const tokens = ' + JSON.stringify(d, null, 2) + ' as const;\n';
}

function contentSeed(
  input: CoderInput,
  lang: { code: string },
  template: ReturnType<typeof getTemplate>,
): string {
  const { analysis } = input;
  const copy = input.content;

  // Map ContentAgent's ordered sections onto the template's section ids so the
  // page can look each one up by id. Fall back to the blueprint's own titles.
  const sections: Record<string, { heading: string; body: string }> = {};
  template.sections.forEach((s, idx) => {
    const generated = copy?.sections?.[idx];
    sections[s.id] = {
      heading: generated?.heading ?? s.title,
      body: generated?.body ?? s.purpose,
    };
  });

  const content = {
    locale: lang.code,
    businessName: analysis.businessName,
    tagline: copy?.hero?.subtitle ?? analysis.valueProposition,
    hero: copy?.hero ?? {
      title: analysis.businessName,
      subtitle: analysis.valueProposition,
      cta: template.conversionGoal,
    },
    sections,
    services: analysis.features,
    faq: copy?.faq ?? [],
    testimonials: copy?.testimonials ?? [],
    contact: { phone: '', email: '', address: analysis.location.city ?? '' },
  };
  return JSON.stringify(content, null, 2) + '\n';
}

function seoModule(
  input: CoderInput,
  lang: { code: string },
  template: ReturnType<typeof getTemplate>,
): string {
  const { analysis, seo } = input;
  const title = seo?.title ?? `${analysis.businessName} — ${analysis.sector}`;
  const description = seo?.metaDescription ?? analysis.valueProposition;
  const keywords = seo?.keywords ?? analysis.features;
  const ogTitle = seo?.ogTitle ?? title;
  const ogDescription = seo?.ogDescription ?? description;
  const jsonLd =
    seo?.jsonLd ??
    {
      '@context': 'https://schema.org',
      '@type': template.schemaType,
      name: analysis.businessName,
      description,
      areaServed: analysis.location.city ?? analysis.location.country ?? undefined,
    };

  const meta = {
    title,
    description,
    keywords,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'website',
      locale: lang.code,
    },
  };

  return [
    "import type { Metadata } from 'next';",
    '',
    '// Localized SEO pack generated by GENESIS (SEOAgent). Imported by app/layout.tsx.',
    'export const metadata: Metadata = ' + JSON.stringify(meta, null, 2) + ';',
    '',
    'export const jsonLd = ' + JSON.stringify(jsonLd, null, 2) + ';',
    '',
  ].join('\n');
}

function contentStore(): string {
  return [
    "import { promises as fs } from 'node:fs';",
    "import path from 'node:path';",
    '',
    "const FILE = path.join(process.cwd(), 'data', 'content.json');",
    '',
    'export type SiteContent = {',
    '  locale: string;',
    '  businessName: string;',
    '  tagline: string;',
    '  hero: { title: string; subtitle: string; cta: string };',
    '  sections: Record<string, { heading: string; body: string }>;',
    '  services: string[];',
    '  faq: { q: string; a: string }[];',
    '  testimonials: { name: string; text: string }[];',
    '  contact: { phone: string; email: string; address: string };',
    '};',
    '',
    'export async function getContent(): Promise<SiteContent> {',
    "  const raw = await fs.readFile(FILE, 'utf8');",
    '  return JSON.parse(raw) as SiteContent;',
    '}',
    '',
    'export async function saveContent(data: SiteContent): Promise<SiteContent> {',
    "  await fs.writeFile(FILE, JSON.stringify(data, null, 2), 'utf8');",
    '  return data;',
    '}',
    '',
  ].join('\n');
}

function chatRoute(analysis: BriefAnalysis): string {
  const ctx = analysis.businessName + ' — ' + analysis.valueProposition + ' (' + analysis.sector + ')';
  return [
    "import Anthropic from '@anthropic-ai/sdk';",
    '',
    "export const runtime = 'nodejs';",
    '',
    'const CONTEXT = ' + JSON.stringify(ctx) + ';',
    '',
    'export async function POST(req: Request) {',
    '  const { messages } = (await req.json()) as {',
    "    messages: { role: 'user' | 'assistant'; content: string }[];",
    '  };',
    '  if (!process.env.ANTHROPIC_API_KEY) {',
    "    return Response.json({ reply: 'Assistant indisponible.' });",
    '  }',
    '  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });',
    '  const res = await client.messages.create({',
    "    model: 'claude-sonnet-4-6',",
    '    max_tokens: 600,',
    "    system: 'Tu es l\\'assistant du site ' + CONTEXT + '. Réponds brièvement, dans la langue du visiteur.',",
    '    messages,',
    '  });',
    '  const reply = res.content',
    "    .filter((b): b is Anthropic.TextBlock => b.type === 'text')",
    '    .map((b) => b.text)',
    "    .join('');",
    '  return Response.json({ reply });',
    '}',
    '',
  ].join('\n');
}

function contentRoute(hasAuth: boolean): string {
  const lines: string[] = [];
  lines.push("import { getContent, saveContent, type SiteContent } from '@/lib/content';");
  if (hasAuth) lines.push("import { auth } from '@/auth';");
  lines.push('');
  lines.push("export const runtime = 'nodejs';");
  lines.push('');
  lines.push('export async function GET() {');
  lines.push('  return Response.json(await getContent());');
  lines.push('}');
  lines.push('');
  lines.push('export async function PUT(req: Request) {');
  if (hasAuth) {
    lines.push('  const session = await auth();');
    lines.push("  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });");
  }
  lines.push('  const data = (await req.json()) as SiteContent;');
  lines.push('  await saveContent(data);');
  lines.push('  return Response.json({ ok: true });');
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

function sitemap(): string {
  return [
    "import type { MetadataRoute } from 'next';",
    'export default function sitemap(): MetadataRoute.Sitemap {',
    "  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';",
    '  return [',
    '    { url: base, lastModified: new Date(), priority: 1 },',
    "    { url: base + '/admin', lastModified: new Date(), priority: 0.3 },",
    '  ];',
    '}',
    '',
  ].join('\n');
}

function robots(): string {
  return [
    "import type { MetadataRoute } from 'next';",
    'export default function robots(): MetadataRoute.Robots {',
    "  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';",
    "  return { rules: { userAgent: '*', allow: '/' }, sitemap: base + '/sitemap.xml' };",
    '}',
    '',
  ].join('\n');
}

function chatWidget(lang: { name: string }): string {
  return [
    "'use client';",
    '',
    "import { useState } from 'react';",
    '',
    'type Msg = { role: ' + "'user' | 'assistant'" + '; content: string };',
    '',
    'export default function ChatWidget() {',
    '  const [open, setOpen] = useState(false);',
    '  const [messages, setMessages] = useState<Msg[]>([]);',
    "  const [input, setInput] = useState('');",
    '  const [loading, setLoading] = useState(false);',
    '',
    '  async function send() {',
    '    const text = input.trim();',
    '    if (!text || loading) return;',
    "    const next: Msg[] = [...messages, { role: 'user', content: text }];",
    '    setMessages(next);',
    "    setInput('');",
    '    setLoading(true);',
    '    try {',
    "      const res = await fetch('/api/chat', {",
    "        method: 'POST',",
    "        headers: { 'Content-Type': 'application/json' },",
    '        body: JSON.stringify({ messages: next }),',
    '      });',
    '      const data = await res.json();',
    "      setMessages([...next, { role: 'assistant', content: data.reply }]);",
    '    } finally {',
    '      setLoading(false);',
    '    }',
    '  }',
    '',
    '  return (',
    '    <div style={{ position: ' + "'fixed'" + ', right: 20, bottom: 20, zIndex: 50 }}>',
    '      {open && (',
    '        <div className="mb-3 flex h-96 w-80 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-xl">',
    '          <div className="btn-gradient px-4 py-3 font-semibold">Assistant</div>',
    '          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">',
    '            {messages.map((m, i) => (',
    '              <div key={i} className={m.role === ' + "'user'" + ' ? ' + "'text-right'" + ' : ' + "'text-left'" + '}>',
    '                <span className="inline-block rounded-lg bg-bg px-3 py-2">{m.content}</span>',
    '              </div>',
    '            ))}',
    "            {loading && <div className=\"text-muted\">…</div>}",
    '          </div>',
    '          <div className="flex gap-2 border-t border-border p-2">',
    '            <input',
    '              value={input}',
    '              onChange={(e) => setInput(e.target.value)}',
    "              onKeyDown={(e) => e.key === 'Enter' && send()}",
    '              placeholder="Votre message…"',
    '              className="flex-1 rounded-lg bg-bg px-3 py-2 text-sm outline-none"',
    '            />',
    '            <button onClick={send} className="btn-gradient px-3 py-2 text-sm">→</button>',
    '          </div>',
    '        </div>',
    '      )}',
    '      <button',
    '        onClick={() => setOpen((v) => !v)}',
    '        aria-label="Ouvrir le chat"',
    '        className="btn-gradient h-14 w-14 rounded-full text-xl shadow-lg"',
    '      >',
    '        💬',
    '      </button>',
    '    </div>',
    '  );',
    '}',
    '',
  ].join('\n');
}

function envExample(o: { hasAuth: boolean; hasPay: boolean }): string {
  const lines = [
    '# Site généré par GENESIS',
    'ANTHROPIC_API_KEY=',
    'NEXT_PUBLIC_SITE_URL=http://localhost:3000',
  ];
  if (o.hasAuth) {
    lines.push('NEXTAUTH_SECRET=', 'ADMIN_EMAIL=', 'ADMIN_PASSWORD=');
  }
  if (o.hasPay) {
    lines.push('STRIPE_SECRET_KEY=', 'STRIPE_WEBHOOK_SECRET=', 'STRIPE_PRICE_ID=');
  }
  return lines.join('\n') + '\n';
}

function readme(input: CoderInput): string {
  return [
    '# ' + input.analysis.businessName,
    '',
    'Site généré par **GENESIS**.',
    '',
    '## Démarrage',
    '',
    '```bash',
    'cp .env.example .env   # renseigne au minimum ANTHROPIC_API_KEY',
    'npm install',
    'npm run dev            # http://localhost:3000',
    '```',
    '',
    '- Page publique : `/`',
    '- Panneau admin : `/admin`' + (PLAN_RANK[input.plan] >= PLAN_RANK.pro ? ' (connexion requise via `/login`)' : ''),
    '',
    'Modifie le contenu depuis `/admin` ou directement dans `data/content.json`.',
    '',
  ].join('\n');
}

function authConfig(): string {
  return [
    "import NextAuth from 'next-auth';",
    "import Credentials from 'next-auth/providers/credentials';",
    '',
    'export const { handlers, auth, signIn, signOut } = NextAuth({',
    '  trustHost: true,',
    '  secret: process.env.NEXTAUTH_SECRET,',
    "  session: { strategy: 'jwt' },",
    "  pages: { signIn: '/login' },",
    '  providers: [',
    '    Credentials({',
    '      credentials: { email: {}, password: {} },',
    '      authorize(creds) {',
    '        if (',
    '          creds?.email === process.env.ADMIN_EMAIL &&',
    '          creds?.password === process.env.ADMIN_PASSWORD',
    '        ) {',
    "          return { id: 'admin', email: String(creds.email) };",
    '        }',
    '        return null;',
    '      },',
    '    }),',
    '  ],',
    '});',
    '',
  ].join('\n');
}

function authRoute(): string {
  return ["import { handlers } from '@/auth';", '', "export const runtime = 'nodejs';", 'export const { GET, POST } = handlers;', ''].join('\n');
}

function middleware(): string {
  return [
    "import { NextResponse, type NextRequest } from 'next/server';",
    '',
    'export function middleware(req: NextRequest) {',
    '  const ok =',
    "    req.cookies.has('authjs.session-token') ||",
    "    req.cookies.has('__Secure-authjs.session-token');",
    "  if (!ok) return NextResponse.redirect(new URL('/login', req.url));",
    '  return NextResponse.next();',
    '}',
    '',
    "export const config = { matcher: ['/admin/:path*'] };",
    '',
  ].join('\n');
}

function stripeLib(): string {
  return [
    "import Stripe from 'stripe';",
    '',
    'export function getStripe(): Stripe | null {',
    '  if (!process.env.STRIPE_SECRET_KEY) return null;',
    "  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });",
    '}',
    '',
  ].join('\n');
}

function checkoutRoute(): string {
  return [
    "import { getStripe } from '@/lib/stripe';",
    '',
    "export const runtime = 'nodejs';",
    '',
    'export async function POST(req: Request) {',
    '  const stripe = getStripe();',
    '  const price = process.env.STRIPE_PRICE_ID;',
    '  if (!stripe || !price) {',
    "    return Response.json({ error: 'Paiement non configuré.' }, { status: 503 });",
    '  }',
    "  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;",
    '  const session = await stripe.checkout.sessions.create({',
    "    mode: 'payment',",
    '    line_items: [{ price, quantity: 1 }],',
    "    success_url: origin + '/?paid=1',",
    "    cancel_url: origin + '/?canceled=1',",
    '  });',
    '  return Response.json({ url: session.url });',
    '}',
    '',
  ].join('\n');
}

function webhookRoute(): string {
  return [
    "import type Stripe from 'stripe';",
    "import { getStripe } from '@/lib/stripe';",
    '',
    "export const runtime = 'nodejs';",
    '',
    'export async function POST(req: Request) {',
    '  const stripe = getStripe();',
    '  const secret = process.env.STRIPE_WEBHOOK_SECRET;',
    "  const sig = req.headers.get('stripe-signature');",
    '  if (!stripe || !secret || !sig) {',
    "    return new Response('Webhook non configuré', { status: 503 });",
    '  }',
    '  const raw = await req.text();',
    '  let event: Stripe.Event;',
    '  try {',
    '    event = stripe.webhooks.constructEvent(raw, sig, secret);',
    '  } catch (err) {',
    "    return new Response('Signature invalide: ' + (err as Error).message, { status: 400 });",
    '  }',
    "  if (event.type === 'checkout.session.completed') {",
    '    const session = event.data.object as Stripe.Checkout.Session;',
    '    console.log(' + "'Paiement confirmé:'" + ', session.id);',
    '  }',
    '  return Response.json({ received: true });',
    '}',
    '',
  ].join('\n');
}

function stripFences(text: string): string {
  return text
    .replace(/^\s*```[a-zA-Z]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}
