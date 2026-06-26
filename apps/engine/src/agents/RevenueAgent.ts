import type { BriefAnalysis, CompetitorReport, SiteType } from '@genesis/shared';
import { askJSON } from '../llm';

/**
 * RevenueAgent — predicts the revenue a generated site can realistically reach
 * BEFORE a single line of code is written, so the client sees the upside first.
 *
 * The prediction is produced by Claude acting as a market analyst (sector,
 * location, audience, local market size, competitor positioning and any
 * distilled sector `insights`). Every number coming back from the model is
 * re-validated and, where needed, recomputed deterministically so the shape is
 * always internally consistent (12 ascending monthly points, year-1 = Σ months,
 * bestCase > expected > worstCase, confidence ∈ [0,1]). If the LLM call fails
 * for any reason we fall back to a fully deterministic sector heuristic — this
 * function never throws.
 */
export interface RevenuePrediction {
  trafficMonth1: number;
  trafficMonth6: number;
  conversionRate: number; // 0..1
  averageBasket: number; // EUR
  revenueMonth1: number;
  revenueMonth6: number;
  revenueYear1: number;
  confidence: number; // 0..1
  assumptions: string[];
  bestCase: number; // year-1 optimistic
  worstCase: number; // year-1 pessimistic
  monthly: Array<{ month: number; traffic: number; revenue: number }>; // exactly 12 points for charts
  breakEvenMonths: number;
}

/** Raw, untrusted shape the LLM is asked to return. Every field is optional. */
interface RawPrediction {
  trafficMonth1?: number;
  trafficMonth6?: number;
  conversionRate?: number;
  averageBasket?: number;
  revenueYear1?: number;
  confidence?: number;
  assumptions?: string[];
  bestCaseMultiplier?: number; // optimistic factor vs expected (e.g. 1.5)
  worstCaseMultiplier?: number; // pessimistic factor vs expected (e.g. 0.6)
  monthlyFixedCost?: number; // EUR/month — used to derive break-even
}

/** Sector heuristics powering the deterministic fallback and sane clamping. */
interface SectorBaseline {
  trafficMonth1: number;
  growth: number; // monthly compound traffic growth
  conversionRate: number; // 0..1
  averageBasket: number; // EUR
  monthlyFixedCost: number; // EUR/month
}

const SECTOR_BASELINES: Record<SiteType, SectorBaseline> = {
  ecommerce: { trafficMonth1: 1200, growth: 0.18, conversionRate: 0.02, averageBasket: 65, monthlyFixedCost: 800 },
  saas: { trafficMonth1: 600, growth: 0.22, conversionRate: 0.03, averageBasket: 49, monthlyFixedCost: 1500 },
  booking: { trafficMonth1: 800, growth: 0.16, conversionRate: 0.05, averageBasket: 55, monthlyFixedCost: 600 },
  restaurant: { trafficMonth1: 900, growth: 0.12, conversionRate: 0.06, averageBasket: 35, monthlyFixedCost: 500 },
  salon: { trafficMonth1: 700, growth: 0.14, conversionRate: 0.07, averageBasket: 45, monthlyFixedCost: 450 },
  portfolio: { trafficMonth1: 350, growth: 0.1, conversionRate: 0.04, averageBasket: 900, monthlyFixedCost: 200 },
  blog: { trafficMonth1: 500, growth: 0.2, conversionRate: 0.01, averageBasket: 25, monthlyFixedCost: 150 },
  landing: { trafficMonth1: 1000, growth: 0.15, conversionRate: 0.04, averageBasket: 80, monthlyFixedCost: 400 },
};

const MONTHS = 12;

