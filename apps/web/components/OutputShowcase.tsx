'use client';

import { motion } from 'framer-motion';
import {
  Globe,
  Smartphone,
  Clapperboard,
  Megaphone,
  Mail,
  BarChart3,
} from 'lucide-react';

const OUTPUTS = [
  {
    icon: Globe,
    emoji: '🌐',
    title: 'Site web unique et déployé',
    body: 'Un Next.js sur-mesure, multilingue, en ligne en quelques minutes.',
  },
  {
    icon: Smartphone,
    emoji: '📱',
    title: 'App iOS + Android',
    body: 'Une app React Native (Expo) cohérente, prête pour les stores via EAS.',
  },
  {
    icon: Clapperboard,
    emoji: '🎬',
    title: 'Vidéos de présentation',
    body: '3 formats — 16:9, 9:16 et 1:1 — pour YouTube, Reels et Instagram.',
  },
  {
    icon: Megaphone,
    emoji: '📣',
    title: '30 jours de social media',
    body: 'Posts Instagram, Facebook, LinkedIn, X et scripts TikTok + calendrier.',
  },
  {
    icon: Mail,
    emoji: '📧',
    title: 'Séquence emails complète',
    body: '7 emails de bienvenue + newsletter, HTML responsive prêts à importer.',
  },
  {
    icon: BarChart3,
    emoji: '📊',
    title: 'Analytics + reco IA',
    body: 'GA4, Hotjar et Meta Pixel intégrés, avec recommandations de croissance.',
  },
];

export default function OutputShowcase() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-28">
      <div className="mb-16 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-violet-glow/80">
          Une seule idée, six livrables
        </p>
        <h2 className="text-3xl font-bold sm:text-4xl">
          Ce que GENESIS <span className="text-gradient">génère pour toi</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-white/55">
          Tu décris ton projet une fois. GENESIS produit tout l’écosystème,
          cohérent et à ton image.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {OUTPUTS.map((o, i) => (
          <motion.div
            key={o.title}
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: i * 0.14, ease: 'easeOut' }}
            className="group relative overflow-hidden rounded-2xl glass p-7 transition hover:border-violet-glow/40"
          >
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-glow/10 blur-2xl transition group-hover:bg-violet-glow/25" />
            <div className="mb-5 flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-genesis-gradient">
                <o.icon className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl" aria-hidden>
                {o.emoji}
              </span>
            </div>
            <h3 className="mb-2 text-lg font-semibold">{o.title}</h3>
            <p className="text-sm text-white/55">{o.body}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: OUTPUTS.length * 0.14 }}
        className="mt-12 text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full glass px-6 py-3 text-lg font-semibold">
          <span className="text-gradient">Tout ça en moins de 15 minutes</span>
          <span aria-hidden>→</span>
        </span>
      </motion.div>
    </section>
  );
}
