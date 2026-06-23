import type { BriefAnalysis, SiteType } from '@genesis/shared';
import type { TemplateBlueprint, TemplateRegistry } from './types';
import type { ArchitecturePlan } from '../agents/ArchitectAgent';
import { salon } from './salon';
import { restaurant } from './restaurant';
import { ecommerce } from './ecommerce';
import { portfolio } from './portfolio';
import { saas } from './saas';
import { booking } from './booking';
import { blog } from './blog';
import { landing } from './landing';

export type { TemplateBlueprint, SectionSpec } from './types';

/** All 8 sector blueprints, keyed by SiteType. */
export const TEMPLATES: TemplateRegistry = {
  salon,
  restaurant,
  ecommerce,
  portfolio,
  saas,
  booking,
  blog,
  landing,
};

export function getTemplate(type: SiteType): TemplateBlueprint {
  return TEMPLATES[type] ?? landing; // landing is the safe high-conversion default
}

/**
 * Turn a blueprint into a concrete architecture plan — deterministically, with
 * no LLM call. The required sections are listed so the coder knows exactly what
 * to build into index.html.
 */
export function templateToPlan(template: TemplateBlueprint): ArchitecturePlan {
  return {
    framework: 'static',
    files: template.files,
    pages: ['index.html'],
    notes:
      `Sector: ${template.label}. Conversion goal: ${template.conversionGoal}. ` +
      `Sections (in order): ${template.sections.map((s) => s.id).join(' → ')}.`,
  };
}

/**
 * Merge a template's sector defaults into the analyzed brief: union the feature
 * lists and inherit auth/payment needs the sector implies.
 */
export function applyTemplateToBrief(
  brief: BriefAnalysis,
  template: TemplateBlueprint,
): BriefAnalysis {
  const features = Array.from(new Set([...brief.features, ...template.defaultFeatures]));
  return {
    ...brief,
    features,
    needsAuth: brief.needsAuth || template.needsAuth,
    needsPayment: brief.needsPayment || template.needsPayment,
  };
}