const round = (n: number): number => Math.round(n);
const round2 = (n: number): number => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** A finite, strictly-positive number or the provided fallback. */
function posNum(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Build a deterministic 12-point traffic curve that passes through the given
 * month-1 and month-6 anchors using a constant compound growth rate, then keeps
 * that growth (gently damped) through month 12. Points are guaranteed ascending.
 */
function buildTrafficCurve(trafficMonth1: number, trafficMonth6: number, fallbackGrowth: number): number[] {
  const start = Math.max(1, trafficMonth1);
  const sixth = Math.max(start, trafficMonth6);
  // Growth solving start * g^5 = sixth; guard against degenerate inputs.
  let growth = sixth > start ? (sixth / start) ** (1 / 5) : 1 + fallbackGrowth;
  growth = clamp(growth, 1.0, 2.0);

  const curve: number[] = [];
  let traffic = start;
  for (let month = 1; month <= MONTHS; month += 1) {
    if (month <= 6) {
      traffic = start * growth ** (month - 1);
    } else {
      // Damp growth slightly past month 6 so projections stay credible.
      traffic = curve[5] * (1 + (growth - 1) * 0.7) ** (month - 6);
    }
    // Enforce strict ascent against floating-point noise.
    const prev = curve[month - 2] ?? 0;
    curve.push(round(Math.max(traffic, prev + 1)));
  }
  return curve;
}

/**
 * Normalize any (possibly partial) prediction into a fully consistent
 * RevenuePrediction. The monthly series is the single source of truth: monthly
 * revenue = traffic × conversionRate × averageBasket, and year-1 = Σ monthly.
 */
function normalize(raw: RawPrediction, baseline: SectorBaseline): RevenuePrediction {
  const conversionRate = clamp(posNum(raw.conversionRate, baseline.conversionRate), 0.001, 1);
  const averageBasket = round2(posNum(raw.averageBasket, baseline.averageBasket));
  const trafficMonth1 = round(posNum(raw.trafficMonth1, baseline.trafficMonth1));
  const trafficMonth6 = round(
    posNum(raw.trafficMonth6, trafficMonth1 * (1 + baseline.growth) ** 5),
  );

  const curve = buildTrafficCurve(trafficMonth1, trafficMonth6, baseline.growth);
  const monthly = curve.map((traffic, i) => ({
    month: i + 1,
    traffic,
    revenue: round2(traffic * conversionRate * averageBasket),
  }));

  const revenueYear1 = round2(monthly.reduce((sum, m) => sum + m.revenue, 0));
  const revenueMonth1 = monthly[0].revenue;
  const revenueMonth6 = monthly[5].revenue;

  const bestMult = clamp(posNum(raw.bestCaseMultiplier, 1.5), 1.05, 3);
  const worstMult = clamp(posNum(raw.worstCaseMultiplier, 0.6), 0.1, 0.95);
  const bestCase = round2(revenueYear1 * bestMult);
  const worstCase = round2(revenueYear1 * worstMult);

  const monthlyFixedCost = posNum(raw.monthlyFixedCost, baseline.monthlyFixedCost);
  const breakEvenMonths = computeBreakEven(monthly, monthlyFixedCost);

  const cleanedAssumptions = Array.isArray(raw.assumptions)
    ? raw.assumptions.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    : [];
  const assumptions =
    cleanedAssumptions.length > 0
      ? cleanedAssumptions
      : defaultAssumptions(conversionRate, averageBasket, monthlyFixedCost);

  return {
    trafficMonth1: monthly[0].traffic,
    trafficMonth6: monthly[5].traffic,
    conversionRate: round2(conversionRate),
    averageBasket,
    revenueMonth1,
    revenueMonth6,
    revenueYear1,
    confidence: clamp(posNum(raw.confidence, 0.7), 0, 1),
    assumptions,
    bestCase,
    worstCase,
    monthly,
    breakEvenMonths,
  };
}

/** First month at which cumulative revenue covers cumulative fixed costs. */
function computeBreakEven(
  monthly: Array<{ month: number; revenue: number }>,
  monthlyFixedCost: number,
): number {
  let cumulativeRevenue = 0;
  for (const m of monthly) {
    cumulativeRevenue += m.revenue;
    if (cumulativeRevenue >= monthlyFixedCost * m.month) {
      return m.month;
    }
  }
  return MONTHS; // not yet profitable within year 1 → report the horizon
}

function defaultAssumptions(conversionRate: number, averageBasket: number, fixedCost: number): string[] {
  return [
    `Taux de conversion de ${(conversionRate * 100).toFixed(1)} % aligné sur le secteur.`,
    `Panier moyen de ${Math.round(averageBasket)} € par transaction.`,
    `Coûts fixes mensuels estimés à ${Math.round(fixedCost)} € (hébergement, marketing, outils).`,
    'Croissance du trafic portée par le SEO et une acquisition régulière les six premiers mois.',
  ];
}

function baselineFor(analysis: BriefAnalysis): SectorBaseline {
  return SECTOR_BASELINES[analysis.type] ?? SECTOR_BASELINES.landing;
}

/** Deterministic, never-throwing fallback built purely from sector heuristics. */
function fallbackPrediction(analysis: BriefAnalysis, insights?: PredictInput['insights']): RevenuePrediction {
  const baseline = baselineFor(analysis);
  const raw: RawPrediction = {
    trafficMonth1: baseline.trafficMonth1,
    trafficMonth6: round(baseline.trafficMonth1 * (1 + baseline.growth) ** 5),
    conversionRate:
      insights?.avgConversionRate && insights.avgConversionRate > 0
        ? insights.avgConversionRate
        : baseline.conversionRate,
    averageBasket: baseline.averageBasket,
    confidence: 0.55, // deterministic heuristic → modest confidence
    monthlyFixedCost: baseline.monthlyFixedCost,
  };
  return normalize(raw, baseline);
}

export interface PredictInput {
  analysis: BriefAnalysis;
  competitors?: CompetitorReport;
  /** Optional distilled sector insights (structural — never import LearningAgent). */
  insights?: { patterns: string[]; avgConversionRate?: number; sampleSize?: number };
}

/**
 * Predict the revenue trajectory of the site described by `analysis`. Always
 * resolves to a consistent RevenuePrediction — falling back to deterministic
 * sector heuristics if the model call fails.
 */
export async function predictRevenue(input: PredictInput): Promise<RevenuePrediction> {
  const { analysis, competitors, insights } = input;
  const baseline = baselineFor(analysis);

  const location = analysis.location;
  const competitorBlock = competitors
    ? `Positionnement concurrentiel : ${competitors.positioning}\n` +
      `Faiblesses majeures à exploiter : ${competitors.topWeaknesses.join('; ')}`
    : 'Aucune donnée concurrentielle live — raisonne à partir de ta connaissance du secteur.';

  const insightsBlock = insights
    ? `Insights sectoriels distillés (n=${insights.sampleSize ?? 'n/a'}) :\n` +
      `- Patterns : ${insights.patterns.join('; ')}\n` +
      (insights.avgConversionRate
        ? `- Taux de conversion moyen observé : ${(insights.avgConversionRate * 100).toFixed(2)} %`
        : '- Taux de conversion moyen : non disponible')
    : 'Aucun insight sectoriel historique disponible.';

  try {
    const raw = await askJSON<RawPrediction>({
      label: 'RevenueAgent',
      maxTokens: 1500,
      system:
        'Tu es analyste de marché senior spécialisé dans la performance des sites web. ' +
        "À partir du secteur, de la localisation, de l'audience, du prix et du taux de " +
        'conversion moyens du secteur, de la taille du marché local et du positionnement ' +
        'concurrentiel, tu estimes des prévisions de revenus RÉALISTES et prudentes pour ' +
        'la première année. Ne surévalue jamais : base-toi sur des benchmarks crédibles ' +
        'du secteur et de la zone géographique. Toutes les valeurs monétaires sont en euros.',
      user:
        `Secteur : ${analysis.sector}\n` +
        `Type de site : ${analysis.type}\n` +
        `Audience cible : ${analysis.audience}\n` +
        `Proposition de valeur : ${analysis.valueProposition}\n` +
        `Localisation : ${location.city ?? '—'}, ${location.country ?? '—'} (locale ${location.locale})\n` +
        `Paiement en ligne : ${analysis.needsPayment ? 'oui' : 'non'}\n\n` +
        `${competitorBlock}\n\n${insightsBlock}\n\n` +
        'Réponds en JSON STRICT avec exactement cette forme :\n' +
        '{\n' +
        '  "trafficMonth1": number,        // visiteurs uniques au mois 1\n' +
        '  "trafficMonth6": number,        // visiteurs uniques au mois 6\n' +
        '  "conversionRate": number,       // entre 0 et 1\n' +
        '  "averageBasket": number,        // panier moyen en euros\n' +
        '  "confidence": number,           // entre 0 et 1\n' +
        '  "assumptions": string[],        // 3 à 5 hypothèses chiffrées\n' +
        '  "bestCaseMultiplier": number,   // facteur optimiste vs attendu (ex 1.5)\n' +
        '  "worstCaseMultiplier": number,  // facteur pessimiste vs attendu (ex 0.6)\n' +
        '  "monthlyFixedCost": number      // coûts fixes mensuels en euros\n' +
        '}',
    });

    return normalize(raw, baseline);
  } catch {
    // The model call (or its JSON) failed after retries — degrade gracefully.
    return fallbackPrediction(analysis, insights);
  }
}

/**
 * Current calibrated accuracy of the revenue model, in [0,1]. Returns a
 * deterministic 0.8 today; this will be recomputed from real LearningAgent
 * outcome data (predicted vs realized revenue) once enough sites have shipped.
 */
export async function getPredictionAccuracy(): Promise<number> {
  return 0.8;
}
