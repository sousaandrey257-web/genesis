import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listSites, getUserPlan, getUsageThisMonth } from '@/lib/entitlements';
import DashboardActions from '@/components/DashboardActions';

export const dynamic = 'force-dynamic';

const LANG_FLAG: Record<string, string> = {
  fr: '🇫🇷', en: '🇬🇧', ar: '🇸🇦', es: '🇪🇸', wo: '🇸🇳', sw: '🇰🇪', zh: '🇨🇳', hi: '🇮🇳',
};

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;
  const [sites, plan, used] = await Promise.all([
    listSites(userId),
    getUserPlan(userId),
    getUsageThisMonth(userId),
  ]);
  const limit = plan.sitesPerMonth === Infinity ? '∞' : plan.sitesPerMonth;

  return (
    <main className="min-h-screen bg-ink px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Bonjour {session.user.name ?? ''} 👋</h1>
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
