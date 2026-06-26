import type { BriefAnalysis, DesignSystem, GeneratedFile } from '@genesis/shared';
import { askJSON } from '../llm';

// ─── Public contract ────────────────────────────────────────────────

export interface ABTest {
  id: string;
  hypothesis: string;
  variantA: string;
  variantB: string;
  metric: string;
  durationDays: number;
}

export interface GrowthResult {
  /** Analytics + A/B files to MERGE into the generated Next.js site. */
  files: GeneratedFile[];
  abTest: ABTest;
  /** Initial, sector-aware growth recommendations. */
  recommendations: string[];
}

export interface GrowthMetrics {
  visitors: number;
  conversions: number;
  conversionRate: number;
  revenueEUR: number;
  sectorAvgConversionRate: number;
}

export interface GrowthAnalysis {
  summary: string;
  benchmark: string;
  recommendations: Array<{ title: string; impact: string; detail: string }>;
  alert?: string;
}

// ─── (a) Inject analytics + A/B into the generated site ─────────────

/**
 * Deterministically produce the growth/analytics surface for a generated site:
 * GA4 + Hotjar + Meta Pixel injection, typed tracking helpers, an SSR-safe A/B
 * bucketing util and a generic hero A/B wrapper. The returned files are meant to
 * be appended to the CoderAgent's GeneratedFile[] (paths are relative to the
 * site root). Also returns a sensible default hero experiment and three
 * sector-aware starter recommendations.
 */
export function runGrowth(input: {
  analysis: BriefAnalysis;
  design: DesignSystem;
}): GrowthResult {
  const { analysis } = input;

  const files: GeneratedFile[] = [
    { path: 'components/Analytics.tsx', content: analyticsComponent() },
    { path: 'lib/analytics.ts', content: analyticsLib() },
    { path: 'lib/ab-test.ts', content: abTestLib() },
    { path: 'components/HomeVariant.tsx', content: homeVariantComponent() },
    { path: '.env.analytics.example', content: envAnalyticsExample() },
  ];

  const abTest: ABTest = {
    id: 'home-hero',
    hypothesis:
      `Une accroche orientée bénéfice client pour « ${analysis.businessName} » ` +
      'augmente le taux de conversion par rapport à une accroche descriptive.',
    variantA: 'Accroche descriptive (proposition de valeur actuelle)',
    variantB: 'Accroche orientée bénéfice + CTA contrasté',
    metric: 'conversion_rate',
    durationDays: 14,
  };

  return { files, abTest, recommendations: starterRecommendations(analysis) };
}

function starterRecommendations(analysis: BriefAnalysis): string[] {
  const where = analysis.location.city ?? analysis.location.country ?? 'votre zone';
  const cta =
    analysis.type === 'ecommerce' || analysis.needsPayment
      ? 'finaliser un achat'
      : analysis.type === 'booking' || analysis.type === 'salon' || analysis.type === 'restaurant'
        ? 'réserver en ligne'
        : 'demander un devis ou un contact';
  return [
    `Optimisez le SEO local pour « ${analysis.sector} à ${where} » : fiche Google Business, ` +
      'mots-clés géolocalisés et avis clients pour capter une audience à forte intention.',
    `Réduisez les frictions du parcours pour ${cta} : CTA visible dès le premier écran, ` +
      'formulaire court et preuve sociale (témoignages) à proximité immédiate du bouton.',
    `Lancez le test A/B « home-hero » sur 14 jours auprès de votre audience (${analysis.audience}) ` +
      'puis réinvestissez le budget sur la variante gagnante.',
  ];
}

// ─── (b) Monthly AI growth analysis (used by the dashboard) ─────────

/**
 * Produce a monthly growth analysis in the client's locale, comparing the site's
 * conversion rate to its sector average. Always resolves: if the model call
 * fails, a deterministic, metrics-driven fallback is returned instead.
 */
