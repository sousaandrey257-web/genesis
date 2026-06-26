'use client';

import { useLanguage } from '@/lib/i18n';

/** Floating FR/EN switch, fixed top-right on every page. */
export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className="fixed right-4 top-4 z-50 flex items-center gap-0.5 rounded-full glass p-0.5 text-xs font-semibold"
      role="group"
      aria-label="Language / Langue"
    >
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-3 py-1.5 uppercase transition ${
            lang === l
              ? 'bg-genesis-gradient text-white'
              : 'text-white/50 hover:text-white'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
