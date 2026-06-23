import type { TemplateBlueprint } from './types';

export const salon: TemplateBlueprint = {
  type: 'salon',
  label: 'Salon (coiffure, beauté, esthétique)',
  description:
    'Site vitrine pour salon de coiffure, barbier, institut de beauté ou spa, optimisé pour la prise de rendez-vous.',
  schemaType: 'HairSalon',
  defaultFeatures: [
    'Grille de prestations avec tarifs',
    'Galerie avant/après',
    'Présentation de l’équipe',
    'Module de réservation en ligne',
    'Horaires + carte de localisation',
    'Avis clients',
  ],
  conversionGoal: 'Prise de rendez-vous (bouton "Réserver" omniprésent, sticky en mobile)',
  layoutHints:
    'Esthétique soignée et élégante. Hero plein écran avec photo + CTA réserver. ' +
    'Prestations en cartes lisibles avec prix. Galerie en grille masonry. CTA de ' +
    'réservation répété en haut, milieu et bas, et en barre fixe sur mobile.',
  needsAuth: false,
  needsPayment: false,
  sections: [
    { id: 'hero', title: 'Hero', purpose: 'Nom du salon, accroche, photo d’ambiance, CTA Réserver.', required: true },
    { id: 'services', title: 'Prestations & tarifs', purpose: 'Liste claire des prestations avec durée et prix.', required: true },
    { id: 'gallery', title: 'Galerie', purpose: 'Réalisations / avant-après en grille.', required: true },
    { id: 'team', title: 'Équipe', purpose: 'Photos et spécialités des coiffeurs/esthéticiennes.', required: false },
    { id: 'booking', title: 'Réservation', purpose: 'Formulaire de prise de RDV (date, prestation, contact).', required: true },
    { id: 'reviews', title: 'Avis', purpose: 'Témoignages clients avec notes.', required: false },
    { id: 'location', title: 'Adresse & horaires', purpose: 'Carte, adresse, horaires d’ouverture.', required: true },
    { id: 'contact', title: 'Contact', purpose: 'Téléphone, email, réseaux sociaux.', required: true },
  ],
  files: [
    { path: 'index.html', purpose: 'Page complète du salon avec toutes les sections.' },
    { path: 'styles.css', purpose: 'Styles via les variables du design system, responsive + sticky CTA mobile.' },
    { path: 'script.js', purpose: 'Galerie, scroll fluide, validation et soumission du formulaire de réservation.' },
    { path: 'chatbot.js', purpose: 'Widget chatbot IA flottant qui POST vers /api/chat.' },
  ],
};
