import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import {
  monthlyLearningReport,
  getSectorInsights,
  type LearningReport,
  type SectorInsights,
} from '@genesis/engine';

export const dynamic = 'force-dynamic';

// Common sectors GENESIS generates for — used to surface per-sector insight
// cards. Each call degrades gracefully to sector heuristics when there is no
// learning data yet, so the section is always populated.
const SECTORS = ['coiffure', 'restaurant', 'e-commerce'] as const;

export default async function LearningsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const period = new Date().toISOString().slice(0, 7); // stable YYYY-MM

  const [report, insights]: [LearningReport, SectorInsights[]] = await Promise.all([
    monthlyLearningReport(period),
    Promise.all(SECTORS.map((s) => getSectorInsights(s))),
  ]);

  const hasData = report.learned.length > 0 || insights.some((i) => i.sampleSize > 0);

  return (
    <main className="min-h-screen bg-ink px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gradient">Ce que GENESIS a appris</h1>
            <p className="mt-1 text-sm text-white/50">
              Rapport d’apprentissage · {period}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full glass px-5 py-2.5 text-sm font-semibold text-violet-200 hover:text-white"
          >
            ← Tableau de bord
          </Link>
        </div>

        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-white/70">{report.summary}</p>

        {!hasData ? (
          <div className="mt-8 rounded-2xl glass p-10 text-center text-white/50">
            GENESIS n’a pas encore assez de données pour apprendre.{' '}
            <Link href="/generate" className="text-violet-300 hover:underline">
              Génère un site pour démarrer l’apprentissage →
            </Link>
          </div>
        ) : (
          <>
            {/* ── Learned ── */}
            <section className="mt-10">
              <h2 className="text-lg font-semibold">Enseignements</h2>
              {report.learned.length === 0 ? (
                <p className="mt-3 text-sm text-white/40">
                  Aucun enseignement distillé pour le moment.
                </p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {report.learned.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-2xl glass p-5 text-sm leading-relaxed text-white/80"
                    >
                      <span className="mb-2 block text-xs font-semibold text-violet-300">
                        #{i + 1}
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Improvements ── */}
            {report.improvements.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-semibold">Améliorations prévues</h2>
                <ul className="mt-4 space-y-3">
                  {report.improvements.map((imp, i) => (
                    <li
                      key={i}
                      className="flex gap-3 rounded-xl glass px-5 py-4 text-sm text-white/80"
                    >
                      <span className="text-violet-300">→</span>
                      <span>{imp}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* ── Per-sector insights ── */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Insights par secteur</h2>
          <p className="mt-1 text-sm text-white/50">
            Patterns gagnants injectés automatiquement dans le générateur.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {insights.map((insight) => (
              <article key={insight.sector} className="rounded-2xl glass p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold capitalize text-violet-200">
                    {insight.sector}
                  </h3>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/50">
                    {insight.sampleSize > 0
                      ? `${insight.sampleSize} sites`
                      : 'heuristique'}
                  </span>
                </div>

                <div className="mt-3 flex gap-4 text-xs text-white/50">
                  <span>
                    Qualité moy.{' '}
                    <span className="text-white/80">
                      {insight.avgQuality > 0 ? insight.avgQuality : '—'}
                    </span>
                  </span>
                  <span>
                    Conv.{' '}
                    <span className="text-white/80">
                      {insight.avgConversionRate != null
                        ? `${(insight.avgConversionRate * 100).toFixed(1)}%`
                        : '—'}
                    </span>
                  </span>
                </div>

                <ul className="mt-4 space-y-2">
                  {insight.patterns.slice(0, 5).map((pattern, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/75">
                      <span className="text-violet-400">•</span>
                      <span>{pattern}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
