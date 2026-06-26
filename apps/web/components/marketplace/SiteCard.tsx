'use client';

import { motion } from 'framer-motion';
import { Star, TrendingUp, ArrowUpRight } from 'lucide-react';
import type { Listing } from '@/lib/marketplace';

const LANG_FLAG: Record<string, string> = {
  fr: '🇫🇷', en: '🇬🇧', ar: '🇸🇦', es: '🇪🇸', wo: '🇸🇳', sw: '🇰🇪', zh: '🇨🇳', hi: '🇮🇳',
};

const COUNTRY_FLAG: Record<string, string> = {
  FR: '🇫🇷', BE: '🇧🇪', US: '🇺🇸', GB: '🇬🇧', AE: '🇦🇪', ES: '🇪🇸', DE: '🇩🇪', MA: '🇲🇦', SN: '🇸🇳', CA: '🇨🇦',
};

const EUR = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function Rating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Note ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= value ? 'fill-amber-400 text-amber-400' : 'text-white/20'
          }`}
        />
      ))}
    </div>
  );
}

export default function SiteCard({
  listing,
  onBuy,
}: {
  listing: Listing;
  onBuy?: (l: Listing) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      whileHover={{ y: -6 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl glass transition hover:border-violet-glow/40"
    >
      {/* Preview area */}
      <div
        className="relative h-40 w-full overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${listing.thumbnailColor} 0%, rgba(10,10,15,0.85) 95%)`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
        <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur">
          {listing.sector}
        </span>
        <span className="absolute right-3 top-3 text-lg" aria-hidden>
          {LANG_FLAG[listing.language] ?? listing.language}
          {' '}
          {COUNTRY_FLAG[listing.country] ?? listing.country}
        </span>
        <div className="absolute bottom-3 left-3 text-2xl font-bold text-white drop-shadow">
          {EUR.format(listing.priceEUR)}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="line-clamp-2 text-base font-semibold text-white">
            {listing.title}
          </h3>
          <p className="mt-1 text-xs text-white/45">par {listing.sellerName}</p>
        </div>

        <div className="flex items-center justify-between text-sm">
          {typeof listing.revenue30dEUR === 'number' ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <TrendingUp className="h-4 w-4" />
              {EUR.format(listing.revenue30dEUR)}
              <span className="text-white/40">/ 30j</span>
            </span>
          ) : (
            <span className="text-white/35">Nouveau</span>
          )}
          {typeof listing.clientRating === 'number' && (
            <Rating value={listing.clientRating} />
          )}
        </div>

        <button
          type="button"
          onClick={() => onBuy?.(listing)}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-genesis-gradient px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Acheter
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
