import type { TemplateBlueprint } from './types';

export const blog: TemplateBlueprint = {
  type: 'blog',
  label: 'Blog / magazine / média',
  description:
    'Blog ou magazine éditorial, optimisé pour la lecture, le référencement et la capture d’abonnés.',
  schemaType: 'Blog',
  defaultFeatures: [
    'Article à la une',
    'Grille d’articles',
    'Catégories / tags',
    'À propos de l’auteur',
    'Inscription newsletter',
    'Articles populaires',
  ],
  conversionGoal: 'Lecture + inscription à la newsletter',
  layoutHints:
    'Mise en page éditoriale lisible, typographie soignée, largeur de lecture ' +
    'confortable. Hero avec article à la une. Grille d’articles avec image, titre, ' +
    'extrait, catégorie et date. Filtres par catégorie. Encart auteur. Bloc ' +
    'newsletter récurrent. Les articles sont des données en JS, prêtes à brancher sur un CMS.',
  needsAuth: false,
  needsPayment: false,
  sections: [
    { id: 'hero', title: 'À la une', purpose: 'Article vedette mis en avant.', required: true },
    { id: 'articles', title: 'Articles', purpose: 'Grille d’articles avec extraits.', required: true },
    { id: 'categories', title: 'Catégories', purpose: 'Filtres / navigation par thème.', required: false },
    { id: 'popular', title: 'Populaires', purpose: 'Articles les plus lus.', required: false },
    { id: 'author', title: 'Auteur', purpose: 'Présentation de l’auteur / de la rédaction.', required: false },
    { id: 'newsletter', title: 'Newsletter', purpose: 'Capture d’email.', required: true },
  ],
  files: [
    { path: 'index.html', purpose: 'Accueil du blog avec à la une et grille d’articles.' },
    { path: 'styles.css', purpose: 'Styles éditoriaux lisibles via le design system, responsive.' },
    { path: 'posts.js', purpose: 'Données d’articles + rendu de la grille + filtres par catégorie.' },
    { path: 'chatbot.js', purpose: 'Widget chatbot IA flottant qui POST vers /api/chat.' },
  ],
};
