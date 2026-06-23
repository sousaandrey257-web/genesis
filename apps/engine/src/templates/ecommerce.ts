import type { TemplateBlueprint } from './types';

export const ecommerce: TemplateBlueprint = {
  type: 'ecommerce',
  label: 'E-commerce / boutique en ligne',
  description:
    'Boutique en ligne pour vendre des produits physiques ou numériques, avec panier et tunnel d’achat.',
  schemaType: 'Store',
  defaultFeatures: [
    'Grille de produits avec prix',
    'Fiches produit',
    'Panier persistant',
    'Tunnel de commande',
    'Badges de confiance (paiement sécurisé, livraison, retours)',
    'Newsletter',
    'Avis produits',
  ],
  conversionGoal: 'Achat (ajout au panier → checkout)',
  layoutHints:
    'Mise en avant produit, photos nettes, prix visibles. Hero avec offre/promo. ' +
    'Grille de produits responsive avec bouton "Ajouter au panier". Panier latéral ' +
    '(drawer) persistant via localStorage. Badges de confiance près des CTA. ' +
    'Le checkout est un formulaire prêt à brancher sur Stripe (placeholder de session).',
  needsAuth: false,
  needsPayment: true,
  sections: [
    { id: 'hero', title: 'Hero', purpose: 'Promesse de marque + offre/promo, CTA Découvrir.', required: true },
    { id: 'categories', title: 'Catégories', purpose: 'Accès rapide aux familles de produits.', required: false },
    { id: 'products', title: 'Produits', purpose: 'Grille de produits avec image, prix, ajout panier.', required: true },
    { id: 'promo', title: 'Offre', purpose: 'Bandeau promo / livraison offerte.', required: false },
    { id: 'trust', title: 'Confiance', purpose: 'Paiement sécurisé, livraison, retours.', required: true },
    { id: 'cart', title: 'Panier & checkout', purpose: 'Drawer panier + formulaire de commande.', required: true },
    { id: 'reviews', title: 'Avis', purpose: 'Avis produits / clients.', required: false },
    { id: 'newsletter', title: 'Newsletter', purpose: 'Capture d’email.', required: false },
  ],
  files: [
    { path: 'index.html', purpose: 'Vitrine + grille produits + drawer panier + checkout.' },
    { path: 'styles.css', purpose: 'Styles boutique via le design system, responsive.' },
    { path: 'products.js', purpose: 'Catalogue, logique de panier (localStorage), totaux.' },
    { path: 'checkout.js', purpose: 'Formulaire de commande prêt à brancher sur Stripe.' },
    { path: 'chatbot.js', purpose: 'Widget chatbot IA flottant qui POST vers /api/chat.' },
  ],
};
