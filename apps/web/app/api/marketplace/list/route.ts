import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

interface ListBody {
  siteId?: string;
  priceEUR?: number;
}

/**
 * Publish one of the authenticated user's sites as a marketplace listing.
 * Inserts a row into public.marketplace_listings. When Supabase is not
 * configured, returns { ok: false, demo: true } so the UI can degrade gracefully.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'auth_required', redirect: '/login' }, { status: 401 });
  }

  let body: ListBody;
  try {
    body = (await req.json()) as ListBody;
  } catch {
    return Response.json({ ok: false, error: 'Requête invalide.' }, { status: 400 });
  }

  const { siteId, priceEUR } = body;
  if (!siteId || typeof priceEUR !== 'number' || priceEUR < 0 || priceEUR > 100000) {
    return Response.json({ ok: false, error: 'Paramètres invalides.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  if (!admin) {
    return Response.json({ ok: false, demo: true });
  }

  // Verify the site belongs to the requesting user before listing it.
  const { data: site } = await admin
    .from('sites')
    .select('id, business_name, sector, language')
    .eq('id', siteId)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!site) {
    return Response.json({ ok: false, error: 'Site introuvable.' }, { status: 404 });
  }

  const { error } = await admin.from('marketplace_listings').insert({
    site_id: site.id,
    seller_id: session.user.id,
    kind: 'site',
    title: site.business_name,
    sector: site.sector,
    language: site.language,
    price_eur: priceEUR,
    status: 'active',
  });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
