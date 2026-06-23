import type { GeneratedFile } from '@genesis/shared';
import { askJSON } from '../llm';

export interface ReviewResult {
  passed: boolean;
  score: number; // 0–100
  issues: string[];
  fixedFiles?: GeneratedFile[];
}

/**
 * Step 6 — review generated files for broken markup, missing alt text, contrast,
 * responsiveness and obvious bugs. Returns a score and a list of issues.
 */
export async function runReviewer(files: GeneratedFile[]): Promise<ReviewResult> {
  const manifest = files
    .map((f) => `── ${f.path} (${f.content.length} chars) ──\n${f.content.slice(0, 4000)}`)
    .join('\n\n');

  return askJSON<ReviewResult>({
    maxTokens: 1500,
    system:
      'You are a meticulous QA reviewer. You check HTML/CSS/JS for valid structure, ' +
      'accessibility (alt text, labels, contrast, focus), responsiveness, broken ' +
      'links, and runtime errors. You score 0–100 and list concrete issues. ' +
      'passed = score >= 80 with no critical issue.',
    user:
      `Review these generated files:\n\n${manifest}\n\n` +
      'Return JSON: { passed: boolean, score: number, issues: string[] }',
  });
}
