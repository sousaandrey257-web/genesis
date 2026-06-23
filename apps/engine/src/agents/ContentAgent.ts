import type { BriefAnalysis, TranslationResult } from '@genesis/shared';
import { askJSON } from '../llm';

export interface SiteContent {
  hero: { title: string; subtitle: string; cta: string };
  sections: Array<{ heading: string; body: string }>;
  faq: Array<{ q: string; a: string }>;
  testimonials: Array<{ name: string; text: string }>;
}

/**
 * Generates real, sector-appropriate copy in the client's language so the coder
 * never has to invent filler. Testimonials are clearly placeholder examples the
 * client should replace with real ones.
 */
export async function runContent(
  brief: BriefAnalysis,
  translation: TranslationResult,
): Promise<SiteContent> {
  return askJSON<SiteContent>({
    maxTokens: 2500,
    system:
      'You are a senior copywriter. Write persuasive, specific, non-generic copy ' +
      `in ${translation.languageName} for the business below. Mark testimonial ` +
      'entries as illustrative examples (use clearly placeholder names).',
    user:
      `Business: ${JSON.stringify(brief)}\n\n` +
      'Return JSON: { hero: { title, subtitle, cta }, sections: [{ heading, body }], ' +
      'faq: [{ q, a }], testimonials: [{ name, text }] }',
  });
}
