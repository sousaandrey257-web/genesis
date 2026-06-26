import type { BriefAnalysis, DesignSystem } from '@genesis/shared';
import { askJSON } from '../llm';
import { supabaseAdmin } from '../lib/supabase';

// ─── Contracts ──────────────────────────────────────────────────────

/**
 * One row of evidence about a generated site: its design, its measured
 * quality, and (when available) real-world outcomes. This is the raw fuel
 * GENESIS distills into reusable patterns.
 *
 * `BriefAnalysis` / `DesignSystem` are imported type-only — the sector and
 * tokens recorded here typically originate from those agent outputs.
 */
export interface Learning {
  siteId: string;
  sector: string;
  designTokens: Record<string, unknown>;
  qualityScore: number;
  clientRating?: number;
  visitors30d?: number;
  conversions30d?: number;
  revenue30d?: number;
  whatWorked?: string[];
  whatFailed?: string[];
}

/** Distilled, injectable knowledge for a single sector. */
export interface SectorInsights {
  sector: string;
  sampleSize: number;
  patterns: string[]; // distilled, human-readable patterns to inject into the coder brief
  avgQuality: number;
  avgConversionRate?: number;
  briefAugmentation: string; // one paragraph appended to the CoderAgent system prompt
}

/** Monthly self-analysis of what GENESIS learned and how to improve. */
export interface LearningReport {
  period: string;
  summary: string;
  learned: string[];
  improvements: string[];
}

// ─── Internal row shape (snake_case, mirrors 0002_learnings.sql) ─────

interface LearningRow {
  site_id: string;
  sector: string | null;
  design_tokens: Record<string, unknown> | null;
  quality_score: number | null;
  client_rating: number | null;
  visitors_30d: number | null;
  conversions_30d: number | null;
  revenue_30d: number | null;
  what_worked: string[] | null;
  what_failed: string[] | null;
  created_at?: string;
}

function clampRating(rating: number | undefined): number | null {
  if (rating === undefined || Number.isNaN(rating)) return null;
  return Math.max(1, Math.min(5, Math.round(rating)));
}

function conversionRate(row: Pick<LearningRow, 'visitors_30d' | 'conversions_30d'>): number | null {
  if (!row.visitors_30d || row.visitors_30d <= 0 || row.conversions_30d == null) return null;
  return row.conversions_30d / row.visitors_30d;
}

// ─── Step 13 — persist a learning ───────────────────────────────────

/**
 * Persist what we learned from a generated site. Upserts into
 * public.learnings (keyed by site_id) so re-recording outcomes for the same
 * site overwrites the prior snapshot. Guarded: when Supabase is unconfigured
 * we return `{ saved:false }` instead of throwing, so the pipeline never
 * fails just because persistence is unavailable.
 */
export async function recordLearning(
  input: Learning,
): Promise<{ saved: boolean; note: string }> {
  const client = supabaseAdmin();
  if (!client) {
    return { saved: false, note: 'Supabase non configuré — learning ignoré' };
  }

  const row: LearningRow = {
    site_id: input.siteId,
    sector: input.sector || null,
    design_tokens: input.designTokens ?? null,
    quality_score: Number.isFinite(input.qualityScore) ? Math.round(input.qualityScore) : null,
    client_rating: clampRating(input.clientRating),
    visitors_30d: input.visitors30d ?? null,
    conversions_30d: input.conversions30d ?? null,
    revenue_30d: input.revenue30d ?? null,
    what_worked: input.whatWorked ?? null,
    what_failed: input.whatFailed ?? null,
  };

  try {
    const { error } = await client
      .from('learnings')
      .upsert(row, { onConflict: 'site_id' });
    if (error) {
      return { saved: false, note: `Échec de l'enregistrement: ${error.message}` };
    }
    return { saved: true, note: `Learning enregistré pour ${input.siteId}` };
  } catch (err) {
    return {
      saved: false,
      note: `Échec de l'enregistrement: ${(err as Error)?.message ?? String(err)}`,
    };
  }
}

// ─── Step 2.5 — consult the sector & distill patterns ───────────────

/**
 * Consult the top sites of this sector and distill injectable patterns.
 * Always returns a usable result: with data we ask Claude to distill the
 * winning rows into concrete, human-readable patterns; without data (no
 * Supabase, zero rows, or any error) we fall back to sector heuristics so the
 * pipeline always has something to inject into the CoderAgent brief.
 */
