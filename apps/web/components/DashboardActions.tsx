'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

/** Manage-billing (Stripe portal) + sign-out buttons for the dashboard header. */
export default function DashboardActions() {
  const [loading, setLoading] = useState(false);

  async function manageBilling() {
    setLoading(true);
    try {
      const res = await fetch('/api/portal', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.url) window.location.href = json.url;
      else alert(json.error || 'Facturation indisponible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={manageBilling}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm text-white/80 hover:text-white"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Gérer l’abonnement
      </button>
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="rounded-full glass px-4 py-2 text-sm text-white/60 hover:text-white"
      >
        Déconnexion
      </button>
    </div>
  );
}
