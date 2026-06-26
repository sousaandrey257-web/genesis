'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RevenuePrediction } from '@genesis/engine';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { ArrowRight, Loader2, TrendingUp } from 'lucide-react';
import { useLang } from '@/lib/i18n';

// ─── Props & types ──────────────────────────────────────────────────

interface RevenuePredictorProps {
  idea: string;
  onGenerate?: () => void;
  /** Calibrated model accuracy in [0,1]. Defaults to 0.8 (RevenueAgent baseline). */
  accuracy?: number;
}

interface MonthlyPoint {
  month: number;
  label: string;
  traffic: number;
  revenue: number;
}

interface Scenario {
  conversionRate: number; // 0..1
  averageBasket: number; // EUR
  trafficScale: number; // multiplier on the base traffic curve
}

interface DerivedProjection {
  monthly: MonthlyPoint[];
  trafficMonth1: number;
  revenueYear1: number;
  bestCase: number;
  worstCase: number;
  breakEvenMonths: number;
}

type CaseKey = 'worst' | 'expected' | 'best';

// ─── Pure helpers (no refetch — recompute scenarios client-side) ────

const MONTH_LABELS = [
  'M1', 'M2', 'M3', 'M4', 'M5', 'M6',
  'M7', 'M8', 'M9', 'M10', 'M11', 'M12',
] as const;

const round2 = (n: number): number => Math.round(n * 100) / 100;

const euros = (n: number): string =>
  `${Math.round(n).toLocaleString('fr-FR')} €`;

/**
 * Recompute the whole 12-month projection from the server baseline given the
 * client's slider choices. Pure: same inputs → same output, no network.
 * Best/worst keep their ratio to the expected year-1, and break-even is derived
 * from the fixed-cost implied by the baseline prediction.
 */
function recompute(base: RevenuePrediction, s: Scenario): DerivedProjection {
  const monthly: MonthlyPoint[] = base.monthly.map((m, i) => {
    const traffic = Math.round(m.traffic * s.trafficScale);
    return {
      month: m.month,
      label: MONTH_LABELS[i] ?? `M${m.month}`,
      traffic,
      revenue: round2(traffic * s.conversionRate * s.averageBasket),
    };
  });

  const revenueYear1 = round2(monthly.reduce((sum, m) => sum + m.revenue, 0));
  const bestRatio = base.revenueYear1 > 0 ? base.bestCase / base.revenueYear1 : 1.5;
  const worstRatio = base.revenueYear1 > 0 ? base.worstCase / base.revenueYear1 : 0.6;

  // Imply a flat monthly fixed cost from the baseline's break-even point, then
  // re-solve break-even against the new revenue curve.
  const baseBreak = Math.max(1, base.breakEvenMonths);
  const baseCumAtBreak = base.monthly
    .slice(0, baseBreak)
    .reduce((sum, m) => sum + m.revenue, 0);
  const impliedFixedCost = baseCumAtBreak / baseBreak;

  let cumulative = 0;
  let breakEvenMonths = monthly.length;
  for (const m of monthly) {
    cumulative += m.revenue;
    if (cumulative >= impliedFixedCost * m.month) {
      breakEvenMonths = m.month;
      break;
    }
  }

  return {
    monthly,
    trafficMonth1: monthly[0]?.traffic ?? 0,
    revenueYear1,
    bestCase: round2(revenueYear1 * bestRatio),
    worstCase: round2(revenueYear1 * worstRatio),
    breakEvenMonths,
  };
}

const TOOLTIP_STYLE = {
  background: 'rgba(16,16,25,0.95)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  color: '#f5f5fa',
  fontSize: 12,
} as const;

// ─── Small presentational pieces ────────────────────────────────────

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl glass p-5">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/40">{hint}</p> : null}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-white/60">{label}</span>
        <span className="font-medium text-white/90">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-glow"
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rounded-3xl glass-strong p-6">
      <div className="flex items-center gap-3 text-white/60">
        <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
        Estimation des revenus en cours…
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}

// ─── Widget ─────────────────────────────────────────────────────────

