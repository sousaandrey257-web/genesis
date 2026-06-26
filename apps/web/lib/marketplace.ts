// Shared UI types + demo data for the GENESIS marketplace (public vitrine).
// Pure module — safe to import from server and client components alike.
//
// NOTE: commission helpers live here (not in '@genesis/engine') so client
// components can show the fee split without pulling the server-only engine
// barrel (node:fs / Anthropic / stripe) into the browser bundle. The engine's
// StripeConnect remains the authoritative source for actual charges.

/** Display commission rate. Server may override via NEXT_PUBLIC_MARKETPLACE_COMMISSION. */
export const MARKETPLACE_COMMISSION: number = (() => {
  const v = Number(process.env.NEXT_PUBLIC_MARKETPLACE_COMMISSION);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.15;
})();

/** Premium template commission (creator keeps 70%). */
export const TEMPLATE_COMMISSION = 0.3;

/** Pure split of a price into GENESIS fee + seller net (display estimate). */
export function commissionFor(
  priceEUR: number,
  kind: 'site' | 'template',
): { platformFeeEUR: number; sellerNetEUR: number; feeRate: number } {
  const feeRate = kind === 'template' ? TEMPLATE_COMMISSION : MARKETPLACE_COMMISSION;
  const price = Math.max(0, priceEUR);
  const platformFeeEUR = Math.round(price * feeRate * 100) / 100;
  const sellerNetEUR = Math.round((price - platformFeeEUR) * 100) / 100;
  return { platformFeeEUR, sellerNetEUR, feeRate };
}

export interface Listing {
  id: string;
  siteId: string;
  title: string;
  sector: string;
  language: string;
  country: string;
  priceEUR: number;
  previewUrl?: string;
  thumbnailColor: string;
  revenue30dEUR?: number;
  clientRating?: number;
  kind: 'site' | 'template';
  sellerName: string;
}

/**
 * Sample listings for the public marketplace. Realistic spread across sectors,
 * languages, countries and price tiers (sites 500–50000€, templates 29–299€).
 */
export const DEMO_LISTINGS: Listing[] = [
  {
    id: 'lst_restaurant_paris',
    siteId: 'site_resto_lumiere',
    title: 'Restaurant Lumière — gastronomie & réservation',
    sector: 'Restauration',
    language: 'fr',
    country: 'FR',
    priceEUR: 8900,
    previewUrl: 'https://lumiere-resto.genesis.app',
    thumbnailColor: '#f97316',
    revenue30dEUR: 2400,
    clientRating: 5,
    kind: 'site',
    sellerName: 'Atelier Numérique',
  },
  {
    id: 'lst_saas_analytics',
    siteId: 'site_metricflow',
    title: 'MetricFlow — SaaS analytics B2B clé en main',
    sector: 'SaaS',
    language: 'en',
    country: 'US',
    priceEUR: 42000,
    previewUrl: 'https://metricflow.genesis.app',
    thumbnailColor: '#6366f1',
    revenue30dEUR: 14800,
    clientRating: 5,
    kind: 'site',
    sellerName: 'NorthPeak Studio',
  },
  {
    id: 'lst_ecom_fashion',
    siteId: 'site_atelier_mode',
    title: 'Atelier Mode — boutique e-commerce premium',
    sector: 'E-commerce',
    language: 'fr',
    country: 'BE',
    priceEUR: 15500,
    previewUrl: 'https://atelier-mode.genesis.app',
    thumbnailColor: '#ec4899',
    revenue30dEUR: 6100,
    clientRating: 4,
    kind: 'site',
    sellerName: 'Studio Mercure',
  },
  {
    id: 'lst_clinic_dental',
    siteId: 'site_clinique_sourire',
    title: 'Clinique du Sourire — cabinet dentaire avec prise de RDV',
    sector: 'Santé',
    language: 'fr',
    country: 'FR',
    priceEUR: 4200,
    previewUrl: 'https://clinique-sourire.genesis.app',
    thumbnailColor: '#06b6d4',
    revenue30dEUR: 900,
    clientRating: 5,
    kind: 'site',
    sellerName: 'PixelSanté',
  },
  {
    id: 'lst_realestate_dubai',
    siteId: 'site_horizon_estates',
    title: 'Horizon Estates — portail immobilier de luxe',
    sector: 'Immobilier',
    language: 'ar',
    country: 'AE',
    priceEUR: 28000,
    previewUrl: 'https://horizon-estates.genesis.app',
    thumbnailColor: '#eab308',
    revenue30dEUR: 9300,
    clientRating: 5,
    kind: 'site',
    sellerName: 'Gulf Digital',
  },
  {
    id: 'lst_portfolio_photo',
    siteId: 'site_lucia_photo',
    title: 'Lucía Vega — portfolio photographe mariage',
    sector: 'Créatif',
    language: 'es',
    country: 'ES',
    priceEUR: 1500,
    previewUrl: 'https://lucia-photo.genesis.app',
    thumbnailColor: '#a855f7',
    revenue30dEUR: 480,
    clientRating: 4,
    kind: 'site',
    sellerName: 'Vega Studio',
  },
  {
    id: 'lst_template_saas_landing',
    siteId: 'tpl_saas_aurora',
    title: 'Aurora — template landing SaaS',
    sector: 'SaaS',
    language: 'en',
    country: 'US',
    priceEUR: 149,
    previewUrl: 'https://aurora-template.genesis.app',
    thumbnailColor: '#8b5cf6',
    clientRating: 5,
    kind: 'template',
    sellerName: 'Aurora Labs',
  },
  {
    id: 'lst_template_resto',
    siteId: 'tpl_resto_savora',
    title: 'Savora — template restaurant & menu',
    sector: 'Restauration',
    language: 'fr',
    country: 'FR',
    priceEUR: 79,
    previewUrl: 'https://savora-template.genesis.app',
    thumbnailColor: '#ef4444',
    clientRating: 4,
    kind: 'template',
    sellerName: 'Savora Design',
  },
  {
    id: 'lst_template_portfolio',
    siteId: 'tpl_portfolio_noir',
    title: 'Noir — template portfolio créatif minimal',
    sector: 'Créatif',
    language: 'en',
    country: 'GB',
    priceEUR: 39,
    previewUrl: 'https://noir-template.genesis.app',
    thumbnailColor: '#64748b',
    clientRating: 5,
    kind: 'template',
    sellerName: 'Noir Collective',
  },
];
