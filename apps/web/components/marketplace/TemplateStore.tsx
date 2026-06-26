'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Palette, ArrowUpRight } from 'lucide-react';
import type { Listing } from '@/lib/marketplace';

const EUR = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export default function TemplateStore({ listings }: { listings: Listing[] }) {
  const templates = useMemo(
    () => listings.filter((l) => l.kind === 'template'),
    [listings],
  );

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(listing: Listing) {
    setLoadingId(listing.id);
    setError(null);
    try {
      const res = await fetch('/api/marketplace/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          kind: 'template',
          priceEUR: listing.priceEUR,
          productName: listing.title,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Achat indisponible pour le moment.');
        setLoadingId(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Une erreur réseau est survenue. Réessaie.');
      setLoadingId(null);
    }
  }

  if (templates.length === 0) return null;

  return (
    <div>
      {error && (
        <p className="mb-6 rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => {
          const loading = loadingId === t.id;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45 }}
              whileHover={{ y: -5 }}
              className="group flex flex-col overflow-hidden rounded-2xl glass transition hover:border-violet-glow/40"
            >
              <div
                className="relative flex h-32 items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${t.thumbnailColor} 0%, rgba(10,10,15,0.85) 95%)`,
                }}
              >
                <Palette className="h-8 w-8 text-white/80" />
                <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur">
                  {t.sector}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <h3 className="text-base font-semibold text-white">{t.title}</h3>
                  <p className="mt-1 text-xs text-white/45">par {t.sellerName}</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-gradient">
                    {EUR.format(t.priceEUR)}
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                    le créateur touche 70%
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => buy(t)}
                  disabled={loading}
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-genesis-gradient px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Redirection…
                    </>
                  ) : (
                    <>
                      Acheter le template
                      <ArrowUpRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
