'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

// NOTE: Replace with real, verifiable testimonials before going live.
// Income/result figures are illustrative examples and are labelled as such to
// stay on the right side of advertising law.
const TESTIMONIALS = [
  {
    quote:
      'J’ai généré 47 sites en un mois et facturé 235 000€. GENESIS a changé ma façon de travailler.',
    name: 'Karim M.',
    role: 'Agence digitale',
    country: 'Maroc',
    flag: '🇲🇦',
  },
  {
    quote:
      'Mon salon de coiffure a doublé ses réservations en 3 semaines grâce au site que GENESIS a créé.',
    name: 'Sophie L.',
    role: 'Salon de coiffure',
    country: 'Lyon',
    flag: '🇫🇷',
  },
  {
    quote:
      'Le multilingue automatique m’a permis de toucher mes clients en wolof et en français le même jour.',
    name: 'Awa D.',
    role: 'Boutique en ligne',
    country: 'Sénégal',
    flag: '🇸🇳',
  },
];

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Ils ont <span className="text-gradient">déjà lancé leur site</span>
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <motion.figure
            key={t.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="flex flex-col rounded-2xl glass p-7"
          >
            <div className="mb-3 flex gap-0.5 text-amber-300">
              {Array.from({ length: 5 }).map((_, s) => (
                <Star key={s} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="flex-1 text-white/80">“{t.quote}”</blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-genesis-gradient text-sm font-bold">
                {t.name[0]}
              </span>
              <span className="text-sm">
                <span className="block font-semibold">{t.name}</span>
                <span className="text-white/50">
                  {t.role} · {t.country} {t.flag}
                </span>
              </span>
            </figcaption>
          </motion.figure>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-white/30">
        Témoignages illustratifs. À remplacer par des avis clients vérifiés avant le lancement.
      </p>
    </section>
  );
}
