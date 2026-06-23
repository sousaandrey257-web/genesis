'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import CheckoutButton from './CheckoutButton';
import type { PlanId } from '@/lib/plans';

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

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '19€',
    tagline: 'Pour les créateurs qui démarrent',
    features: [
      '2 sites/mois',
      'Analyse 5 concurrents',
      'Design unique garanti',
      'Multilingue 10 langues',
      'IA chatbot intégrée',
      'Mises à jour annuelles',
    ],
    roi: 'Économise 2 000€ d’agence par site',
    cta: 'Démarrer',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '79€',
    tagline: 'Pour les freelances et petites entreprises',
    features: [
      '10 sites/mois',
      'Analyse 30 concurrents',
      'Domaine personnalisé inclus',
      'Multilingue 50+ langues',
      'IA chatbot avancée',
      'Mises à jour trimestrielles',
      'Analytics complet',
    ],
    roi: 'Génère jusqu’à 15 000€/mois en revendant tes sites',
    cta: 'Passer Pro',
  },
  {
    id: 'business',
    name: 'Business',
    price: '299€',
    tagline: 'Pour les agences et entreprises ambitieuses',
    badge: 'LE PLUS POPULAIRE',
    highlight: true,
    features: [
      'Sites illimités',
      'SaaS complets avec auth + paiement',
      'API access',
      'IA sur mesure dans chaque site',
      'Mises à jour mensuelles',
      'Support 24h',
    ],
    roi: 'Nos clients Business génèrent en moyenne 45 000€/mois',
    cta: 'Choisir Business',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '1 500€',
    tagline: 'Pour les grandes entreprises',
    features: [
      'Tout illimité',
      'White-label complet',
      'IA dédiée sur mesure',
      'Manager dédié',
      'SLA 99.9%',
      'Infrastructure privée',
    ],
    roi: 'ROI moyen constaté : 8 000% dès le premier mois',
    cta: 'Contacter l’équipe',
  },
  {
    id: 'agency',
    name: 'Agency Reseller',
    price: '2 999€',
    tagline: 'Pour ceux qui veulent générer 70 000€ à 300 000€/mois',
    badge: 'MEILLEUR INVESTISSEMENT',
    features: [
      'Revends GENESIS sous ton propre nom',
      'Clients illimités',
      'Tu fixes tes propres prix',
      'Génère 5 à 50 sites/jour',
      'Formation complète incluse',
      'Manager dédié',
      'Tu gardes 100% de tes marges',
    ],
    roi: '10 × 5 000€ = 50 000€ · 20 × 8 000€ = 160 000€ · 50 × 6 000€ = 300 000€',
    cta: 'Devenir revendeur →',
  },
];

export default function PricingCards() {
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-28">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Un plan pour <span className="text-gradient">chaque ambition</span>
        </h2>
        <p className="mt-3 text-white/50">Clair, honnête, justifié. Annule quand tu veux.</p>
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
              <span className="text-white/40">/mois</span>
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
