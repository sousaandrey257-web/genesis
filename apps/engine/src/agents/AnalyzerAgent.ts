import type { BriefAnalysis } from '@genesis/shared';
import { askJSON } from '../llm';

/**
 * Step 2 — deeply understand the idea: type, sector, audience, tone, features,
 * location, and whether it needs auth/payment (i.e. a real SaaS vs a site).
 */
export async function runAnalyzer(
  englishBrief: string,
  locale: string,
): Promise<BriefAnalysis> {
  return askJSON<BriefAnalysis>({
    maxTokens: 1500,
    system:
      'You are a senior product strategist. From a one-line business idea you ' +
      'infer a precise, buildable specification. Choose `type` from exactly: ' +
      'salon, restaurant, ecommerce, portfolio, saas, booking, blog, landing. ' +
      'Choose `tone` from exactly: luxury, playful, corporate, minimal, bold, warm. ' +
      'Set needsAuth/needsPayment true only when the product genuinely requires ' +
      'accounts or transactions.',
    user:
      `Brief: "${englishBrief}"\nDefault locale if none stated: "${locale}".\n\n` +
      'Return JSON matching this TypeScript type exactly:\n' +
      '{ type, sector, audience, tone, features: string[], ' +
      'location: { city?, country?, locale }, businessName, valueProposition, ' +
      'needsAuth: boolean, needsPayment: boolean }',
  });
}
