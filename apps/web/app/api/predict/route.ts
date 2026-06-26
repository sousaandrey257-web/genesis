import { runTranslator, runAnalyzer, predictRevenue } from '@genesis/engine';
import type { RevenuePrediction } from '@genesis/engine';
import type { BriefAnalysis } from '@genesis/shared';
import { isDemoMode, demoPrediction, type Lang } from '@/lib/demo';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface PredictBody {
  idea?: string;
  analysis?: BriefAnalysis;
  lang?: Lang;
}

/**
 * Predict the revenue a site could generate BEFORE building it.
 *
 * POST { analysis } → predicts directly from the supplied brief.
 * POST { idea }     → translates + analyzes the idea into a brief first, then
 *                     predicts. Always returns a RevenuePrediction JSON, or a
 *                     500 with { error } if the pipeline fails unexpectedly.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as PredictBody;
    const lang: Lang = body.lang === 'en' ? 'en' : 'fr';

    // Demo mode: instant example projection, no Anthropic key needed.
    if (isDemoMode()) {
      return Response.json(demoPrediction(body.idea ?? '', lang));
    }

    let analysis: BriefAnalysis | undefined = body.analysis;

    if (!analysis) {
      const idea = body.idea?.trim();
      if (!idea || idea.length < 3) {
        return Response.json({ error: 'idea or analysis is required' }, { status: 400 });
      }
      const translation = await runTranslator(idea);
      analysis = await runAnalyzer(translation.englishText, translation.detectedLanguage);
    }

    const prediction: RevenuePrediction = await predictRevenue({ analysis });
    return Response.json(prediction);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'prediction failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
