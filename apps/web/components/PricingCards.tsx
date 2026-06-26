'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import CheckoutButton from './CheckoutButton';
import type { PlanId } from '@/lib/plans';
import { useT } from '@/lib/i18n';

interface Plan {
  id: PlanId;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  roi: string;
  badge?: string;
  cta: string;
  highlight?: boolean;
}

export default function PricingCards() {
  const t = useT();

  const PLANS: Plan[] = [
    {
      id: 'starter',
      name: 'Starter',
      price: '19€',
      tagline: t({ fr: 'Pour les créateurs qui démarrent', en: 'For creators getting started' }),
      features: [
        t({ fr: '2 sites/mois', en: '2 sites/month' }),
        t({ fr: 'Analyse 5 concurrents', en: '5 competitors analyzed' }),
        t({ fr: 'Design unique garanti', en: 'Guaranteed unique design' }),
        t({ fr: 'Multilingue 10 langues', en: '10 languages' }),
        t({ fr: 'IA chatbot intégrée', en: 'Built-in AI chatbot' }),
        t({ fr: 'Mises à jour annuelles', en: 'Yearly updates' }),
      ],
      roi: t({ fr: 'Jusqu’à 2 000€ d’économie d’agence par site', en: 'Up to €2,000 saved in agency fees per site' }),
      cta: t({ fr: 'Démarrer', en: 'Get started' }),
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '79€',
      tagline: t({
        fr: 'Pour les freelances et petites entreprises',
        en: 'For freelancers and small businesses',
      }),
      features: [
        t({ fr: '10 sites/mois', en: '10 sites/month' }),
        t({ fr: 'Analyse 30 concurrents', en: '30 competitors analyzed' }),
        t({ fr: 'Domaine personnalisé inclus', en: 'Custom domain included' }),
        t({ fr: 'Multilingue 50+ langues', en: '50+ languages' }),
        t({ fr: 'IA chatbot avancée', en: 'Advanced AI chatbot' }),
        t({ fr: 'Mises à jour trimestrielles', en: 'Quarterly updates' }),
        t({ fr: 'Analytics complet', en: 'Full analytics' }),
      ],
      roi: t({
        fr: 'Potentiel jusqu’à 15 000€/mois en revendant tes sites',
        en: 'Potential up to €15,000/month reselling your sites',
      }),
      cta: t({ fr: 'Passer Pro', en: 'Go Pro' }),
    },
    {
      id: 'business',
      name: 'Business',
      price: '299€',
      tagline: t({
        fr: 'Pour les agences et entreprises ambitieuses',
        en: 'For ambitious agencies and companies',
      }),
      badge: t({ fr: 'LE PLUS POPULAIRE', en: 'MOST POPULAR' }),
      highlight: true,
      features: [
        t({ fr: 'Sites illimités', en: 'Unlimited sites' }),
        t({ fr: 'Analyse 100 concurrents', en: '100 competitors analyzed' }),
        t({ fr: 'SaaS complets avec auth + paiement', en: 'Full SaaS with auth + payments' }),
        t({ fr: 'API access', en: 'API access' }),
        t({ fr: 'IA sur mesure dans chaque site', en: 'Custom AI in every site' }),
        t({ fr: 'Mises à jour mensuelles', en: 'Monthly updates' }),
        t({ fr: 'Support 24h', en: '24h support' }),
      ],
      roi: t({
        fr: 'Potentiel jusqu’à 45 000€/mois selon ton volume de revente',
        en: 'Potential up to €45,000/month depending on your resale volume',
      }),
      cta: t({ fr: 'Choisir Business', en: 'Choose Business' }),
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '1 500€',
      tagline: t({ fr: 'Pour les grandes entreprises', en: 'For large enterprises' }),
      features: [
        t({ fr: 'Tout illimité', en: 'Everything unlimited' }),
        t({ fr: 'Analyse 250 concurrents', en: '250 competitors analyzed' }),
        t({ fr: 'White-label complet', en: 'Full white-label' }),
        t({ fr: 'IA dédiée sur mesure', en: 'Dedicated custom AI' }),
        t({ fr: 'Manager dédié', en: 'Dedicated manager' }),
        t({ fr: 'SLA 99.9%', en: '99.9% SLA' }),
        t({ fr: 'Infrastructure privée', en: 'Private infrastructure' }),
      ],
      roi: t({
        fr: 'Pensé pour un ROI maximal à grande échelle',
        en: 'Built for maximum ROI at scale',
      }),
      cta: t({ fr: 'Contacter l’équipe', en: 'Contact the team' }),
    },
    {
      id: 'agency',
      name: 'Agency Reseller',
      price: '2 999€',
      tagline: t({
        fr: 'Pour ceux qui veulent générer 70 000€ à 300 000€/mois',
        en: 'For those who want to earn €70,000 to €300,000/month',
      }),
      badge: t({ fr: 'MEILLEUR INVESTISSEMENT', en: 'BEST INVESTMENT' }),
      features: [
        t({ fr: 'Revends GENESIS sous ton propre nom', en: 'Resell GENESIS under your own brand' }),
        t({ fr: 'Clients illimités', en: 'Unlimited clients' }),
        t({ fr: 'Analyse 500 concurrents', en: '500 competitors analyzed' }),
        t({ fr: 'Tu fixes tes propres prix', en: 'Set your own prices' }),
        t({ fr: 'Génère 5 à 50 sites/jour', en: 'Generate 5 to 50 sites/day' }),
        t({ fr: 'Formation complète incluse', en: 'Full training included' }),
        t({ fr: 'Manager dédié', en: 'Dedicated manager' }),
        t({ fr: 'Tu gardes 100% de tes marges', en: 'Keep 100% of your margins' }),
      ],
      roi: t({
        fr: 'Exemples : 10 × 5 000€ = 50 000€ · 20 × 8 000€ = 160 000€ · 50 × 6 000€ = 300 000€',
        en: 'Examples: 10 × €5,000 = €50,000 · 20 × €8,000 = €160,000 · 50 × €6,000 = €300,000',
      }),
      cta: t({ fr: 'Devenir revendeur →', en: 'Become a reseller →' }),
    },
  ];

  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-28">
      <div className="mb-16 text-center">
        <h2 className="font-display text-3xl font-medium sm:text-5xl">
          {t({ fr: 'Un plan pour ', en: 'A plan for ' })}
          <span className="text-gradient">{t({ fr: 'chaque ambition', en: 'every ambition' })}</span>
        </h2>
        <p className="mt-3 text-white/50">
          {t({
            fr: 'Clair, honnête, justifié. Annule quand tu veux.',
            en: 'Clear, honest, justified. Cancel anytime.',
          })}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
            className={`relative flex flex-col rounded-2xl p-7 ${
              p.highlight
                ? 'glass-strong ring-2 ring-violet-glow/60'
                : 'glass'
            }`}
          >
            {p.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-genesis-gradient px-4 py-1 text-xs font-semibold text-white">
                {p.badge}
              </span>
            )}
            <h3 className="text-lg font-semibold">{p.name}</h3>
            <p className="mt-1 text-sm text-white/50">{p.tagline}</p>
            <div className="my-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold">{p.price}</span>
              <span className="text-white/40">{t({ fr: '/mois', en: '/month' })}</span>
            </div>
            <ul className="mb-6 space-y-2.5 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-white/70">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mb-5 mt-auto rounded-lg bg-violet-glow/10 px-3 py-2 text-xs text-violet-100">
              {p.roi}
            </div>
            <CheckoutButton
              plan={p.id}
              className={`w-full rounded-full px-6 py-3 text-center text-sm font-semibold transition hover:scale-[1.02] ${
                p.highlight || p.badge
                  ? 'bg-genesis-gradient text-white'
                  : 'glass text-white/90 hover:text-white'
              }`}
            >
              {p.cta}
            </CheckoutButton>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