export async function analyzeGrowth(input: {
  analysis: BriefAnalysis;
  metrics: GrowthMetrics;
}): Promise<GrowthAnalysis> {
  const { analysis, metrics } = input;
  const locale = analysis.location.locale;

  const system = [
    'You are GENESIS Growth, a senior growth-marketing analyst.',
    `Write EVERY string of your answer in the language of locale "${locale}" — natural, professional, concise.`,
    'You analyse one website\'s monthly performance and return strictly actionable advice.',
    'Return ONLY a JSON object with this exact shape:',
    '{',
    '  "summary": string,            // 2-3 sentences on the month',
    '  "benchmark": string,          // how the conversion rate compares to the sector average',
    '  "recommendations": [ { "title": string, "impact": string, "detail": string } ],  // exactly 3',
    '  "alert": string               // OPTIONAL: include ONLY if revenue or conversions are weak vs benchmark',
    '}',
    'Each recommendation: a short title, an "impact" tag (e.g. "Impact élevé"), and a concrete detail.',
  ].join('\n');

  const belowBenchmark = metrics.conversionRate < metrics.sectorAvgConversionRate;
  const user = [
    `Business: ${analysis.businessName} (${analysis.sector}, type ${analysis.type}).`,
    `Audience: ${analysis.audience}. Value proposition: ${analysis.valueProposition}.`,
    'Monthly metrics:',
    `- Visitors: ${metrics.visitors}`,
    `- Conversions: ${metrics.conversions}`,
    `- Conversion rate: ${metrics.conversionRate.toFixed(2)}%`,
    `- Sector average conversion rate: ${metrics.sectorAvgConversionRate.toFixed(2)}%`,
    `- Revenue: ${metrics.revenueEUR} EUR`,
    `The conversion rate is ${belowBenchmark ? 'BELOW' : 'AT OR ABOVE'} the sector average.`,
    'Give exactly 3 prioritised recommendations. Add "alert" only if performance is clearly under benchmark.',
  ].join('\n');

  try {
    const result = await askJSON<GrowthAnalysis>({
      system,
      user,
      maxTokens: 1500,
      label: 'analyzeGrowth',
    });
    return normalizeAnalysis(result, input);
  } catch {
    return fallbackAnalysis(input);
  }
}

/** Guard against partial model output by backfilling from the deterministic fallback. */
function normalizeAnalysis(
  result: GrowthAnalysis,
  input: { analysis: BriefAnalysis; metrics: GrowthMetrics },
): GrowthAnalysis {
  const fb = fallbackAnalysis(input);
  const recommendations =
    Array.isArray(result.recommendations) && result.recommendations.length > 0
      ? result.recommendations
          .slice(0, 3)
          .map((r) => ({
            title: r?.title ?? '',
            impact: r?.impact ?? '',
            detail: r?.detail ?? '',
          }))
      : fb.recommendations;

  return {
    summary: result.summary?.trim() ? result.summary : fb.summary,
    benchmark: result.benchmark?.trim() ? result.benchmark : fb.benchmark,
    recommendations,
    alert: result.alert?.trim() ? result.alert : fb.alert,
  };
}

function fallbackAnalysis(input: {
  analysis: BriefAnalysis;
  metrics: GrowthMetrics;
}): GrowthAnalysis {
  const { analysis, metrics } = input;
  const delta = metrics.conversionRate - metrics.sectorAvgConversionRate;
  const below = delta < 0;
  const pct = (n: number) => `${n.toFixed(2)} %`;

  const summary =
    `Ce mois-ci, ${analysis.businessName} a enregistré ${metrics.visitors} visiteurs et ` +
    `${metrics.conversions} conversions, soit un taux de ${pct(metrics.conversionRate)} ` +
    `pour ${metrics.revenueEUR} € de revenus.`;

  const benchmark = below
    ? `Le taux de conversion est inférieur de ${pct(Math.abs(delta))} à la moyenne du secteur ` +
      `« ${analysis.sector} » (${pct(metrics.sectorAvgConversionRate)}). Il existe une marge de progression nette.`
    : `Le taux de conversion dépasse la moyenne du secteur « ${analysis.sector} » ` +
      `(${pct(metrics.sectorAvgConversionRate)}) de ${pct(delta)}. La performance est solide.`;

  const recommendations = [
    {
      title: 'Renforcer la preuve sociale',
      impact: 'Impact élevé',
      detail:
        'Affichez avis clients, notes et témoignages près des CTA principaux pour rassurer ' +
        'les visiteurs au moment de la décision.',
    },
    {
      title: 'Optimiser le tunnel de conversion',
      impact: below ? 'Impact élevé' : 'Impact moyen',
      detail:
        'Simplifiez le formulaire, réduisez le nombre d’étapes et rendez le CTA visible dès ' +
        'le premier écran sur mobile.',
    },
    {
      title: 'Exploiter le test A/B « home-hero »',
      impact: 'Impact moyen',
      detail:
        'Comparez deux accroches sur 14 jours et déployez la variante gagnante pour ' +
        'verrouiller un gain de conversion durable.',
    },
  ];

  const alert =
    below || metrics.conversions === 0
      ? `Performance sous le benchmark : ${pct(metrics.conversionRate)} contre ` +
        `${pct(metrics.sectorAvgConversionRate)} attendus. Priorisez l’optimisation du tunnel ce mois-ci.`
      : undefined;

  return { summary, benchmark, recommendations, alert };
}

// ─── Generated site files (deterministic strings) ───────────────────

