import type { BriefAnalysis, TranslationResult } from '@genesis/shared';
import { askJSON } from '../llm';

export interface SEOPack {
  title: string;
  metaDescription: string;
  keywords: string[];
  jsonLd: Record<string, unknown>;
  ogTitle: string;
  ogDescription: string;
}

/** Generates a localized SEO/meta pack + JSON-LD structured data. */
export async function runSEO(
  brief: BriefAnalysis,
  translation: TranslationResult,
): Promise<SEOPack> {
  return askJSON<SEOPack>({
    label: 'SEOAgent',
    maxTokens: 1200,
    system:
      'You are an international SEO specialist. Produce localized, click-worthy ' +
      'metadata and valid schema.org JSON-LD (LocalBusiness or appropriate type). ' +
      `Write all text in ${translation.languageName}.`,
    user:
      `Business: ${JSON.stringify(brief)}\n\n` +
      'Return JSON: { title, metaDescription, keywords: string[], jsonLd: object, ' +
      'ogTitle, ogDescription }',
  });
}
