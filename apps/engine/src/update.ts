import type { GenerateRequest, GeneratedSite, StreamEvent } from '@genesis/shared';
import { assessForUpdate, type UpdateAssessment } from './agents/UpdateAgent';
import { runPipeline } from './Orchestrator';

export interface UpdateCycleResult {
  assessment: UpdateAssessment;
  regenerated: boolean;
  site?: GeneratedSite;
}

/**
 * The 30-day maintenance cycle. The scheduler passes the original request, the
 * last-built date and the current date (the engine never reads the clock so runs
 * stay reproducible). We assess whether the site is dated; if so — and unless
 * `dryRun` — we regenerate it through the full pipeline and return the fresh site.
 *
 * `onEvent` receives the regeneration's stream events so a caller can show progress.
 */
export async function runUpdateCycle(opts: {
  request: GenerateRequest;
  brief: GeneratedSite['brief'];
  lastBuiltISO: string;
  dryRun?: boolean;
  onEvent?: (e: StreamEvent) => void;
}): Promise<UpdateCycleResult> {
  const assessment = await assessForUpdate({ brief: opts.brief }, opts.lastBuiltISO);

  if (!assessment.needsUpdate || opts.dryRun) {
    return { assessment, regenerated: false };
  }

  const gen = runPipeline(opts.request);
  let step = await gen.next();
  while (!step.done) {
    opts.onEvent?.(step.value);
    step = await gen.next();
  }

  return { assessment, regenerated: true, site: step.value };
}
