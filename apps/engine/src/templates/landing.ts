import type { TemplateBlueprint } from './types';

export const landing: TemplateBlueprint = {
  type: 'landing',
  label: 'Landing page / page de vente',
  description:
    'Page unique haute conversion pour un produit, une offre, un événement ou une capture de leads.',
  schemaType: 'WebPage',
  defaultFeatures: [
    'Hero orienté bénéfice',
    'Preuve sociale',
    'Bénéfices / fonctionnalités',
    'Offre / pricing',
    'FAQ',
    'CTA final + capture email',
  ],
  conversionGoal: 'Une seule action : conversion (achat ou capture de lead)',
  layoutHints:
    'Une seule colonne, lecture descendante guidée vers un CTA unique répété. ' +
    'Hero bénéfice + preuve sociale immédiate. Bénéfices orientés résultat. ' +
    'Offre claire avec urgence/garantie. FAQ pour lever les objections. CTA final ' +
    'plein écran. Zéro distraction, zéro lien sortant superflu.',
  needsAuth: false,
  needsPayment: false,
  sections: [
    { id: 'hero', title: 'Hero', purpose: 'Bénéfice principal + CTA unique.', required: true },
    { id: 'proof', title: 'Preuve sociale', purpose: 'Logos, chiffres, témoignages rapides.', required: true },
    { id: 'benefits', title: 'Bénéfices', purpose: 'Pourquoi agir, orienté résultat.', required: true },
    { id: 'offer', title: 'Offre', purpose: 'Détail de l’offre / prix / garantie.', required: true },
    { id: 'faq', title: 'FAQ', purpose: 'Lever les dernières objections.', required: false },
    { id: 'cta', title: 'CTA final', purpose: 'Appel à l’action + capture email.', required: true },
  ],
  files: [
    { path: 'index.html', purpose: 'Landing page complète haute conversion.' },
    { path: 'styles.css', purpose: 'Styles percutants via le design system, responsive.' },
    { path: 'script.js', purpose: 'Accordéon FAQ, animations au scroll, capture email/CTA.' },
    { path: 'chatbot.js', purpose: 'Widget chatbot IA flottant qui POST vers /api/chat.' },
  ],
};
