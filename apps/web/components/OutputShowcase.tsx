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
import { useT } from '@/lib/i18n';

export default function OutputShowcase() {
  const t = useT();

  const OUTPUTS = [
    {
      icon: Globe,
      emoji: '🌐',
      title: t({
        fr: 'Site web unique et déployé',
        en: 'A unique, deployed website',
      }),
      body: t({
        fr: 'Un Next.js sur-mesure, multilingue, en ligne en quelques minutes.',
        en: 'A bespoke multilingual Next.js site, live in minutes.',
      }),
    },
    {
      icon: Smartphone,
      emoji: '📱',
      title: t({ fr: 'App iOS + Android', en: 'iOS + Android app' }),
      body: t({
        fr: 'Une app React Native (Expo) cohérente, prête pour les stores via EAS.',
        en: 'A matching React Native (Expo) app, store-ready via EAS.',
      }),
    },
    {
      icon: Clapperboard,
      emoji: '🎬',
      title: t({ fr: 'Vidéos de présentation', en: 'Promo videos' }),
      body: t({
        fr: '3 formats — 16:9, 9:16 et 1:1 — pour YouTube, Reels et Instagram.',
        en: 'Three formats — 16:9, 9:16 and 1:1 — for YouTube, Reels and Instagram.',
      }),
    },
    {
      icon: Megaphone,
      emoji: '📣',
      title: t({ fr: '30 jours de social media', en: '30 days of social content' }),
      body: t({
        fr: 'Posts Instagram, Facebook, LinkedIn, X et scripts TikTok + calendrier.',
        en: 'Instagram, Facebook, LinkedIn and X posts, TikTok scripts + a calendar.',
      }),
    },
    {
      icon: Mail,
      emoji: '📧',
      title: t({ fr: 'Séquence emails complète', en: 'A complete email sequence' }),
      body: t({
        fr: '7 emails de bienvenue + newsletter, HTML responsive prêts à importer.',
        en: '7 welcome emails + newsletter, responsive HTML ready to import.',
      }),
    },
    {
      icon: BarChart3,
      emoji: '📊',
      title: t({ fr: 'Analytics + reco IA', en: 'Analytics + AI recommendations' }),
      body: t({
        fr: 'GA4, Hotjar et Meta Pixel intégrés, avec recommandations de croissance.',
        en: 'GA4, Hotjar and Meta Pixel built in, with growth recommendations.',
      }),
    },
  ];

  return (
    <section className="relative mx-auto max-w-6xl px-6 py-28">
      <div className="mb-16 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-violet-glow/80">
          {t({ fr: 'Une seule idée, six livrables', en: 'One idea, six deliverables' })}
        </p>
        <h2 className="font-display text-3xl font-medium sm:text-5xl">
          {t({ fr: 'Ce que GENESIS ', en: 'What GENESIS ' })}
          <span className="text-gradient">
            {t({ fr: 'génère pour toi', en: 'generates for you' })}
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-white/55">
          {t({
            fr: 'Tu décris ton projet une fois. GENESIS produit tout l’écosystème, cohérent et à ton image.',
            en: 'You describe your project once. GENESIS produces your entire ecosystem, consistent and on-brand.',
          })}
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
          <span className="text-gradient">
            {t({ fr: 'Tout ça en moins de 15 minutes', en: 'All of it in under 15 minutes' })}
          </span>
          <span aria-hidden>→</span>
        </span>
      </motion.div>
    </section>
  );
}
