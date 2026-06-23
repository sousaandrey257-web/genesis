'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Starts Stripe Checkout for a plan; bounces to /login if not authenticated. */
export default function CheckoutButton({
  plan,
  children,
  className,
}: {
  plan: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Erreur de paiement.');
      window.location.href = json.url;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={go} disabled={loading} className={className}>
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Redirection…
          </span>
        ) : (
          children
        )}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-300">{error}</p>}
    </div>
  );
}
