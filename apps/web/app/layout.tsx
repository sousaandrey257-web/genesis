import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
    <html lang="fr" className={inter.variable}>
      <body className="bg-ink text-white antialiased">{children}</body>
    </html>
  );
}
