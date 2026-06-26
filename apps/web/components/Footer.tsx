'use client';

import { useT } from '@/lib/i18n';

const LANGUAGES = [
  ['Français', '🇫🇷'],
  ['English', '🇬🇧'],
  ['العربية', '🇸🇦'],
  ['Español', '🇪🇸'],
  ['Wolof', '🇸🇳'],
  ['Swahili', '🇰🇪'],
  ['中文', '🇨🇳'],
  ['हिन्दी', '🇮🇳'],
  ['Português', '🇵🇹'],
  ['Lingala', '🇨🇩'],
];

export default function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-white/10 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="text-xl font-bold text-gradient">GENESIS</div>
            <p className="mt-3 max-w-sm text-sm text-white/50">
              {t({
                fr: 'Le futur de la création digitale. Décris ton idée, GENESIS la transforme en site unique, déployé et prêt à convertir.',
                en: 'The future of digital creation. Describe your idea, and GENESIS turns it into a unique site, deployed and ready to convert.',
              })}
            </p>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-white/80">
              {t({ fr: 'Langues disponibles', en: 'Available languages' })}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-white/50">
              {LANGUAGES.map(([name, flag]) => (
                <span key={name} className="rounded-full glass px-2.5 py-1">
                  {flag} {name}
                </span>
              ))}
              <span className="rounded-full glass px-2.5 py-1">+40…</span>
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-white/80">
              {t({ fr: 'Légal', en: 'Legal' })}
            </div>
            <ul className="space-y-2 text-sm text-white/50">
              <li><a href="/cgu" className="hover:text-white">{t({ fr: 'Conditions générales', en: 'Terms & Conditions' })}</a></li>
              <li><a href="/confidentialite" className="hover:text-white">{t({ fr: 'Confidentialité', en: 'Privacy' })}</a></li>
              <li><a href="/mentions-legales" className="hover:text-white">{t({ fr: 'Mentions légales', en: 'Legal Notice' })}</a></li>
              <li><a href="/contact" className="hover:text-white">{t({ fr: 'Contact', en: 'Contact' })}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/40 sm:flex-row">
          <span>© {new Date().getFullYear()} GENESIS · {t({ fr: 'Le futur de la création digitale', en: 'The future of digital creation' })}</span>
          <span>{t({ fr: 'Conçu pour le monde entier 🌍', en: 'Built for the whole world 🌍' })}</span>
        </div>
      </div>
    </footer>
  );
}
