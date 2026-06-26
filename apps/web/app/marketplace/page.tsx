import Link from 'next/link';
import { Store, ArrowRight } from 'lucide-react';
import { DEMO_LISTINGS } from '@/lib/marketplace';
import SiteGrid from '@/components/marketplace/SiteGrid';
import TemplateStore from '@/components/marketplace/TemplateStore';

export const metadata = {
  title: 'Marketplace · GENESIS',
  description:
    'Achète et vends des sites web générés par GENESIS, ou des templates premium. Transfert Vercel + Supabase inclus.',
};

export default function MarketplacePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink">
      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-24 text-center">
        <div className="absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-glow/20 blur-[120px]" />
        <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-sm text-violet-200">
          <Store className="h-4 w-4" />
          Marketplace GENESIS
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold sm:text-5xl">
          Le marketplace de sites <span className="text-gradient">GENESIS</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-white/55">
          Achète un site web complet, déjà déployé et générateur de revenus, ou un
          template premium. Transfert du domaine, du déploiement Vercel et de la base
          Supabase inclus.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-genesis-gradient px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Vendre un de mes sites
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#sites"
            className="rounded-full glass px-6 py-3 text-sm font-semibold text-white/80 transition hover:text-white"
          >
            Explorer les sites
          </a>
        </div>
      </section>

      {/* Sites */}
      <section id="sites" className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Sites <span className="text-gradient">à vendre</span>
          </h2>
          <p className="mt-2 text-white/50">
            Des sites uniques, prêts à l’emploi, avec leurs revenus des 30 derniers jours.
          </p>
        </div>
        <SiteGrid listings={DEMO_LISTINGS} />
      </section>

      {/* Templates */}
      <section id="templates" className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Templates <span className="text-gradient">premium</span>
          </h2>
          <p className="mt-2 text-white/50">
            Des designs signés par la communauté. Le créateur touche 70% sur chaque vente.
          </p>
        </div>
        <TemplateStore listings={DEMO_LISTINGS} />
      </section>
    </main>
  );
}
