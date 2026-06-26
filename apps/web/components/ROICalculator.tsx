'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import { recommendPlanForVolume } from '@/lib/plans';

export default function ROICalculator() {
  const t = useT();
  const [price, setPrice] = useState(1000); // resale price per site
  const [volume, setVolume] = useState(10); // sites sold per month

  // Real recommendation: the cheapest paid plan that covers this volume.
  const plan = recommendPlanForVolume(volume);
  const cost = plan.monthlyPrice;
  const revenue = price * volume;
  const netProfit = revenue - cost;
  const roi = cost > 0 ? Math.round((netProfit / cost) * 100) : null;
  // Sites you must sell to cover the subscription (break-even).
  const breakEven = price > 0 ? Math.max(1, Math.ceil(cost / price)) : 0;

  const locale = t({ fr: 'fr-FR', en: 'en-US' });
  const fmt = (n: number) => n.toLocaleString(locale);

  return (
    <section className="mx-auto max-w-4xl px-6 py-28">
      <div className="mb-12 text-center">
        <h2 className="font-display text-3xl font-medium sm:text-5xl">
          {t({ fr: 'Calcule ton ', en: 'Calculate your ' })}
          <span className="text-gradient">
            {t({ fr: 'retour sur investissement', en: 'return on investment' })}
          </span>
        </h2>
        <p className="mt-3 text-white/50">
          {t({
            fr: 'Fixe ton prix et ton volume — on calcule ton bénéfice net et l’abonnement qu’il te faut.',
            en: 'Set your price and volume — we compute your net profit and the plan you need.',
          })}
        </p>
      </div>

      <div className="grid gap-8 rounded-3xl glass-strong p-8 md:grid-cols-2 md:p-10">
        <div className="space-y-8">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-white/70">
                {t({ fr: 'Tu revends un site combien ?', en: 'How much do you resell a site for?' })}
              </span>
              <span className="font-semibold text-violet-200">{fmt(price)} €</span>
            </div>
            <input
              type="range"
              min={200}
              max={20000}
              step={100}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full accent-violet-glow"
            />
          </div>

          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-white/70">
                {t({ fr: 'Combien de sites par mois ?', en: 'How many sites per month?' })}
              </span>
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

          {/* Real plan recommendation */}
          <div className="rounded-2xl border border-violet-glow/30 bg-violet-glow/[0.07] p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/40">
              {t({ fr: 'Abonnement recommandé', en: 'Recommended plan' })}
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-display text-2xl font-medium">{plan.name}</span>
              <span className="text-violet-200">
                {fmt(cost)} {t({ fr: '€/mois', en: '€/month' })}
              </span>
            </div>
            <p className="mt-2 text-sm text-white/55">
              {t({
                fr: `Pour ${volume} site${volume > 1 ? 's' : ''}/mois, l’offre ${plan.name} est la plus rentable. Tu la rembourses dès ${breakEven} vente${breakEven > 1 ? 's' : ''}.`,
                en: `For ${volume} site${volume > 1 ? 's' : ''}/month, the ${plan.name} plan is the most profitable. It pays for itself in ${breakEven} sale${breakEven > 1 ? 's' : ''}.`,
              })}
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-violet-glow/15 to-electric/10 p-8 text-center">
          <span className="text-sm text-white/60">
            {t({ fr: 'Ton bénéfice net mensuel', en: 'Your net monthly profit' })}
          </span>
          <motion.span
            key={netProfit}
            initial={{ scale: 0.9, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            className="my-2 font-display text-4xl font-medium text-gradient sm:text-5xl"
          >
            {fmt(netProfit)} €
          </motion.span>
          <div className="mt-4 space-y-1.5 text-sm text-white/60">
            <div className="flex justify-between">
              <span>{t({ fr: 'Chiffre d’affaires', en: 'Revenue' })}</span>
              <span className="text-white">{fmt(revenue)} €</span>
            </div>
            <div className="flex justify-between">
              <span>{t({ fr: 'Abonnement', en: 'Subscription' })} ({plan.name})</span>
              <span className="text-white">− {fmt(cost)} €</span>
            </div>
            {roi !== null && (
              <div className="flex justify-between border-t border-white/10 pt-1.5">
                <span>{t({ fr: 'ROI', en: 'ROI' })}</span>
                <span className="font-semibold text-emerald-300">{fmt(roi)} %</span>
              </div>
            )}
          </div>
          <a
            href="#pricing"
            className="mt-6 inline-block rounded-full bg-genesis-gradient px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.03]"
          >
            {t({ fr: `Choisir l’offre ${plan.name} →`, en: `Choose the ${plan.name} plan →` })}
          </a>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-white/30">
        {t({
          fr: '* Le bénéfice est calculé sur le prix et le volume que tu fixes, moins l’abonnement réel. Les revenus dépendent de ton marché.',
          en: '* Profit is computed from the price and volume you set, minus the real subscription cost. Revenue depends on your market.',
        })}
      </p>
    </section>
  );
}
