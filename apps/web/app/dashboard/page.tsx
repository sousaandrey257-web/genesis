import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import {
  listSites,
  getUserPlan,
  getUsageThisMonth,
  type SiteRow,
} from '@/lib/entitlements';
import { getPlan, type Plan } from '@/lib/plans';
import { isDemoMode } from '@/lib/demo';
import DashboardActions from '@/components/DashboardActions';

export const dynamic = 'force-dynamic';

const LANG_FLAG: Record<string, string> = {
  fr: '🇫🇷', en: '🇬🇧', ar: '🇸🇦', es: '🇪🇸', wo: '🇸🇳', sw: '🇰🇪', zh: '🇨🇳', hi: '🇮🇳',
};

// Sample sites shown in demo mode (no login / no Supabase needed).
const DEMO_SITES: SiteRow[] = [
  { id: 'demo-1', business_name: 'Salon Éclat', type: 'salon', sector: 'Coiffure', language: 'fr', status: 'live', deploy_url: 'https://salon-eclat-lyon.genesis.site', created_at: '2024-01-12T10:00:00Z' },
  { id: 'demo-2', business_name: 'Bistro Lumière', type: 'restaurant', sector: 'Restauration', language: 'fr', status: 'live', deploy_url: 'https://bistro-lumiere.genesis.site', created_at: '2024-01-18T10:00:00Z' },
  { id: 'demo-3', business_name: 'NovaSaaS', type: 'saas', sector: 'SaaS', language: 'en', status: 'live', deploy_url: 'https://novasaas.genesis.site', created_at: '2024-02-02T10:00:00Z' },
  { id: 'demo-4', business_name: 'Atelier Céramique', type: 'portfolio', sector: 'Artisanat', language: 'fr', status: 'building', deploy_url: null, created_at: '2024-02-09T10:00:00Z' },
];

export default async function Dashboard() {
  const session = await auth();
  const demo = !session?.user?.id && isDemoMode();
  if (!session?.user?.id && !demo) redirect('/login');

  let sites: SiteRow[];
  let plan: Plan;
  let used: number;
  let displayName: string;

  if (demo) {
    sites = DEMO_SITES;
    plan = getPlan('pro');
    used = DEMO_SITES.length;
    displayName = 'Marie';
  } else {
    const userId = session!.user!.id;
    [sites, plan, used] = await Promise.all([
      listSites(userId),
      getUserPlan(userId),
      getUsageThisMonth(userId),
    ]);
    displayName = session!.user!.name ?? '';
  }
  const limit = plan.sitesPerMonth === Infinity ? '∞' : plan.sitesPerMonth;

  return (
    <main className="min-h-screen bg-ink px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Bonjour {displayName} 👋</h1>
            <p className="mt-1 text-sm text-white/50">
              Plan <span className="text-violet-200">{plan.name}</span> · {used}/{limit} sites ce mois-ci
            </p>
          </div>
          <DashboardActions />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tes sites</h2>
          <Link
            href="/generate"
            className="rounded-full bg-genesis-gradient px-5 py-2.5 text-sm font-semibold text-white"
          >
            + Nouveau site
          </Link>
        </div>

        {sites.length === 0 ? (
          <div className="mt-6 rounded-2xl glass p-10 text-center text-white/50">
            Aucun site pour l’instant.{' '}
            <Link href="/generate" className="text-violet-300 hover:underline">
              Génère ton premier site →
            </Link>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl glass">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-white/50">
                <tr>
                  <th className="px-5 py-3">Site</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Langue</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Lien</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-5 py-4 font-medium">{s.business_name}</td>
                    <td className="px-5 py-4 text-white/60">{s.sector ?? s.type}</td>
                    <td className="px-5 py-4">{LANG_FLAG[s.language ?? ''] ?? s.language}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          s.status === 'live'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : s.status === 'failed'
                              ? 'bg-red-500/15 text-red-300'
                              : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {s.deploy_url ? (
                        <a
                          href={s.deploy_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-violet-300 hover:underline"
                        >
                          Ouvrir ↗
                        </a>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
