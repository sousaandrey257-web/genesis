'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Inscription impossible.');
        if (json.needsConfirm) {
          setInfo('Vérifie ta boîte mail pour confirmer ton compte, puis connecte-toi.');
          setMode('login');
          return;
        }
      }

      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) throw new Error('Identifiants invalides.');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="absolute inset-0 grid-glow" />
      <div className="relative w-full max-w-md rounded-3xl glass-strong p-8">
        <a href="/" className="text-sm text-white/40 hover:text-white">← GENESIS</a>
        <h1 className="mt-4 text-2xl font-bold">
          {mode === 'login' ? 'Connexion' : 'Crée ton compte'}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          {mode === 'login'
            ? 'Accède à ton tableau de bord et génère tes sites.'
            : 'Commence avec 1 site gratuit, puis choisis ton plan.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'signup' && (
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nom complet"
              className="w-full rounded-xl glass px-4 py-3 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-violet-glow/50"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl glass px-4 py-3 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-violet-glow/50"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="w-full rounded-xl glass px-4 py-3 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-violet-glow/50"
          />

          {error && <p className="text-sm text-red-300">{error}</p>}
          {info && <p className="text-sm text-emerald-300">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-genesis-gradient px-6 py-3 font-semibold text-white transition hover:scale-[1.02] disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
            setInfo(null);
          }}
          className="mt-5 w-full text-center text-sm text-white/50 hover:text-white"
        >
          {mode === 'login'
            ? 'Pas encore de compte ? Inscris-toi'
            : 'Déjà un compte ? Connecte-toi'}
        </button>
      </div>
    </main>
  );
}
