'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, Check, Wallet, Percent } from 'lucide-react';
import { commissionFor, MARKETPLACE_COMMISSION } from '@/lib/marketplace';

const EUR = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const MIN_PRICE = 500;
const MAX_PRICE = 50000;
const STEP = 100;

interface SellableSite {
  id: string;
  businessName: string;
}

export default function SellModal({
  open,
  onClose,
  sites,
}: {
  open: boolean;
  onClose: () => void;
  sites: SellableSite[];
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [price, setPrice] = useState(4900);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const split = commissionFor(price, 'site');
  const feePct = Math.round(MARKETPLACE_COMMISSION * 100);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/marketplace/connect', { method: 'POST' });
      const data = (await res.json()) as { onboardingUrl?: string; error?: string };
      if (!res.ok || !data.onboardingUrl) {
        setError(data.error ?? 'Connexion Stripe indisponible pour le moment.');
        setConnecting(false);
        return;
      }
      window.location.href = data.onboardingUrl;
    } catch {
      setError('Une erreur réseau est survenue. Réessaie.');
      setConnecting(false);
    }
  }

  async function handleSubmit() {
    if (!siteId) {
      setError('Choisis un site à mettre en vente.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/marketplace/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, priceEUR: price }),
      });
      const data = (await res.json()) as { ok?: boolean; demo?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Impossible de publier l’annonce.');
        setLoading(false);
        return;
      }
      setDone(true);
      setLoading(false);
    } catch {
      setError('Une erreur réseau est survenue. Réessaie.');
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Mettre un site en vente"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl glass-strong p-6"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white/70 transition hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {done ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check className="h-7 w-7 text-emerald-300" />
                </div>
                <h2 className="text-xl font-bold text-white">Annonce publiée</h2>
                <p className="max-w-sm text-sm text-white/55">
                  Ton site est en vente sur le marketplace GENESIS. Tu seras prévenu dès
                  qu’un acheteur passe commande.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full bg-genesis-gradient px-6 py-2.5 text-sm font-semibold text-white"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white">Vendre un site</h2>
                <p className="mt-1 text-sm text-white/50">
                  Mets l’un de tes sites GENESIS en vente. Tu gardes {100 - feePct}% du prix.
                </p>

                {/* Site selection */}
                <div className="mt-5">
                  <label
                    htmlFor="sell-site"
                    className="mb-1.5 block text-sm font-medium text-white/80"
                  >
                    Site à vendre
                  </label>
                  {sites.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/40">
                      Aucun site disponible. Génère d’abord un site.
                    </p>
                  ) : (
                    <select
                      id="sell-site"
                      value={siteId}
                      onChange={(e) => setSiteId(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white focus:border-violet-glow/60 focus:outline-none"
                    >
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.businessName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Price slider */}
                <div className="mt-5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="sell-price" className="text-sm font-medium text-white/80">
                      Prix de vente
                    </label>
                    <span className="text-lg font-bold text-gradient">
                      {EUR.format(price)}
                    </span>
                  </div>
                  <input
                    id="sell-price"
                    type="range"
                    min={MIN_PRICE}
                    max={MAX_PRICE}
                    step={STEP}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full accent-violet-glow"
                  />
                  <div className="mt-1 flex justify-between text-xs text-white/35">
                    <span>{EUR.format(MIN_PRICE)}</span>
                    <span>{EUR.format(MAX_PRICE)}</span>
                  </div>
                </div>

                {/* Commission split */}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <div className="mb-1 inline-flex items-center gap-1.5 text-xs text-emerald-200/80">
                      <Wallet className="h-3.5 w-3.5" />
                      Tu reçois
                    </div>
                    <div className="text-xl font-bold text-emerald-300">
                      {EUR.format(split.sellerNetEUR)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-1 inline-flex items-center gap-1.5 text-xs text-white/50">
                      <Percent className="h-3.5 w-3.5" />
                      Commission GENESIS ({feePct}%)
                    </div>
                    <div className="text-xl font-bold text-white/80">
                      {EUR.format(split.platformFeeEUR)}
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
                    {error}
                  </p>
                )}

                {/* Actions: Stripe Connect onboarding + publish */}
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-black/30 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:border-violet-glow/50 disabled:opacity-60"
                  >
                    {connecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wallet className="h-4 w-4" />
                    )}
                    Connecter mon compte Stripe
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || sites.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-genesis-gradient px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Publication…
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Publier l’annonce
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs text-white/35">
                    Connecte d’abord Stripe pour recevoir tes paiements, puis publie.
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
