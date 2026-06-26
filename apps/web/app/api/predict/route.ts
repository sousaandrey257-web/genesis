import { runTranslator, runAnalyzer, predictRevenue } from '@genesis/engine';
import type { RevenuePrediction } from '@genesis/engine';
import type { BriefAnalysis } from '@genesis/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface PredictBody {
  idea?: string;
  analysis?: BriefAnalysis;
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