function analyticsComponent(): string {
  return [
    "'use client';",
    '',
    "import Script from 'next/script';",
    '',
    '/**',
    ' * Injects GA4, Hotjar and Meta Pixel — each block only renders when its',
    ' * NEXT_PUBLIC_* id is configured. Drop <Analytics /> into app/layout.tsx.',
    ' */',
    'const GA_ID = process.env.NEXT_PUBLIC_GA_ID;',
    'const HOTJAR_ID = process.env.NEXT_PUBLIC_HOTJAR_ID;',
    'const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;',
    '',
    'export default function Analytics() {',
    '  return (',
    '    <>',
    '      {GA_ID && (',
    '        <>',
    '          <Script',
    '            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}',
    '            strategy="afterInteractive"',
    '          />',
    '          <Script id="ga4-init" strategy="afterInteractive">',
    '            {`window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    'gtag(\'js\', new Date());',
    "gtag('config', '${GA_ID}', { send_page_view: true });`}",
    '          </Script>',
    '        </>',
    '      )}',
    '',
    '      {HOTJAR_ID && (',
    '        <Script id="hotjar-init" strategy="afterInteractive">',
    "          {`(function(h,o,t,j,a,r){",
    'h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};',
    'h._hjSettings={hjid:${HOTJAR_ID},hjsv:6};',
    "a=o.getElementsByTagName('head')[0];",
    "r=o.createElement('script');r.async=1;",
    "r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;",
    'a.appendChild(r);',
    "})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}",
    '        </Script>',
    '      )}',
    '',
    '      {META_PIXEL_ID && (',
    '        <>',
    '          <Script id="meta-pixel-init" strategy="afterInteractive">',
    '            {`!function(f,b,e,v,n,t,s)',
    '{if(f.fbq)return;n=f.fbq=function(){n.callMethod?',
    'n.callMethod.apply(n,arguments):n.queue.push(arguments)};',
    "if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';",
    'n.queue=[];t=b.createElement(e);t.async=!0;',
    "t.src=v;s=b.getElementsByTagName(e)[0];",
    "s.parentNode.insertBefore(t,s)}(window,document,'script',",
    "'https://connect.facebook.net/en_US/fbevents.js');",
    "fbq('init', '${META_PIXEL_ID}');",
    "fbq('track', 'PageView');`}",
    '          </Script>',
    '          <noscript>',
    '            <img',
    '              height="1"',
    '              width="1"',
    '              style={{ display: \'none\' }}',
    '              alt=""',
    '              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}',
    '            />',
    '          </noscript>',
    '        </>',
    '      )}',
    '    </>',
    '  );',
    '}',
    '',
    '/** Custom-events helper — fire a domain event into every configured tool at once. */',
    'export function trackCustomEvent(',
    '  name: string,',
    '  params: Record<string, unknown> = {},',
    '): void {',
    "  if (typeof window === 'undefined') return;",
    '  const w = window as typeof window & {',
    '    gtag?: (...args: unknown[]) => void;',
    '    fbq?: (...args: unknown[]) => void;',
    '  };',
    "  w.gtag?.('event', name, params);",
    "  w.fbq?.('trackCustom', name, params);",
    '}',
    '',
  ].join('\n');
}

function analyticsLib(): string {
  return [
    '// Typed, SSR-safe analytics helpers. Safe to import anywhere; every call is a',
    '// no-op on the server or when the underlying tag is not loaded.',
    '',
    'type GtagFn = (...args: unknown[]) => void;',
    'type FbqFn = (...args: unknown[]) => void;',
    '',
    'function getGtag(): GtagFn | undefined {',
    "  if (typeof window === 'undefined') return undefined;",
    '  return (window as typeof window & { gtag?: GtagFn }).gtag;',
    '}',
    '',
    'function getFbq(): FbqFn | undefined {',
    "  if (typeof window === 'undefined') return undefined;",
    '  return (window as typeof window & { fbq?: FbqFn }).fbq;',
    '}',
    '',
    '/** Track an arbitrary event in GA4 and Meta Pixel. */',
    'export function trackEvent(',
    '  name: string,',
    '  params: Record<string, unknown> = {},',
    '): void {',
    "  getGtag()?.('event', name, params);",
    "  getFbq()?.('trackCustom', name, params);",
    '}',
    '',
    '/** Track a conversion with a monetary value (EUR by default). */',
    "export function trackConversion(value: number, currency = 'EUR'): void {",
    "  getGtag()?.('event', 'conversion', { value, currency });",
    "  getFbq()?.('track', 'Purchase', { value, currency });",
    '}',
    '',
    '/** Track a manual pageview (useful on client-side route changes). */',
    'export function trackPageview(path?: string): void {',
    "  if (typeof window === 'undefined') return;",
    '  const page = path ?? window.location.pathname + window.location.search;',
    "  getGtag()?.('event', 'page_view', { page_path: page });",
    "  getFbq()?.('track', 'PageView');",
    '}',
    '',
  ].join('\n');
}

function abTestLib(): string {
  return [
    "export type Variant = 'A' | 'B';",
    '',
    'const COOKIE_PREFIX = \'genesis_ab_\';',
    'const MAX_AGE = 60 * 60 * 24 * 30; // 30 days',
    '',
    '/** Deterministic 32-bit hash (FNV-1a) of a stable id → stable bucket. */',
    'function hash(value: string): number {',
    '  let h = 0x811c9dc5;',
    '  for (let i = 0; i < value.length; i += 1) {',
    '    h ^= value.charCodeAt(i);',
    '    h = Math.imul(h, 0x01000193);',
    '  }',
    '  return h >>> 0;',
    '}',
    '',
    'function readStored(testId: string): Variant | null {',
    "  if (typeof document === 'undefined') return null;",
    '  const key = COOKIE_PREFIX + testId;',
    '  const cookie = document.cookie',
    "    .split('; ')",
    "    .find((c) => c.startsWith(key + '='));",
    '  if (cookie) {',
    "    const v = cookie.split('=')[1];",
    "    if (v === 'A' || v === 'B') return v;",
    '  }',
    '  try {',
    '    const ls = window.localStorage.getItem(key);',
    "    if (ls === 'A' || ls === 'B') return ls;",
    '  } catch {',
    '    /* localStorage unavailable */',
    '  }',
    '  return null;',
    '}',
    '',
    'function persist(testId: string, variant: Variant): void {',
    "  if (typeof document === 'undefined') return;",
    '  const key = COOKIE_PREFIX + testId;',
    '  document.cookie = `${key}=${variant};path=/;max-age=${MAX_AGE};SameSite=Lax`;',
    '  try {',
    '    window.localStorage.setItem(key, variant);',
    '  } catch {',
    '    /* localStorage unavailable */',
    '  }',
    '}',
    '',
    '/**',
    ' * SSR-safe A/B bucketing. On the server it deterministically falls back to',
    " * variant 'A'. In the browser it reads a persisted bucket, otherwise assigns",
    ' * one deterministically from a per-visitor id and stores it.',
    ' */',
    'export function getVariant(testId: string): Variant {',
    "  if (typeof window === 'undefined') return 'A';",
    '  const existing = readStored(testId);',
    '  if (existing) return existing;',
    '  const visitorId = getVisitorId();',
    "  const variant: Variant = hash(testId + ':' + visitorId) % 2 === 0 ? 'A' : 'B';",
    '  persist(testId, variant);',
    '  return variant;',
    '}',
    '',
    'function getVisitorId(): string {',
    "  const key = COOKIE_PREFIX + 'vid';",
    '  try {',
    '    const existing = window.localStorage.getItem(key);',
    '    if (existing) return existing;',
    '    const id =',
    '      typeof crypto !== \'undefined\' && \'randomUUID\' in crypto',
    '        ? crypto.randomUUID()',
    '        : Math.random().toString(36).slice(2);',
    '    window.localStorage.setItem(key, id);',
    '    return id;',
    '  } catch {',
    '    return Math.random().toString(36).slice(2);',
    '  }',
    '}',
    '',
  ].join('\n');
}

function homeVariantComponent(): string {
  return [
    "'use client';",
    '',
    "import { useEffect, useState, type ReactNode } from 'react';",
    "import { getVariant } from '@/lib/ab-test';",
    '',
    'interface HomeVariantProps {',
    '  variantA: ReactNode;',
    '  variantB: ReactNode;',
    "  /** Defaults to the built-in 'home-hero' experiment. */",
    '  testId?: string;',
    '}',
    '',
    '/**',
    ' * Generic, SSR-safe A/B wrapper. Renders variant A on the server and during',
    ' * hydration to avoid layout shift, then swaps to the visitor’s assigned bucket',
    ' * on the client.',
    ' */',
    'export default function HomeVariant({',
    '  variantA,',
    '  variantB,',
    "  testId = 'home-hero',",
    '}: HomeVariantProps) {',
    "  const [variant, setVariant] = useState<'A' | 'B'>('A');",
    '',
    '  useEffect(() => {',
    '    setVariant(getVariant(testId));',
    '  }, [testId]);',
    '',
    "  return <>{variant === 'B' ? variantB : variantA}</>;",
    '}',
    '',
  ].join('\n');
}

function envAnalyticsExample(): string {
  return [
    '# GENESIS — Analytics & A/B (optional)',
    '# Each tool only loads when its id is set. Leave blank to disable.',
    '',
    '# Google Analytics 4 measurement id (e.g. G-XXXXXXXXXX)',
    'NEXT_PUBLIC_GA_ID=',
    '',
    '# Hotjar site id (numeric)',
    'NEXT_PUBLIC_HOTJAR_ID=',
    '',
    '# Meta (Facebook) Pixel id (numeric)',
    'NEXT_PUBLIC_META_PIXEL_ID=',
    '',
  ].join('\n');
}
