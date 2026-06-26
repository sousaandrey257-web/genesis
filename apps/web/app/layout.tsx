import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/lib/i18n';
import LanguageToggle from '@/components/LanguageToggle';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Editorial serif display face for headlines — pairs with Inter for body.
// This is the single biggest move from "generic SaaS" to premium/editorial.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GENESIS — Décris ton idée, ton site est en ligne en 10 minutes',
  description:
    'GENESIS analyse le marché, crée un design unique, code et déploie ton site automatiquement. Sans coder. Sans agence. Sans attendre.',
  openGraph: {
    title: 'GENESIS — Le futur de la création digitale',
    description:
      'Transforme n’importe quelle idée en site web ou SaaS fonctionnel, unique et déployé en moins de 10 minutes.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="bg-ink text-white antialiased">
        <LanguageProvider>
          <LanguageToggle />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
