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
  return (
    <footer className="border-t border-white/10 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="text-xl font-bold text-gradient">GENESIS</div>
            <p className="mt-3 max-w-sm text-sm text-white/50">
              Le futur de la création digitale. Décris ton idée, GENESIS la
              transforme en site unique, déployé et prêt à convertir.
            </p>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-white/80">Langues disponibles</div>
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
            <div className="mb-3 text-sm font-semibold text-white/80">Légal</div>
            <ul className="space-y-2 text-sm text-white/50">
              <li><a href="/cgu" className="hover:text-white">Conditions générales</a></li>
              <li><a href="/confidentialite" className="hover:text-white">Confidentialité</a></li>
              <li><a href="/mentions-legales" className="hover:text-white">Mentions légales</a></li>
              <li><a href="/contact" className="hover:text-white">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/40 sm:flex-row">
          <span>© {new Date().getFullYear()} GENESIS · Le futur de la création digitale</span>
          <span>Conçu pour le monde entier 🌍</span>
        </div>
      </div>
    </footer>
  );
}
