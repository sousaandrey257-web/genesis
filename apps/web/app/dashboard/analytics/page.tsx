'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────

interface MetricCard {
  label: string;
  value: string;
  delta: number; // percentage change vs previous period
  hint: string;
}

interface VisitorPoint {
  day: string;
  visitors: number;
  conversions: number;
}

interface BenchmarkPoint {
  name: string;
  rate: number;
}

interface Recommendation {
  title: string;
  impact: string;
  detail: string;
}

// ─── Mock data (UI shell — real wiring comes later) ─────────────────

const METRICS: readonly MetricCard[] = [
  { label: 'Visiteurs', value: '8 420', delta: 12.4, hint: '30 derniers jours' },
  { label: 'Conversions', value: '263', delta: 8.1, hint: '30 derniers jours' },
  { label: 'Taux de conversion', value: '3,12 %', delta: 0.4, hint: 'vs 2,7 % secteur' },
  { label: 'Revenus', value: '6 480 €', delta: -3.2, hint: '30 derniers jours' },
] as const;

const VISITORS_30D: readonly VisitorPoint[] = buildVisitorSeries();

const BENCHMARK: readonly BenchmarkPoint[] = [
  { name: 'Votre site', rate: 3.12 },
  { name: 'Moyenne secteur', rate: 2.7 },
] as const;

const PERFORMANCE_SCORE = 78;

const RECOMMENDATIONS: readonly Recommendation[] = [
  {
    title: 'Renforcer la preuve sociale',
    impact: 'Impact élevé',
    detail:
      'Affichez avis et témoignages près des CTA principaux pour rassurer les visiteurs au moment de la décision.',
  },
  {
    title: 'Optimiser le tunnel mobile',
    impact: 'Impact élevé',
    detail:
      'Réduisez le formulaire à 3 champs et rendez le CTA visible dès le premier écran sur mobile.',
  },
  {
    title: 'Exploiter le test A/B « home-hero »',
    impact: 'Impact moyen',
    detail:
      'Comparez deux accroches sur 14 jours et déployez la variante gagnante pour verrouiller le gain.',
  },
] as const;

function buildVisitorSeries(): VisitorPoint[] {
  const points: VisitorPoint[] = [];
  for (let i = 0; i < 30; i += 1) {
    const base = 180 + Math.round(60 * Math.sin(i / 3.2)) + i * 4;
    const visitors = base + (i % 7 === 0 ? 40 : 0);
    const conversions = Math.max(2, Math.round(visitors * 0.031));
    points.push({ day: `J${i + 1}`, visitors, conversions });
  }
  return points;
}

// ─── Small presentational helpers ───────────────────────────────────

function Delta({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`text-xs font-medium ${
        positive ? 'text-emerald-300' : 'text-red-300'
      }`}
    >
      {positive ? '▲' : '▼'} {Math.abs(value).toFixed(1)} %
    </span>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const angle = (clamped / 100) * 360;
  const tone =
    clamped >= 75 ? '#34d399' : clamped >= 50 ? '#fbbf24' : '#f87171';
  return (
    <div className="flex items-center gap-5">
      <div
        className="relative grid h-28 w-28 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${tone} ${angle}deg, rgba(255,255,255,0.08) ${angle}deg)`,
        }}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full bg-ink">
          <span className="text-2xl font-bold">{clamped}</span>
        </div>
      </div>
      <div>
        <p className="text-sm text-white/60">Score de performance</p>
        <p className="mt-1 text-sm text-white/80">
          {clamped >= 75
            ? 'Excellent — au-dessus du marché.'
            : clamped >= 50
              ? 'Correct — des optimisations restent à saisir.'
              : 'À améliorer en priorité.'}
        </p>
      </div>
    </div>
  );
}

const TOOLTIP_STYLE = {
  background: 'rgba(16,16,25,0.95)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  color: '#f5f5fa',
  fontSize: 12,
} as const;

// ─── Page ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const totalVisitors = useMemo(
    () => VISITORS_30D.reduce((sum, p) => sum + p.visitors, 0),
    [],
  );

  return (
    <main className="min-h-screen bg-ink px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm text-white/40 hover:text-white">
              ← Tableau de bord
            </Link>
            <h1 className="mt-2 text-2xl font-bold">
              Analytics <span className="text-gradient">&amp; Croissance</span>
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {totalVisitors.toLocaleString('fr-FR')} visiteurs sur les 30 derniers jours
            </p>
          </div>
          <Link
            href="/generate"
            className="rounded-full bg-genesis-gradient px-5 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.03]"
          >
            Améliorer mon site
          </Link>
        </div>

        {/* Metric cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m) => (
            <div key={m.label} className="rounded-2xl glass p-5">
              <p className="text-sm text-white/50">{m.label}</p>
              <p className="mt-2 text-2xl font-bold">{m.value}</p>
              <div className="mt-2 flex items-center gap-2">
                <Delta value={m.delta} />
                <span className="text-xs text-white/40">{m.hint}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Visitors over 30 days */}
          <div className="rounded-2xl glass p-5 lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Visiteurs · 30 jours</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...VISITORS_30D]}>
                  <defs>
                    <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} interval={4} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                  <Area
                    type="monotone"
                    dataKey="visitors"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    fill="url(#visitorsFill)"
                    name="Visiteurs"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance score */}
          <div className="rounded-2xl glass p-5">
            <h2 className="mb-4 text-lg font-semibold">Performance</h2>
            <ScoreGauge score={PERFORMANCE_SCORE} />
            <div className="mt-6 h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...VISITORS_30D]}>
                  <Line
                    type="monotone"
                    dataKey="conversions"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={false}
                    name="Conversions"
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-white/40">Conversions quotidiennes</p>
          </div>
        </div>

        {/* Benchmark + recommendations */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Benchmark bar chart */}
          <div className="rounded-2xl glass p-5">
            <h2 className="mb-4 text-lg font-semibold">Taux de conversion vs secteur</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...BENCHMARK]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={36} unit="%" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="rate" name="Taux %" radius={[8, 8, 0, 0]} fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-emerald-300">
              +0,42 pt au-dessus de la moyenne du secteur.
            </p>
          </div>

          {/* AI recommendations */}
          <div className="rounded-2xl glass p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recommandations IA</h2>
              <span className="rounded-full bg-violet-glow/15 px-3 py-1 text-xs text-violet-200">
                Analyse mensuelle
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {RECOMMENDATIONS.map((r) => (
                <div
                  key={r.title}
                  className="rounded-xl glass-strong p-4 transition hover:scale-[1.01]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{r.title}</h3>
                    <span className="shrink-0 rounded-full bg-genesis-gradient px-2.5 py-0.5 text-xs font-medium text-white">
                      {r.impact}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/60">{r.detail}</p>
                </div>
              ))}
            </div>
            <Link
              href="/generate"
              className="mt-5 inline-block rounded-full bg-genesis-gradient px-5 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.03]"
            >
              Améliorer mon site
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
