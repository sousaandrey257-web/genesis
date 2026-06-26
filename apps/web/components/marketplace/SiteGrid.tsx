'use client';

import { useMemo, useState } from 'react';
import { SearchX } from 'lucide-react';
import type { Listing } from '@/lib/marketplace';
import SiteCard from './SiteCard';
import BuyFlow from './BuyFlow';

const LANG_LABEL: Record<string, string> = {
  fr: 'Français', en: 'Anglais', ar: 'Arabe', es: 'Espagnol', wo: 'Wolof', sw: 'Swahili', zh: 'Chinois', hi: 'Hindi',
};

const PRICE_RANGES: { id: string; label: string; min: number; max: number }[] = [
  { id: 'all', label: 'Tous les prix', min: 0, max: Infinity },
  { id: 'lt2k', label: '< 2 000€', min: 0, max: 2000 },
  { id: '2k-10k', label: '2 000€ – 10 000€', min: 2000, max: 10000 },
  { id: '10k-30k', label: '10 000€ – 30 000€', min: 10000, max: 30000 },
  { id: 'gt30k', label: '> 30 000€', min: 30000, max: Infinity },
];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

const SELECT_CLASS =
  'rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/80 focus:border-violet-glow/60 focus:outline-none';

export default function SiteGrid({ listings }: { listings: Listing[] }) {
  const sites = useMemo(() => listings.filter((l) => l.kind === 'site'), [listings]);

  const sectors = useMemo(() => uniqueSorted(sites.map((l) => l.sector)), [sites]);
  const languages = useMemo(() => uniqueSorted(sites.map((l) => l.language)), [sites]);
  const countries = useMemo(() => uniqueSorted(sites.map((l) => l.country)), [sites]);

  const [sector, setSector] = useState('all');
  const [language, setLanguage] = useState('all');
  const [country, setCountry] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [active, setActive] = useState<Listing | null>(null);

  const range = PRICE_RANGES.find((r) => r.id === priceRange) ?? PRICE_RANGES[0];

  const filtered = useMemo(
    () =>
      sites.filter(
        (l) =>
          (sector === 'all' || l.sector === sector) &&
          (language === 'all' || l.language === language) &&
          (country === 'all' || l.country === country) &&
          l.priceEUR >= range.min &&
          l.priceEUR <= range.max,
      ),
    [sites, sector, language, country, range],
  );

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <select
          aria-label="Secteur"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="all">Tous les secteurs</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          aria-label="Fourchette de prix"
          value={priceRange}
          onChange={(e) => setPriceRange(e.target.value)}
          className={SELECT_CLASS}
        >
          {PRICE_RANGES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Langue"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="all">Toutes les langues</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {LANG_LABEL[l] ?? l}
            </option>
          ))}
        </select>

        <select
          aria-label="Pays"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="all">Tous les pays</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <span className="ml-auto text-sm text-white/40">
          {filtered.length} site{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl glass px-6 py-20 text-center">
          <SearchX className="h-10 w-10 text-white/30" />
          <p className="text-white/60">Aucun site ne correspond à ces filtres.</p>
          <button
            type="button"
            onClick={() => {
              setSector('all');
              setLanguage('all');
              setCountry('all');
              setPriceRange('all');
            }}
            className="text-sm text-violet-300 hover:underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <SiteCard key={l.id} listing={l} onBuy={setActive} />
          ))}
        </div>
      )}

      <BuyFlow listing={active} onClose={() => setActive(null)} />
    </div>
  );
}
