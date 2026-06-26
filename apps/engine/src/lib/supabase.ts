import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

/** True when the engine has Supabase credentials. */
export const isSupabaseConfigured = Boolean(url && serviceKey);

/**
 * Server-side admin client (service-role key, bypasses RLS) for engine agents
 * that persist/read learnings. Returns null when unconfigured so every caller
 * degrades gracefully (the pipeline never fails just because Supabase is unset),
 * mirroring the web app's lib/supabase.ts.
 */
export function supabaseAdmin(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
