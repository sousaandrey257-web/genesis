import type { BriefAnalysis, GeneratedSite } from '@genesis/shared';
import { askJSON } from '../llm';

export interface UpdateAssessment {
  needsUpdate: boolean;
  reasons: string[];
  trendDelta: string[]; // what changed in the sector since last build
  recommendedChanges: string[];
}

/**
 * Step 6 (lifecycle) — run on a 30-day schedule. Compares an existing site to
 * current sector trends and decides whether to regenerate + redeploy.
 *
 * `lastBuiltISO` is passed in by the scheduler (the engine never reads the clock
 * itself so runs stay reproducible/testable).
 */
export async function assessForUpdate(
  site: Pick<GeneratedSite, 'brief'> & { brief: BriefAnalysis },
  lastBuiltISO: string,
): Promise<UpdateAssessment> {
  return askJSON<UpdateAssessment>({
    maxTokens: 1200,
    system:
      'You are a design-trend analyst. Given a site built on a known date and its ' +
      'sector, judge whether it looks dated against current best practices and ' +
      'should be regenerated. Be conservative — only recommend updates that matter.',
    user:
      `Sector: ${site.brief.sector}\nTone: ${site.brief.tone}\n` +
      `Last built: ${lastBuiltISO}\n\n` +
      'Return JSON: { needsUpdate: boolean, reasons: string[], ' +
      'trendDelta: string[], recommendedChanges: string[] }',
  });
}
