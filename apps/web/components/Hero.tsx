'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import Particles from './Particles';

const PHRASES = [
  'Décris ton idée.',
  'Ton site est en ligne dans 10 minutes.',
  'Meilleur que tous tes concurrents.',
];

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
          Le premier générateur de produits digitaux autonome au monde
        </span>

        <h1 className="min-h-[8.5rem] text-4xl font-bold leading-tight tracking-tight sm:text-6xl sm:leading-[1.1]">
          <span className="shimmer-text">{typed}</span>
          <span className="ml-1 inline-block h-[1em] w-[3px] animate-pulse bg-violet-glow align-middle" />
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
          GENESIS analyse le marché, crée un design unique, code et déploie ton
          site automatiquement. Sans coder. Sans agence. Sans attendre.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/generate"
            className="group inline-flex items-center gap-2 rounded-full bg-genesis-gradient px-8 py-4 text-base font-semibold text-white shadow-lg shadow-violet-glow/30 transition hover:scale-[1.03] hover:shadow-violet-glow/50"
          >
            Créer mon site maintenant
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          </a>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 rounded-full glass px-8 py-4 text-base font-medium text-white/80 transition hover:text-white"
          >
            <Play className="h-4 w-4" />
            Voir une démo en direct →
          </a>
        </div>

        <p className="mt-10 text-sm text-white/40">
          <span className="text-white/70">4 200</span> sites créés ·{' '}
          <span className="text-white/70">89</span> pays · Note moyenne{' '}
          <span className="text-white/70">4.9/5</span>
        </p>
      </motion.div>
    </section>
  );
}
