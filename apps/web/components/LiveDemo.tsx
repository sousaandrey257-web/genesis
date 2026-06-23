'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

const STEPS = [
  { label: 'Langue détectée', result: 'Français 🇫🇷' },
  { label: 'Idée analysée', result: 'Salon · Coiffure · Luxe · Lyon' },
  { label: '20 concurrents analysés', result: '5 faiblesses exploitées' },
  { label: 'Identité visuelle unique', result: 'Palette #7C3AED générée' },
  { label: 'Code production-ready', result: '6 fichiers · 0 erreur' },
  { label: 'Déployé', result: 'salon-eclat-lyon.genesis.site' },
];

export default function LiveDemo() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((v) => (v + 1) % (STEPS.length + 2)), 1200);
    return () => clearInterval(t);
  }, []);

  return (
    <section id="demo" className="relative mx-auto max-w-6xl px-6 py-28">
      <div className="mb-14 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Regarde GENESIS <span className="text-gradient">créer un site en direct</span>
        </h2>
        <p className="mt-3 text-white/50">De l’idée au site déployé. En temps réel.</p>
      </div>

      <div className="grid items-center gap-10 lg:grid-cols-2">
        {/* Steps stream */}
        <div className="glass-strong rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-2 rounded-lg bg-black/40 px-4 py-3 font-mono text-sm text-white/70">
            <span className="text-violet-300">›</span>
            « Salon de coiffure haut de gamme à Lyon »
          </div>
          <ul className="space-y-3">
            {STEPS.map((step, i) => {
              const done = active > i;
              const running = active === i;
              return (
                <motion.li
                  key={step.label}
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: done || running ? 1 : 0.3 }}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5"
                  style={{
                    background: running ? 'rgba(139,92,246,0.12)' : 'transparent',
                  }}
                >
                  <span className="flex items-center gap-3 text-sm">
                    {done ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : running ? (
                      <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-white/20" />
                    )}
                    {step.label}
                  </span>
                  {done && <span className="text-xs text-white/50">{step.result}</span>}
                </motion.li>
              );
            })}
          </ul>
        </div>

        {/* MacBook mockup */}
        <div className="relative">
          <div className="mx-auto max-w-md">
            <div className="rounded-t-2xl border border-white/10 bg-[#16161f] p-3 shadow-2xl">
              <div className="mb-3 flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
              </div>
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-gradient-to-br from-[#1b1430] to-[#0f1a2e]">
                <AnimatePresence mode="wait">
                  {active >= STEPS.length ? (
                    <motion.div
                      key="site"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex h-full flex-col p-5"
                    >
                      <div className="text-[10px] uppercase tracking-widest text-violet-300">
                        Éclat · Lyon
                      </div>
                      <div className="mt-2 font-serif text-2xl text-white">
                        L’art de la coiffure
                      </div>
                      <div className="mt-1 h-2 w-2/3 rounded bg-white/20" />
                      <div className="mt-1 h-2 w-1/2 rounded bg-white/10" />
                      <div className="mt-auto flex gap-2">
                        <div className="h-8 flex-1 rounded bg-gradient-to-r from-violet-500 to-blue-500" />
                        <div className="h-8 w-16 rounded border border-white/20" />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="building"
                      className="flex h-full items-center justify-center text-sm text-white/40"
                    >
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Construction…
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="mx-auto h-3 w-[112%] -translate-x-[5%] rounded-b-xl bg-[#0c0c12] shadow-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}
