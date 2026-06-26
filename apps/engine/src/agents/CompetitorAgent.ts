import type { BriefAnalysis, CompetitorReport } from '@genesis/shared';
import { askJSON } from '../llm';
import {
  searchCompetitors,
  scrapePageText,
  isScrapingBeeConfigured,
} from '../tools/ScrapingBee';

/**
 * How many competitors each plan analyzes. Higher tiers dig deeper into the
 * competitive field. Keep in sync with apps/web/lib/plans.ts `competitors`.
 */
const COMPETITOR_TARGETS: Record<string, number> = {
  starter: 5,
  pro: 30,
  business: 100,
  enterprise: 250,
  agency: 500,
};

/** Resolve the competitor-analysis depth for a plan (defaults to 20). */
export function competitorTargetForPlan(plan?: string): number {
  return (plan && COMPETITOR_TARGETS[plan]) || 20;
}

/**
 * Step 3 — analyze the real competitive field for this sector + location.
 *
 * With SCRAPINGBEE_API_KEY set, GENESIS searches Google, scrapes the top
 * competitor pages (JS-rendered) and feeds their real content to Claude, which
 * extracts concrete weaknesses and a winning positioning. Without a key it
 * degrades to a model-only analysis so the pipeline never blocks.
 *
 * `target` is how many competitors to cover (driven by the client's plan):
 * higher tiers scrape more live pages and ask the model to map a wider field.
 */
export async function runCompetitor(
  brief: BriefAnalysis,
  target = 20,
): Promise<CompetitorReport> {
  const query =
    `meilleur ${brief.sector} ${brief.location.city ?? ''} ${brief.location.country ?? ''}`.trim();

  let scrapedBlock = 'Aucun scraping live disponible — raisonne à partir de ta connaissance du secteur et de la zone.';

  // Scrape a slice that scales with the plan (capped to keep latency/cost sane);
  // the model then maps the wider field up to `target`.
  const scrapeCount = Math.min(Math.max(5, Math.ceil(target / 5)), 25);

  if (isScrapingBeeConfigured()) {
    try {
      const results = await searchCompetitors(query, scrapeCount * 2);
      const top = results.slice(0, scrapeCount);

      const pages = await Promise.all(
        top.map(async (r) => {
          const text = await scrapePageText(r.url).catch(() => '');
          return { ...r, text };
        }),
      );

      const usable = pages.filter((p) => p.text.length > 200);
      if (usable.length) {
        scrapedBlock =
          'Contenu réel scrapé des concurrents (ScrapingBee) :\n' +
          usable
            .map(
              (p, i) =>
                `### Concurrent ${i + 1}: ${p.title}\nURL: ${p.url}\n${p.text}`,
            )
            .join('\n\n');
      }
    } catch {
      /* fall through to model-only analysis */
    }
  }

  return askJSON<CompetitorReport>({
    maxTokens: target >= 100 ? 5000 : 3000,
    label: 'CompetitorAgent',
    system:
      'Tu es analyste en intelligence concurrentielle. À partir du contenu réel ' +
      'des sites concurrents, tu identifies leurs forces, leurs faiblesses ' +
      'concrètes (lenteur, design daté, SEO faible, UX mobile médiocre, absence ' +
      'de réservation/paiement, contenu générique) et tu définis un positionnement ' +
      'qui les surpasse. Sois précis et factuel — aucune métrique inventée.',
    user:
      `Secteur : ${brief.sector}\nLocalisation : ${JSON.stringify(brief.location)}\n` +
      `Audience : ${brief.audience}\n\n${scrapedBlock}\n\n` +
      `Cartographie jusqu'à ${target} concurrents pertinents de ce secteur et de cette zone ` +
      `(les ${Math.min(target, 12)} plus significatifs détaillés nommément, le reste agrégé en tendances). ` +
      'Réponds en JSON : { competitors: [{ name, url?, strengths: string[], ' +
      'weaknesses: string[] }], topWeaknesses: string[5], positioning: string, ' +
      'recommendedDifferentiators: string[] }',
  });
}
