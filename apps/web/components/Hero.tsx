'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Sparkles, Check } from 'lucide-react';
import Particles from './Particles';
import { useT } from '@/lib/i18n';

/** Typewriter that cycles through the three headline phrases. */
function useTypewriter(phrases: string[], speed = 55, hold = 1400) {
  const [text, setText] = useState('');
  const [i, setI] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const full = phrases[i % phrases.length];
    if (!deleting && text === full) {
      const t = setTimeout(() => setDeleting(true), hold);
      return () => clearTimeout(t);
    }
    if (deleting && text === '') {
      setDeleting(false);
      setI((v) => v + 1);
      return;
    }
    const t = setTimeout(
      () => setText(full.slice(0, text.length + (deleting ? -1 : 1))),
      deleting ? speed / 2 : speed,
    );
    return () => clearTimeout(t);
  }, [text, deleting, i, phrases, speed, hold]);

  return text;
}

export default function Hero() {
  const t = useT();
  const PHRASES = [
    t({ fr: 'Décris ton idée.', en: 'Describe your idea.' }),
    t({
      fr: 'Ton site est en ligne dans 10 minutes.',
      en: 'Your site goes live in 10 minutes.',
    }),
    t({
      fr: 'Meilleur que tous tes concurrents.',
      en: 'Better than all your competitors.',
    }),
  ];
  const typed = useTypewriter(PHRASES);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="absolute inset-0 bg-ink" />
      <div className="absolute inset-0 grid-glow" />
      <Particles />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-violet-glow/20 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 mx-auto max-w-4xl"
      >
        <span className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-sm text-violet-200">
          <Sparkles className="h-4 w-4" />
          {t({
            fr: 'Le premier générateur de produits digitaux autonome au monde',
            en: "The world's first autonomous digital product generator",
          })}
        </span>

        <h1 className="min-h-[8.5rem] font-display text-4xl font-medium leading-tight tracking-tight sm:text-[3.75rem] sm:leading-[1.08]">
          <span className="shimmer-text">{typed}</span>
          <span className="ml-1 inline-block h-[0.9em] w-[2px] animate-pulse bg-violet-glow align-middle" />
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
          {t({
            fr: 'GENESIS analyse le marché, crée un design unique, code et déploie ton site automatiquement. Sans coder. Sans agence. Sans attendre.',
            en: 'GENESIS analyzes your market, crafts a unique design, then codes and deploys your site automatically. No coding. No agency. No waiting.',
          })}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/start"
            className="group inline-flex items-center gap-2 rounded-full bg-genesis-gradient px-8 py-4 text-base font-semibold text-white shadow-lg shadow-violet-glow/30 transition hover:scale-[1.03] hover:shadow-violet-glow/50"
          >
            {t({ fr: 'Créer mon site maintenant', en: 'Create my site now' })}
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          </a>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 rounded-full glass px-8 py-4 text-base font-medium text-white/80 transition hover:text-white"
          >
            <Play className="h-4 w-4" />
            {t({ fr: 'Voir une démo en direct →', en: 'Watch a live demo →' })}
          </a>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-white/45">
          {[
            t({ fr: 'Le code t’appartient', en: 'You own the code' }),
            t({ fr: '50+ langues', en: '50+ languages' }),
            t({ fr: 'Déployé sur ton domaine', en: 'Deployed on your domain' }),
            t({ fr: 'Design unique garanti', en: 'Guaranteed unique design' }),
          ].map((label) => (
            <span key={label} className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-violet-300" />
              {label}
            </span>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
