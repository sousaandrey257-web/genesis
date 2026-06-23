import { supabaseAdmin, isSupabaseConfigured } from './supabase';
import { getPlan, type Plan } from './plans';

export interface Entitlement {
  plan: Plan;
  used: number;
  limit: number;
  allowed: boolean;
  reason?: string;
}

/** Read the user's active plan from the subscriptions table (default: free). */
export async function getUserPlan(userId: string): Promise<Plan> {
  const admin = supabaseAdmin();
  if (!admin) return getPlan('free');
  const { data } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data || data.status !== 'active') return getPlan('free');
  return getPlan(data.plan);
}

/** Count sites the user has generated since the first of the current month. */
export async function getUsageThisMonth(userId: string): Promise<number> {
  const admin = supabaseAdmin();
  if (!admin) return 0;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count } = await admin
    .from('sites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStart);
  return count ?? 0;
}

/** Decide whether a user may generate another site right now. */
export async function checkEntitlement(userId: string): Promise<Entitlement> {
  const plan = await getUserPlan(userId);
  const used = await getUsageThisMonth(userId);
  const limit = plan.sitesPerMonth;
  const allowed = used < limit;
  return {
    plan,
    used,
    limit,
    allowed,
    reason: allowed
      ? undefined
      : `Limite atteinte : ${used}/${limit === Infinity ? '∞' : limit} sites ce mois-ci sur le plan ${plan.name}. Passe à un plan supérieur pour continuer.`,
  };
}

export interface SiteRow {
  id: string;
  business_name: string;
  type: string;
  sector: string | null;
  language: string | null;
  status: string;
  deploy_url: string | null;
  created_at: string;
}

/** Persist a generated site (no-op when Supabase is not configured). */
export async function recordSite(
  userId: string,
  site: Omit<SiteRow, 'created_at'>,
): Promise<void> {
  const admin = supabaseAdmin();
  if (!admin) return;
  await admin.from('sites').upsert({ ...site, user_id: userId });
}

/** List a user's sites for the dashboard. */
export async function listSites(userId: string): Promise<SiteRow[]> {
  const admin = supabaseAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from('sites')
    .select('id, business_name, type, sector, language, status, deploy_url, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data as SiteRow[]) ?? [];
}

export { isSupabaseConfigured };
