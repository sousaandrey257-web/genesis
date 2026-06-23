import type { BriefAnalysis, CompetitorReport } from '@genesis/shared';
import { askJSON } from '../llm';

export interface FilePlan {
  path: string;
  purpose: string;
}

export interface ArchitecturePlan {
  framework: 'next' | 'static';
  files: FilePlan[];
  pages: string[];
  notes: string;
}

/**
 * Step 4.5 — decide the file structure of the generated site before any code is
 * written, informed by the brief and the competitor gaps to exploit.
 */
export async function runArchitect(
  brief: BriefAnalysis,
  competitor: CompetitorReport,
): Promise<ArchitecturePlan> {
  return askJSON<ArchitecturePlan>({
    maxTokens: 2000,
    system:
      'You are a senior front-end architect. You plan the minimal, complete file ' +
      'set for a single-page (optionally multi-section) production website built ' +
      'as a self-contained index.html with embedded CSS and JS (no build step) so ' +
      'it deploys instantly. Keep it tight: usually index.html plus optional ' +
      'styles.css, script.js, and a chatbot widget. Each file needs a clear purpose.',
    user:
      `Brief: ${JSON.stringify(brief)}\n` +
      `Exploit these competitor weaknesses: ${competitor.topWeaknesses.join('; ')}\n\n` +
      'Return JSON: { framework: "static", files: [{ path, purpose }], ' +
      'pages: string[], notes: string }',
  });
}
