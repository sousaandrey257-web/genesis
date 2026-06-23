import type { TemplateBlueprint } from './types';

export const saas: TemplateBlueprint = {
  type: 'saas',
  label: 'SaaS / application web',
  description:
    'Site produit pour un logiciel SaaS : explique le problème, la solution, les fonctionnalités et convertit en inscription.',
  schemaType: 'SoftwareApplication',
  defaultFeatures: [
    'Hero produit avec capture/mockup',
    'Problème → solution',
    'Fonctionnalités clés',
    'Comment ça marche (3 étapes)',
    'Grille de prix',
    'Témoignages / logos clients',
    'FAQ',
    'Inscription (auth) + paiement',
  ],
  conversionGoal: 'Inscription / essai gratuit (signup)',
  layoutHints:
    'Style produit moderne et net. Hero avec mockup applicatif + CTA "Essayer ' +
    'gratuitement". Sections bénéfices orientées résultat. Pricing en 3 paliers ' +
    'avec un plan mis en avant. FAQ en accordéon. Formulaires d’auth prêts à ' +
    'brancher (placeholders NextAuth/Supabase) et checkout prêt pour Stripe.',
  needsAuth: true,
  needsPayment: true,
  sections: [
    { id: 'hero', title: 'Hero', purpose: 'Promesse de valeur, mockup, CTA essai gratuit.', required: true },
    { id: 'problem', title: 'Problème / solution', purpose: 'Le pain point et comment le produit le résout.', required: true },
    { id: 'features', title: 'Fonctionnalités', purpose: 'Bénéfices clés en cartes avec icônes.', required: true },
    { id: 'how', title: 'Comment ça marche', purpose: 'Parcours en 3 étapes.', required: true },
    { id: 'pricing', title: 'Tarifs', purpose: 'Paliers de prix avec CTA.', required: true },
    { id: 'social', title: 'Preuve sociale', purpose: 'Témoignages, logos, chiffres.', required: false },
    { id: 'faq', title: 'FAQ', purpose: 'Objections fréquentes en accordéon.', required: true },
    { id: 'cta', title: 'CTA final', purpose: 'Inscription + formulaire auth.', required: true },
  ],
  files: [
    { path: 'index.html', purpose: 'Page produit SaaS complète.' },
    { path: 'styles.css', purpose: 'Styles produit modernes via le design system, responsive.' },
    { path: 'app.js', purpose: 'Accordéon FAQ, toggle pricing mensuel/annuel, animations.' },
    { path: 'auth.js', purpose: 'Formulaires login/signup prêts à brancher (NextAuth/Supabase).' },
    { path: 'chatbot.js', purpose: 'Widget chatbot IA flottant qui POST vers /api/chat.' },
  ],
};