export default function RevenuePredictor({ idea, onGenerate, accuracy = 0.8 }: RevenuePredictorProps) {
  const lang = useLang();
  const [base, setBase] = useState<RevenuePrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [activeCase, setActiveCase] = useState<CaseKey>('expected');

  // Fetch a fresh prediction whenever the idea changes.
  useEffect(() => {
    const trimmed = idea.trim();
    if (trimmed.length < 3) {
      setBase(null);
      setScenario(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: trimmed, lang }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as RevenuePrediction;
      })
      .then((pred) => {
        if (cancelled) return;
        setBase(pred);
        setScenario({
          conversionRate: pred.conversionRate,
          averageBasket: pred.averageBasket,
          trafficScale: 1,
        });
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError('Impossible d’estimer les revenus pour le moment.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [idea, lang]);

  const projection = useMemo<DerivedProjection | null>(
    () => (base && scenario ? recompute(base, scenario) : null),
    [base, scenario],
  );

  const updateScenario = useCallback((patch: Partial<Scenario>) => {
    setScenario((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const accuracyPct = Math.round(accuracy * 100);

  if (loading || (!base && !error)) {
    return <Skeleton />;
  }

  if (error || !base || !scenario || !projection) {
    return (
      <div className="rounded-3xl glass-strong p-6 text-sm text-red-200">
        {error ?? 'Estimation indisponible.'}
      </div>
    );
  }

  const cases: Record<CaseKey, { label: string; value: number; color: string }> = {
    worst: { label: 'Pessimiste', value: projection.worstCase, color: '#f87171' },
    expected: { label: 'Attendu', value: projection.revenueYear1, color: '#8B5CF6' },
    best: { label: 'Optimiste', value: projection.bestCase, color: '#34d399' },
  };
  const maxCase = Math.max(projection.bestCase, projection.revenueYear1, 1);

  return (
    <div className="rounded-3xl glass-strong p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-violet-300" />
          <h2 className="text-lg font-semibold">
            Revenus <span className="text-gradient">projetés</span>
          </h2>
        </div>
        <span className="rounded-full bg-violet-glow/15 px-3 py-1 text-xs font-medium text-violet-200">
          Précis à {accuracyPct}%
        </span>
      </div>

      {/* Metric cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Trafic mois 1"
          value={projection.trafficMonth1.toLocaleString('fr-FR')}
          hint="visiteurs uniques"
        />
        <MetricCard
          label="Taux de conversion"
          value={`${(scenario.conversionRate * 100).toFixed(1)} %`}
        />
        <MetricCard label="Panier moyen" value={euros(scenario.averageBasket)} />
        <MetricCard
          label="Revenus année 1"
          value={euros(projection.revenueYear1)}
          hint="cumul 12 mois"
        />
      </div>

      {/* 12-month projection chart */}
      <div className="mt-6 rounded-2xl glass p-5">
        <h3 className="mb-4 text-sm font-semibold text-white/80">Projection sur 12 mois</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projection.monthly}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                width={52}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#8B5CF6"
                strokeWidth={2}
                fill="url(#revenueFill)"
                name="Revenus (€)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Best / expected / worst cases */}
      <div className="mt-6 rounded-2xl glass p-5">
        <h3 className="mb-4 text-sm font-semibold text-white/80">Scénarios année 1</h3>
        <div className="space-y-3">
          {(['best', 'expected', 'worst'] as const).map((key) => {
            const c = cases[key];
            const active = activeCase === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveCase(key)}
                className={`w-full rounded-xl p-3 text-left transition ${
                  active ? 'glass-strong ring-1 ring-violet-glow/40' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">{c.label}</span>
                  <span className="font-semibold" style={{ color: c.color }}>
                    {euros(c.value)}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(c.value / maxCase) * 100}%`, background: c.color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Break-even callout */}
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        <TrendingUp className="h-5 w-5 shrink-0" />
        <span>
          Rentabilisé en{' '}
          <span className="font-bold">{projection.breakEvenMonths} mois</span>
          {projection.breakEvenMonths >= 12 ? ' (ou plus selon vos hypothèses)' : ''}.
        </span>
      </div>

      {/* Scenario sliders */}
      <div className="mt-6 rounded-2xl glass p-5">
        <h3 className="mb-4 text-sm font-semibold text-white/80">
          Explorez vos hypothèses
        </h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Slider
            label="Taux de conversion"
            min={0.005}
            max={0.15}
            step={0.005}
            value={scenario.conversionRate}
            display={`${(scenario.conversionRate * 100).toFixed(1)} %`}
            onChange={(v) => updateScenario({ conversionRate: v })}
          />
          <Slider
            label="Panier moyen"
            min={10}
            max={500}
            step={5}
            value={scenario.averageBasket}
            display={euros(scenario.averageBasket)}
            onChange={(v) => updateScenario({ averageBasket: v })}
          />
          <Slider
            label="Trafic mensuel"
            min={0.5}
            max={3}
            step={0.1}
            value={scenario.trafficScale}
            display={`×${scenario.trafficScale.toFixed(1)}`}
            onChange={(v) => updateScenario({ trafficScale: v })}
          />
        </div>
      </div>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={onGenerate}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-genesis-gradient px-7 py-4 font-semibold text-white transition hover:scale-[1.02]"
      >
        Générer ce site et atteindre ces revenus
        <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}