export async function getSectorInsights(
  sector: string,
  limit = 50,
): Promise<SectorInsights> {
  const client = supabaseAdmin();
  if (!client) return sectorFallback(sector);

  let rows: LearningRow[] = [];
  try {
    const { data, error } = await client
      .from('learnings')
      .select(
        'site_id, sector, design_tokens, quality_score, client_rating, visitors_30d, conversions_30d, revenue_30d, what_worked, what_failed, created_at',
      )
      .eq('sector', sector)
      .order('quality_score', { ascending: false })
      .order('conversions_30d', { ascending: false })
      .limit(Math.max(1, limit));
    if (error || !data) return sectorFallback(sector);
    rows = data as LearningRow[];
  } catch {
    return sectorFallback(sector);
  }

  if (rows.length === 0) return sectorFallback(sector);

  const qualities = rows
    .map((r) => r.quality_score)
    .filter((q): q is number => typeof q === 'number');
  const avgQuality = qualities.length
    ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length)
    : 0;

  const rates = rows
    .map((r) => conversionRate(r))
    .filter((r): r is number => r != null);
  const avgConversionRate = rates.length
    ? rates.reduce((a, b) => a + b, 0) / rates.length
    : undefined;

  // Compact, token-cheap evidence for the model.
  const evidence = rows.slice(0, limit).map((r) => ({
    quality: r.quality_score,
    rating: r.client_rating,
    visitors: r.visitors_30d,
    conversions: r.conversions_30d,
    revenue: r.revenue_30d,
    worked: r.what_worked ?? [],
    failed: r.what_failed ?? [],
    tokens: r.design_tokens ?? {},
  }));

  try {
    const distilled = await askJSON<{ patterns: string[]; briefAugmentation: string }>({
      label: 'LearningAgent.getSectorInsights',
      maxTokens: 1200,
      system:
        'You are the optimization brain of GENESIS, a website-generation engine. ' +
        'Given outcome data from previously generated sites in one sector, distill ' +
        'concrete, actionable design and conversion patterns that made the best ' +
        'sites win. Be specific and sector-relevant (e.g. "réservation en header ' +
        'convertit mieux", "galerie avant/après augmente la confiance"). Write in ' +
        'French. Patterns must be short imperative phrases a developer can apply.',
      user:
        `Secteur: ${sector}\n` +
        `Échantillon: ${rows.length} sites (triés par qualité puis conversions).\n` +
        `Données: ${JSON.stringify(evidence)}\n\n` +
        'Retourne du JSON: { "patterns": string[] (5 à 8 patterns gagnants, concrets), ' +
        '"briefAugmentation": string (un seul paragraphe, prêt à être ajouté au prompt ' +
        'système du générateur de code, qui résume comment construire un site gagnant ' +
        `pour le secteur "${sector}") }`,
    });

    const patterns = (distilled.patterns ?? [])
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    return {
      sector,
      sampleSize: rows.length,
      patterns: patterns.length ? patterns : sectorFallback(sector).patterns,
      avgQuality,
      avgConversionRate,
      briefAugmentation:
        distilled.briefAugmentation?.trim() || sectorFallback(sector).briefAugmentation,
    };
  } catch {
    const fallback = sectorFallback(sector);
    return { ...fallback, sampleSize: rows.length, avgQuality, avgConversionRate };
  }
}

// ─── Monthly self-analysis report ───────────────────────────────────

/**
 * Monthly self-analysis. Reads the most recent learnings (if any) and asks
 * Claude to summarize what GENESIS learned and how it should improve. Falls
 * back to a deterministic report when there is no data or the LLM errors.
 */
