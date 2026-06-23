import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase env is present. Lets the app degrade gracefully in dev. */
export const isSupabaseConfigured = Boolean(url && serviceKey);

/**
 * Server-side admin client (service-role key, bypasses RLS). Use ONLY in route
 * handlers / server components — never ship the service key to the browser.
 * Returns null when unconfigured so callers can no-op in demo mode.
 */
export function supabaseAdmin(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Anon client used to verify credentials against Supabase Auth
 * (signInWithPassword / signUp). Safe to create per-request.
 */
export function supabaseAuthClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
