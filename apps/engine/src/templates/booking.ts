import type { TemplateBlueprint } from './types';

export const booking: TemplateBlueprint = {
  type: 'booking',
  label: 'Réservation / prestation de service',
  description:
    'Site pour prestataire de services sur rendez-vous (coach, consultant, artisan, praticien), centré sur la prise de créneau.',
  schemaType: 'Service',
  defaultFeatures: [
    'Liste des services / forfaits',
    'Sélecteur de créneau (date + heure)',
    'Tarifs',
    'Déroulé de la prestation',
    'Témoignages',
    'Formulaire de réservation',
  ],
  conversionGoal: 'Réservation d’un créneau',
  layoutHints:
    'Clair et rassurant. Hero avec promesse + CTA "Réserver un créneau". Services ' +
    'en cartes avec durée et prix. Sélecteur de créneaux (grille de dates/heures ' +
    'générée en JS). Étapes "comment ça se passe". Le formulaire capture service, ' +
    'créneau et coordonnées, prêt à brancher sur un calendrier réel.',
  needsAuth: false,
  needsPayment: false,
  sections: [
    { id: 'hero', title: 'Hero', purpose: 'Promesse, CTA Réserver un créneau.', required: true },
    { id: 'services', title: 'Services', purpose: 'Prestations/forfaits avec durée et prix.', required: true },
    { id: 'how', title: 'Comment ça marche', purpose: 'Étapes de la réservation à la prestation.', required: true },
    { id: 'calendar', title: 'Créneaux', purpose: 'Sélecteur de date + heure disponibles.', required: true },
    { id: 'pricing', title: 'Tarifs', purpose: 'Détail des forfaits.', required: false },
    { id: 'testimonials', title: 'Témoignages', purpose: 'Avis clients.', required: false },
    { id: 'booking', title: 'Réservation', purpose: 'Formulaire (service, créneau, contact).', required: true },
  ],
  files: [
    { path: 'index.html', purpose: 'Page de réservation complète avec sélecteur de créneaux.' },
    { path: 'styles.css', purpose: 'Styles via le design system, responsive.' },
    { path: 'booking.js', purpose: 'Génération des créneaux, sélection, validation/soumission.' },
    { path: 'chatbot.js', purpose: 'Widget chatbot IA flottant qui POST vers /api/chat.' },
  ],
};
