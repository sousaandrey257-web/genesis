import type { TranslationResult } from '@genesis/shared';
import { askJSON } from '../llm';

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

/**
 * Step 1 — detect the language of the raw idea (50+ languages incl. Wolof,
 * Bambara, Lingala, Swahili, Arabic, Hindi, Mandarin, …) and normalize it to
 * an English brief so every downstream agent works in one language.
 */
export async function runTranslator(idea: string): Promise<TranslationResult> {
  const result = await askJSON<{
    detectedLanguage: string;
    languageName: string;
    englishText: string;
  }>({
    system:
      'You are a world-class polyglot. You detect any human language including ' +
      'low-resource African languages (Wolof, Bambara, Lingala, Swahili), Arabic, ' +
      'Hindi, Mandarin and all European and Asian languages. You translate the ' +
      'user’s business idea into a clear, complete English brief, preserving ' +
      'every concrete detail (business name, city, sector, intent).',
    user:
      `Detect the language and translate this idea to English.\n\nIDEA: "${idea}"\n\n` +
      'Return JSON: { "detectedLanguage": ISO-639 code, "languageName": string, "englishText": string }',
  });

  return {
    detectedLanguage: result.detectedLanguage,
    languageName: result.languageName,
    originalText: idea,
    englishText: result.englishText,
    isRtl: RTL_LANGS.has(result.detectedLanguage),
  };
}
