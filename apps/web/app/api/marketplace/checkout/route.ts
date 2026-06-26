import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createSiteCheckout, createTemplateCheckout } from '@genesis/engine';

export const runtime = 'nodejs';

interface CheckoutBody {
  listingId?: string;
  kind?: 'site' | 'template';
  priceEUR?: number;
  sellerAccountId?: string;
  productName?: string;
}

/**
 * Create a Stripe Connect Checkout Session for a marketplace listing (site or
 * template). The seller's connected account is resolved from the listing row
 * when available; the request may also pass an explicit `sellerAccountId`.
 * Returns { url } or a 503 { error } when Stripe Connect is not configured.
 */
export async function POST(req: Request) {
  const session = await auth();

  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return Response.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const { listingId, kind, priceEUR, productName } = body;
  if (!listingId || (kind !== 'site' && kind !== 'template') || typeof priceEUR !== 'number') {
    return Response.json({ error: 'Paramètres manquants.' }, { status: 400 });
  }

  // Resolve the seller's connected account: prefer the listing row, fall back
  // to whatever the client provided (demo data has no DB row).
  let sellerAccountId = body.sellerAccountId ?? '';
  const admin = supabaseAdmin();
  if (admin && !sellerAccountId) {
    const { data } = await admin
      .from('marketplace_listings')
      .select('stripe_account_id')
      .eq('id', listingId)
      .maybeSingle();
    sellerAccountId = data?.stripe_account_id ?? '';
  }

  if (!sellerAccountId) {
    return Response.json(
      { error: 'Ce vendeur n’a pas encore connecté son compte Stripe.' },
      { status: 503 },
    );
  }

  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const successUrl = `${origin}/marketplace?purchase=success`;
  const cancelUrl = `${origin}/marketplace?purchase=cancelled`;
  const name = productName ?? `GENESIS ${kind}`;
  const buyerEmail = session?.user?.email ?? undefined;

  const checkout =
    kind === 'template'
      ? await createTemplateCheckout({
          priceEUR,
          creatorAccountId: sellerAccountId,
          templateId: listingId,
          productName: name,
          successUrl,
          cancelUrl,
        })
      : await createSiteCheckout({
          priceEUR,
          sellerAccountId,
          siteId: listingId,
          productName: name,
          buyerEmail,
          successUrl,
          cancelUrl,
        });

  if (!checkout) {
    return Response.json(
      { error: 'Paiement indisponible (Stripe Connect non configuré).' },
      { status: 503 },
    );
  }

  return Response.json({ url: checkout.url });
}
