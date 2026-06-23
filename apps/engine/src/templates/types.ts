import type { SiteType } from '@genesis/shared';

/** One ordered section of the generated page. */
export interface SectionSpec {
  id: string;
  title: string;
  /** What this section must contain / accomplish. Fed to the CoderAgent. */
  purpose: string;
  required: boolean;
}

/**
 * A sector blueprint. Deterministically drives the architecture (file plan) and
 * informs the CoderAgent (sections, layout, conversion goal) so output is
 * complete and consistent per sector — without spending an extra LLM call to
 * "invent" structure that the sector already dictates.
 */
export interface TemplateBlueprint {
  type: SiteType;
  label: string;
  description: string;
  /** schema.org @type used by the SEOAgent for JSON-LD. */
  schemaType: string;
  /** Sector features merged into the brief before coding. */
  defaultFeatures: string[];
  /** Ordered page sections. */
  sections: SectionSpec[];
  /** Deterministic file plan (no LLM architect call needed). */
  files: { path: string; purpose: string }[];
  /** Primary conversion action the page is optimized for. */
  conversionGoal: string;
  /** Structure / UX guidance handed to the coder. */
  layoutHints: string;
  /** Whether the sector normally needs accounts / payments. */
  needsAuth: boolean;
  needsPayment: boolean;
}

export type TemplateRegistry = Record<SiteType, TemplateBlueprint>;
