// Demo-mode helpers: let the showcase run with NO Anthropic key.
// Active when NEXT_PUBLIC_DEMO_MODE=true or when ANTHROPIC_API_KEY is absent.
// Server-only usage (route handlers) — values are deterministic, instant.

import type { ConversationMessage, ConversationResult, RevenuePrediction } from '@genesis/engine';

export type Lang = 'fr' | 'en';

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.ANTHROPIC_API_KEY;
}

/** A scripted, believable 4-question intake that ends with a summary + brief. */
export function demoConversation(
  messages: ConversationMessage[],
  lang: Lang = 'fr',
): ConversationResult {
  const userTurns = messages.filter((m) => m.role === 'user').length;

  const script: Record<Lang, string[]> = {
    fr: [
      'Salut 👋 Je suis GENESIS. Décris-moi ton projet en une phrase — par exemple « un salon de coiffure haut de gamme à Lyon ».',
      'Parfait. Tu veux surtout vendre en ligne, ou présenter ton activité et capter des contacts ?',
      'Top. Tu as déjà des clients aujourd’hui ? Une idée du volume par mois ?',
      'Dernière chose : dans quelle(s) langue(s) veux-tu ton site, et as-tu un budget pub mensuel ?',
    ],
    en: [
      'Hi 👋 I’m GENESIS. Describe your project in one sentence — for example “a high-end hair salon in Lyon”.',
      'Perfect. Do you mainly want to sell online, or showcase your business and capture leads?',
      'Great. Do you already have customers? Any idea of the monthly volume?',
      'Last thing: which language(s) do you want the site in, and do you have a monthly ad budget?',
    ],
  };

  if (userTurns < script[lang].length) {
    return {
      reply: script[lang][userTurns],
      done: false,
      questionNumber: userTurns + 1,
    };
  }

  const summary: Record<Lang, string> = {
    fr: 'Parfait ! Je vais créer un site haut de gamme avec réservation en ligne et paiement CB, en français, optimisé pour convertir tes visiteurs en clients — plus l’app mobile, les vidéos et le kit marketing. On lance la génération ?',
    en: 'Perfect! I’ll build a premium site with online booking and card payments, optimized to turn visitors into customers — plus the mobile app, videos and marketing kit. Shall we start generating?',
  };
  const idea: Record<Lang, string> = {
    fr: 'Site haut de gamme avec réservation en ligne et paiement par carte, en français, pour une activité de service premium, optimisé conversion, avec app mobile et marketing.',
    en: 'Premium website with online booking and card payments, in French, for a premium service business, conversion-optimized, with a mobile app and marketing.',
  };

  return {
    reply: summary[lang],
    done: true,
    questionNumber: 5,
    summary: summary[lang],
    ideaForPipeline: idea[lang],
  };
}

/** A polished example revenue projection (12 months) for the predictor widget. */
export function demoPrediction(idea = '', lang: Lang = 'fr'): RevenuePrediction {
  const conversionRate = 0.031;
  const averageBasket = 85;
  // Smooth growth curve: 450 → ~3200 visitors over 12 months.
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const traffic = Math.round(450 * Math.pow(1.22, i) * (i > 5 ? 0.92 : 1));
    const revenue = Math.round(traffic * conversionRate * averageBasket);
    return { month, traffic, revenue };
  });
  const revenueYear1 = monthly.reduce((s, m) => s + m.revenue, 0);
  const revenueMonth1 = monthly[0].revenue;
  const revenueMonth6 = monthly[5].revenue;

  const assumptions: Record<Lang, string[]> = {
    fr: [
      'Taux de conversion moyen du secteur : 3,1 %',
      'Panier moyen estimé : 85 €',
      'Croissance du trafic portée par le SEO et le marketing inclus',
      'Marché local actif, concurrence surpassée par le positionnement GENESIS',
    ],
    en: [
      'Sector average conversion rate: 3.1%',
      'Estimated average basket: €85',
      'Traffic growth driven by the included SEO and marketing',
      'Active local market, competition outpaced by the GENESIS positioning',
    ],
  };

  return {
    trafficMonth1: monthly[0].traffic,
    trafficMonth6: monthly[5].traffic,
    conversionRate,
    averageBasket,
    revenueMonth1,
    revenueMonth6,
    revenueYear1,
    confidence: 0.78,
    assumptions: assumptions[lang],
    bestCase: Math.round(revenueYear1 * 1.45),
    worstCase: Math.round(revenueYear1 * 0.6),
    monthly,
    breakEvenMonths: 3,
  };
}