export async function monthlyLearningReport(periodISO: string): Promise<LearningReport> {
  const client = supabaseAdmin();
  if (!client) return emptyReport(periodISO, 'Supabase non configuré');

  let rows: LearningRow[] = [];
  try {
    const { data, error } = await client
      .from('learnings')
      .select(
        'site_id, sector, quality_score, client_rating, visitors_30d, conversions_30d, revenue_30d, what_worked, what_failed, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(100);
    if (error || !data) return emptyReport(periodISO, 'Aucune donnée disponible');
    rows = data as LearningRow[];
  } catch {
    return emptyReport(periodISO, 'Aucune donnée disponible');
  }

  if (rows.length === 0) return emptyReport(periodISO, 'Aucune donnée disponible');

  const bySector = new Map<string, number>();
  for (const r of rows) {
    const key = r.sector ?? 'inconnu';
    bySector.set(key, (bySector.get(key) ?? 0) + 1);
  }
  const sectorCounts = Object.fromEntries(bySector);

  const compact = rows.map((r) => ({
    sector: r.sector,
    quality: r.quality_score,
    rating: r.client_rating,
    visitors: r.visitors_30d,
    conversions: r.conversions_30d,
    worked: r.what_worked ?? [],
    failed: r.what_failed ?? [],
  }));

  try {
    return await askJSON<LearningReport>({
      label: 'LearningAgent.monthlyLearningReport',
      maxTokens: 1500,
      system:
        'You are the self-improvement brain of GENESIS, a website-generation ' +
        'engine. Analyze the last ~100 generated sites and their outcomes. Produce ' +
        'a concise monthly report in French: what worked, what failed, and the ' +
        'concrete improvements GENESIS should make to generate better-converting ' +
        'sites next month. Be specific and grounded in the data.',
      user:
        `Période: ${periodISO}\n` +
        `Sites analysés: ${rows.length}\n` +
        `Répartition par secteur: ${JSON.stringify(sectorCounts)}\n` +
        `Données: ${JSON.stringify(compact)}\n\n` +
        `Retourne du JSON: { "period": "${periodISO}", "summary": string (2-3 phrases), ` +
        '"learned": string[] (5 à 8 enseignements concrets), "improvements": string[] ' +
        '(4 à 6 améliorations actionnables) }',
    });
  } catch {
    return {
      period: periodISO,
      summary: `Analyse de ${rows.length} sites générés ce mois-ci sur ${bySector.size} secteurs.`,
      learned: rows
        .flatMap((r) => r.what_worked ?? [])
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 8),
      improvements: rows
        .flatMap((r) => r.what_failed ?? [])
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 6),
    };
  }
}

// ─── Fallbacks ──────────────────────────────────────────────────────

/**
 * Heuristic insight derived purely from the sector name — used whenever there
 * is no learning data to consult. Generic but always relevant, so the coder
 * brief is never empty.
 */
function sectorFallback(sector: string): SectorInsights {
  const s = sector.trim() || 'général';
  return {
    sector: s,
    sampleSize: 0,
    patterns: [
      `Mettre en avant un appel à l'action clair et visible dès le header pour le secteur ${s}.`,
      'Afficher des preuves sociales (avis, notes, témoignages) au-dessus de la ligne de flottaison.',
      'Optimiser pour le mobile en priorité : la majorité des visiteurs arrivent sur smartphone.',
      'Réduire la friction du contact : téléphone cliquable, formulaire court, bouton WhatsApp.',
      `Utiliser un visuel hero authentique et spécifique au secteur ${s} plutôt qu'une image générique.`,
      'Charger vite : images optimisées et au-dessus de la ligne de flottaison en priorité.',
    ],
    avgQuality: 0,
    avgConversionRate: undefined,
    briefAugmentation:
      `Aucune donnée d'apprentissage n'est encore disponible pour le secteur "${s}". ` +
      'Applique les meilleures pratiques de conversion: un appel à l\'action proéminent dès ' +
      'le premier écran, des preuves sociales visibles tôt, un parcours de contact sans ' +
      'friction (téléphone et WhatsApp cliquables), une approche mobile-first, et un visuel ' +
      'hero crédible et spécifique au secteur. Privilégie la clarté, la rapidité de chargement ' +
      'et la confiance.',
  };
}

function emptyReport(period: string, reason: string): LearningReport {
  return {
    period,
    summary: `${reason}. GENESIS n'a pas encore assez de données pour un rapport d'apprentissage ce mois-ci.`,
    learned: [],
    improvements: [
      'Collecter les retours clients (note de 1 à 5) après chaque génération.',
      'Brancher les analytics (visiteurs et conversions sur 30 jours) sur les sites livrés.',
      'Enregistrer un learning par site généré pour alimenter les insights par secteur.',
    ],
  };
}
