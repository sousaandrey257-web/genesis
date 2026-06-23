'use client';

import { motion } from 'framer-motion';
import { Crosshair, Fingerprint, RefreshCw } from 'lucide-react';

const FEATURES = [
  {
    icon: Crosshair,
    title: 'Analyse tes concurrents',
    body: 'GENESIS étudie les 20 meilleurs sites de ton secteur, identifie leurs faiblesses et crée quelque chose de meilleur.',
  },
  {
    icon: Fingerprint,
    title: 'Design 100% unique garanti',
    body: 'Algorithme cryptographique — aucun client ne peut avoir le même design. Ton site est vraiment le tien.',
  },
  {
    icon: RefreshCw,
    title: 'S’améliore tout seul',
    body: 'Chaque mois GENESIS analyse les tendances et met à jour ton site automatiquement. Il ne vieillit jamais.',
  },
];

export default function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Ce que GENESIS fait que{' '}
          <span className="text-gradient">personne d’autre ne fait</span>
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.12 }}
            className="group relative overflow-hidden rounded-2xl glass p-8 transition hover:border-violet-glow/40"
          >
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-glow/10 blur-2xl transition group-hover:bg-violet-glow/20" />
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-genesis-gradient">
              <f.icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">
              <span className="mr-2 text-white/30">{['①', '②', '③'][i]}</span>
              {f.title}
            </h3>
            <p className="text-white/55">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
