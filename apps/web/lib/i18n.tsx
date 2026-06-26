'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type Lang = 'fr' | 'en';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue | null>(null);

const STORAGE_KEY = 'genesis_lang';

/**
 * App-wide language provider. Defaults to French (the product's primary market)
 * and persists the choice to localStorage. Initializing to 'fr' on both server
 * and first client render avoids hydration mismatches; the stored preference is
 * applied in an effect right after mount.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') setLangState(stored);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === 'fr' ? 'en' : 'fr';
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
      return next;
    });
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LangContext.Provider>
  );
}

/** Current language. Safe outside the provider (falls back to 'fr'). */
export function useLang(): Lang {
  return useContext(LangContext)?.lang ?? 'fr';
}

/** Full language controls (lang + setters). Throws if used outside the provider. */
export function useLanguage(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLanguage must be used within <LanguageProvider>');
  return ctx;
}

/**
 * Pick the value for the current language from a `{ fr, en }` pair. Lets a
 * component keep its own copy locally instead of a central dictionary:
 *   const t = useT();
 *   <h1>{t({ fr: 'Bonjour', en: 'Hello' })}</h1>
 */
export function useT(): <T>(pair: { fr: T; en: T }) => T {
  const lang = useLang();
  return useCallback(<T,>(pair: { fr: T; en: T }) => pair[lang], [lang]);
}
