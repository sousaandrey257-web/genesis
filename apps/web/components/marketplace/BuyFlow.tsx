'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, Loader2, ShieldCheck, Server, Globe } from 'lucide-react';
import type { Listing } from '@/lib/marketplace';

const EUR = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const INCLUDED = [
  { icon: Globe, label: 'Transfert du domaine et du déploiement Vercel' },
  { icon: Server, label: 'Migration de la base Supabase (données + schéma)' },
  { icon: ShieldCheck, label: 'Code source complet + propriété intellectuelle' },
];

export default function BuyFlow({
  listing,
  onClose,
}: {
  listing: Listing | null;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    if (!listing) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/marketplace/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          kind: listing.kind,
          priceEUR: listing.priceEUR,
          productName: listing.title,
          notes,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Paiement indisponible pour le moment.');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Une erreur réseau est survenue. Réessaie.');
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {listing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Acheter ${listing.title}`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative grid max-h-[90vh] w-full max-w-4xl grid-cols-1 overflow-y-auto rounded-2xl glass-strong md:grid-cols-2"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute right-4 top-4 z-10 rounded-full bg-black/40 p-2 text-white/70 transition hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Preview */}
            <div className="relative min-h-[220px] bg-black/40">
              {listing.previewUrl ? (
                <iframe
                  src={listing.previewUrl}
                  title={`Aperçu ${listing.title}`}
                  className="h-full min-h-[220px] w-full"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div
                  className="flex h-full min-h-[220px] items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${listing.thumbnailColor} 0%, rgba(10,10,15,0.9) 95%)`,
                  }}
                >
                  <span className="text-lg font-semibold text-white/90">
                    {listing.title}
                  </span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col gap-5 p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-glow/80">
                  {listing.sector}
                </p>
                <h2 className="mt-1 text-xl font-bold text-white">{listing.title}</h2>
                <p className="mt-1 text-sm text-white/50">par {listing.sellerName}</p>
              </div>

              <div className="text-3xl font-bold text-gradient">
                {EUR.format(listing.priceEUR)}
              </div>

              <ul className="space-y-2.5 text-sm">
                {INCLUDED.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5 text-white/70">
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>

              <div>
                <label
                  htmlFor="buyflow-notes"
                  className="mb-1.5 block text-sm font-medium text-white/80"
                >
                  Demander des modifications (optionnel)
                </label>
                <textarea
                  id="buyflow-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Ex : changer la palette, ajouter une page contact…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-glow/60 focus:outline-none"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleBuy}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-genesis-gradient px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirection vers Stripe…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Acheter maintenant
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
