'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

const PLAN_COST = 2999; // Agency Reseller reference

export default function ROICalculator() {
  const [price, setPrice] = useState(5000);
  const [volume, setVolume] = useState(10);

  const revenue = price * volume;
  const roi = Math.round(((revenue - PLAN_COST) / PLAN_COST) * 100);
  const fmt = (n: number) => n.toLocaleString('fr-FR');

  return (
    <section className="mx-auto max-w-4xl px-6 py-28">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Calcule ton <span className="text-gradient">retour sur investissement</span>
        </h2>
        <p className="mt-3 text-white/50">
          Simulation basée sur tes propres chiffres — à toi de fixer tes prix.
        </p>
      </div>

      <div className="grid gap-8 rounded-3xl glass-strong p-8 md:grid-cols-2 md:p-10">
        <div className="space-y-8">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-white/70">Tu revends un site combien ?</span>
              <span className="font-semibold text-violet-200">{fmt(price)} €</span>
            </div>
            <input
              type="range"
              min={1000}
              max={50000}
              step={500}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full accent-violet-glow"
            />
          </div>

          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-white/70">Combien de sites par mois ?</span>
              <span className="font-semibold text-violet-200">{volume}</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-violet-glow"
            />
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-violet-glow/15 to-electric/10 p-8 text-center">
          <span className="text-sm text-white/60">Ton CA mensuel projeté</span>
          <motion.span
            key={revenue}
            initial={{ scale: 0.9, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            className="my-2 text-4xl font-bold text-gradient"
          >
            {fmt(revenue)} €
          </motion.span>
          <div className="mt-4 space-y-1 text-sm text-white/60">
            <div>
              Ton investissement : <span className="text-white">{fmt(PLAN_COST)} €/mois</span>
            </div>
            <div>
              ROI projeté : <span className="font-semibold text-emerald-300">{fmt(roi)} %</span>
            </div>
          </div>
          <a
            href="/generate"
            className="mt-6 inline-block rounded-full bg-genesis-gradient px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.03]"
          >
            Commencer à générer →
          </a>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-white/30">
        * Projection illustrative. Les revenus réels dépendent de ton marché, de
        tes prix et de ton volume de ventes.
      </p>
    </section>
  );
}
