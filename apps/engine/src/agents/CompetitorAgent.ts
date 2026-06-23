import type { BriefAnalysis, CompetitorReport } from '@genesis/shared';
import { askJSON } from '../llm';
import {
  searchCompetitors,
  scrapePageText,
  isScrapingBeeConfigured,
} from '../tools/ScrapingBee';

/**
 * Step 3 — analyze the real competitive field for this sector + location.
 *
 * With SCRAPINGBEE_API_KEY set, GENESIS searches Google, scrapes the top
 * competitor pages (JS-rendered) and feeds their real content to Claude, which
 * extracts concrete weaknesses and a winning positioning. Without a key it
 * degrades to a model-only analysis so the pipeline never blocks.
 */
export async function runCompetitor(brief: BriefAnalysis): Promise<CompetitorReport> {
  const query =
    `meilleur ${brief.sector} ${brief.location.city ?? ''} ${brief.location.country ?? ''}`.trim();

  let scrapedBlock = 'Aucun scraping live disponible — raisonne à partir de ta connaissance du secteur et de la zone.';

  if (isScrapingBeeConfigured()) {
    try {
      const results = await searchCompetitors(query, 10);
      const top = results.slice(0, 5);

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
    maxTokens: 3000,
    system:
      'Tu es analyste en intelligence concurrentielle. À partir du contenu réel ' +
      'des sites concurrents, tu identifies leurs forces, leurs faiblesses ' +
      'concrètes (lenteur, design daté, SEO faible, UX mobile médiocre, absence ' +
      'de réservation/paiement, contenu générique) et tu définis un positionnement ' +
      'qui les surpasse. Sois précis et factuel — aucune métrique inventée.',
    user:
      `Secteur : ${brief.sector}\nLocalisation : ${JSON.stringify(brief.location)}\n` +
      `Audience : ${brief.audience}\n\n${scrapedBlock}\n\n` +
      'Réponds en JSON : { competitors: [{ name, url?, strengths: string[], ' +
      'weaknesses: string[] }], topWeaknesses: string[5], positioning: string, ' +
      'recommendedDifferentiators: string[] }',
  });
}
