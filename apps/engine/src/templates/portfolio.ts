import type { TemplateBlueprint } from './types';

export const portfolio: TemplateBlueprint = {
  type: 'portfolio',
  label: 'Portfolio / freelance / créatif',
  description:
    'Portfolio personnel pour freelance, designer, photographe, développeur ou artiste, optimisé pour décrocher des contrats.',
  schemaType: 'Person',
  defaultFeatures: [
    'Présentation personnelle',
    'Projets sélectionnés',
    'Compétences / services',
    'Témoignages clients',
    'Formulaire de contact',
    'Téléchargement CV',
  ],
  conversionGoal: 'Prise de contact / demande de devis',
  layoutHints:
    'Design éditorial, beaucoup d’espace blanc, typographie marquée. Hero avec nom, ' +
    'rôle et accroche. Projets en grille avec hover détaillé. Section services claire. ' +
    'Témoignages en cartes. CTA contact fort et formulaire simple.',
  needsAuth: false,
  needsPayment: false,
  sections: [
    { id: 'hero', title: 'Hero', purpose: 'Nom, métier, accroche, CTA Me contacter.', required: true },
    { id: 'about', title: 'À propos', purpose: 'Parcours, approche, photo.', required: true },
    { id: 'work', title: 'Projets', purpose: 'Réalisations sélectionnées avec contexte et résultats.', required: true },
    { id: 'skills', title: 'Compétences / services', purpose: 'Ce que je fais et comment.', required: true },
    { id: 'testimonials', title: 'Témoignages', purpose: 'Recommandations clients.', required: false },
    { id: 'contact', title: 'Contact', purpose: 'Formulaire + liens (email, LinkedIn, GitHub).', required: true },
  ],
  files: [
    { path: 'index.html', purpose: 'Portfolio complet avec projets et contact.' },
    { path: 'styles.css', purpose: 'Styles éditoriaux via le design system, responsive.' },
    { path: 'script.js', purpose: 'Filtres de projets, animations au scroll, soumission du formulaire.' },
    { path: 'chatbot.js', purpose: 'Widget chatbot IA flottant qui POST vers /api/chat.' },
  ],
};
