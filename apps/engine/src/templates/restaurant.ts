import type { TemplateBlueprint } from './types';

export const restaurant: TemplateBlueprint = {
  type: 'restaurant',
  label: 'Restaurant / café / traiteur',
  description:
    'Site vitrine gourmand pour restaurant, café ou traiteur, optimisé pour la réservation de table et la consultation du menu.',
  schemaType: 'Restaurant',
  defaultFeatures: [
    'Menu structuré par catégories avec prix',
    'Galerie de plats',
    'Histoire / chef',
    'Réservation de table',
    'Horaires + plan d’accès',
    'Avis Google / TripAdvisor',
  ],
  conversionGoal: 'Réservation de table (et consultation du menu)',
  layoutHints:
    'Ambiance chaleureuse et appétissante, photos plein cadre. Hero avec photo ' +
    'signature + CTA "Réserver une table". Menu lisible en colonnes par catégorie ' +
    '(entrées/plats/desserts). Section histoire avec le chef. Bandeau horaires + carte.',
  needsAuth: false,
  needsPayment: false,
  sections: [
    { id: 'hero', title: 'Hero', purpose: 'Nom, accroche gourmande, photo signature, CTA Réserver.', required: true },
    { id: 'menu', title: 'Menu', purpose: 'Carte structurée par catégories avec descriptions et prix.', required: true },
    { id: 'gallery', title: 'Galerie', purpose: 'Photos des plats et de la salle.', required: true },
    { id: 'about', title: 'Notre histoire', purpose: 'Le chef, la philosophie, les produits.', required: false },
    { id: 'reservation', title: 'Réservation', purpose: 'Formulaire (date, heure, nombre de couverts, contact).', required: true },
    { id: 'reviews', title: 'Avis', purpose: 'Témoignages clients avec notes.', required: false },
    { id: 'location', title: 'Accès & horaires', purpose: 'Carte, adresse, horaires de service.', required: true },
    { id: 'contact', title: 'Contact', purpose: 'Téléphone, email, réseaux.', required: true },
  ],
  files: [
    { path: 'index.html', purpose: 'Page complète du restaurant avec menu et réservation.' },
    { path: 'styles.css', purpose: 'Styles chaleureux via le design system, responsive.' },
    { path: 'script.js', purpose: 'Filtres de menu, galerie, validation/soumission de la réservation.' },
    { path: 'chatbot.js', purpose: 'Widget chatbot IA flottant qui POST vers /api/chat.' },
  ],
};
