'use client';

import { motion } from 'framer-motion';
import { Crosshair, Fingerprint, RefreshCw } from 'lucide-react';
import { useT } from '@/lib/i18n';

export default function Features() {
  const t = useT();

  const FEATURES = [
    {
      icon: Crosshair,
      title: t({
        fr: 'Analyse tes concurrents',
        en: 'Analyzes your competitors',
      }),
      body: t({
        fr: 'GENESIS étudie les 20 meilleurs sites de ton secteur, identifie leurs faiblesses et crée quelque chose de meilleur.',
        en: 'GENESIS studies the 20 best sites in your sector, finds their weaknesses, and builds something better.',
      }),
    },
    {
      icon: Fingerprint,
      title: t({
        fr: 'Design 100% unique garanti',
        en: '100% unique design, guaranteed',
      }),
      body: t({
        fr: 'Algorithme cryptographique — aucun client ne peut avoir le même design. Ton site est vraiment le tien.',
        en: 'A cryptographic algorithm means no two clients can ever share a design. Your site is truly yours.',
      }),
    },
    {
      icon: RefreshCw,
      title: t({
        fr: 'S’améliore tout seul',
        en: 'Improves on its own',
      }),
      body: t({
        fr: 'Chaque mois GENESIS analyse les tendances et met à jour ton site automatiquement. Il ne vieillit jamais.',
        en: 'Every month GENESIS analyzes trends and updates your site automatically. It never gets outdated.',
      }),
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      <div className="mb-16 text-center">
        <h2 className="font-display text-3xl font-medium sm:text-5xl">
          {t({ fr: 'Ce que GENESIS fait que', en: 'What GENESIS does that' })}{' '}
          <span className="text-gradient">
            {t({ fr: 'personne d’autre ne fait', en: 'no one else does' })}
          </span>
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
