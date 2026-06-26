'use client';

import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';

/**
 * Honest "trusted by" strip. No fabricated reviews — premium placeholder slots
 * ready to receive real client logos as they come in. Editorial, restrained.
 */
export default function Testimonials() {
  const t = useT();

  // Six logo slots to fill with real brands. Intentionally empty/greyscale.
  const slots = Array.from({ length: 6 }, (_, i) => i);

  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      <div className="text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
          {t({ fr: 'Premières marques', en: 'Founding brands' })}
        </p>
        <h2 className="font-display text-3xl font-medium tracking-tight sm:text-5xl">
          {t({ fr: 'La place est ', en: 'The space is ' })}
          <span className="text-gradient italic">
            {t({ fr: 'ouverte.', en: 'open.' })}
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-white/55">
          {t({
            fr: 'Nous lançons avec une première vague de marques exigeantes. La vôtre pourrait figurer ici.',
            en: 'We’re launching with a first wave of discerning brands. Yours could sit here.',
          })}
        </p>
      </div>

      <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] sm:grid-cols-3 lg:grid-cols-6">
        {slots.map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
            className="group flex aspect-[3/2] items-center justify-center bg-ink/60 transition hover:bg-white/[0.03]"
          >
            <span className="text-[0.7rem] uppercase tracking-[0.25em] text-white/20 transition group-hover:text-white/35">
              {t({ fr: 'À venir', en: 'Soon' })}
            </span>
          </motion.div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-white/30">
        {t({
          fr: 'Emplacements réservés à de vrais logos clients. Nous n’affichons aucun avis ni chiffre que nous ne pouvons prouver.',
          en: 'Reserved for real client logos. We show no review or figure we can’t prove.',
        })}
      </p>
    </section>
  );
}
