'use client';

import { useEffect, useRef, useState } from 'react';
import type { StreamEvent } from '@genesis/shared';
import { ArrowRight, Loader2 } from 'lucide-react';

interface FinalSite {
  id: string;
  path: string;
  framework: string;
  fileNames: string[];
  ready: boolean;
  deployUrl?: string;
}

export default function GeneratePage() {
  const [idea, setIdea] = useState('');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [site, setSite] = useState<FinalSite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const progress = events.at(-1)?.progress ?? 0;

  // A brief synthesized by the ConversationUI (/start) is handed over via
  // sessionStorage; prefill it and auto-launch the generation.
  useEffect(() => {
    const handover = sessionStorage.getItem('genesis_idea');
    if (handover) {
      sessionStorage.removeItem('genesis_idea');
      setIdea(handover);
      void generate(handover);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate(ideaOverride?: string) {
    const value = (ideaOverride ?? idea).trim();
    if (value.length < 3 || running) return;
    setRunning(true);
    setEvents([]);
    setSite(null);
    setError(null);

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: value }),
    });

    if (!res.body) {
      setError('Pas de flux reçu.');
      setRunning(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const line = part.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        try {
          const data = JSON.parse(line.slice(6)) as StreamEvent;
          if (data.status === 'error') {
            setError(data.message);
            continue;
          }
          // Final payload carries { site }
          const payload = data.data as { site?: FinalSite } | undefined;
          if (payload?.site) {
            setSite(payload.site);
          }
          setEvents((prev) => [...prev, data]);
          requestAnimationFrame(() =>
            logRef.current?.scrollTo({ top: logRef.current.scrollHeight }),
          );
        } catch {
          /* ignore keepalive */
        }
      }
    }
    setRunning(false);
  }

  return (
    <main className="min-h-screen bg-ink px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="text-sm text-white/40 hover:text-white">← GENESIS</a>
        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">
          Décris ton idée. <span className="text-gradient">GENESIS s’occupe du reste.</span>
        </h1>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            placeholder="Ex : Salon de coiffure haut de gamme à Lyon"
            disabled={running}
            className="flex-1 rounded-full glass px-6 py-4 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-violet-glow/50"
          />
          <button
            onClick={() => generate()}
            disabled={running || idea.trim().length < 3}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-genesis-gradient px-7 py-4 font-semibold text-white transition hover:scale-[1.03] disabled:opacity-50"
          >
            {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
            {running ? 'Génération…' : 'Générer'}
          </button>
        </div>

        {events.length > 0 && (
          <div className="mt-8">
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-genesis-gradient transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div
              ref={logRef}
              className="max-h-72 overflow-y-auto rounded-2xl glass-strong p-5 font-mono text-sm"
            >
              {events.map((e, i) => (
                <div key={i} className="flex items-start gap-3 py-1">
                  <span className="w-12 shrink-0 text-violet-300">{e.progress}%</span>
                  <span className="w-24 shrink-0 text-white/40">{e.stage}</span>
                  <span className="text-white/80">{e.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {site && (
          <div className="mt-8">
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              ✓ Projet Next.js 14 généré — {site.fileNames.length} fichiers prêts.
            </div>

            <h2 className="mb-2 text-lg font-semibold">Ton site</h2>
            <p className="mb-1 text-sm text-white/50">
              Framework : <span className="text-white/80">{site.framework}</span>
            </p>
            <p className="mb-4 font-mono text-xs text-white/40">{site.path}</p>

            {site.deployUrl && (
              <a
                href={site.deployUrl}
                target="_blank"
                rel="noreferrer"
                className="mb-4 inline-block text-sm text-violet-300 hover:underline"
              >
                {site.deployUrl} ↗
              </a>
            )}

            <div className="max-h-72 overflow-y-auto rounded-2xl glass-strong p-5 font-mono text-xs text-white/70">
              {site.fileNames.map((f) => (
                <div key={f} className="py-0.5">
                  <span className="text-violet-300">›</span> {f}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
