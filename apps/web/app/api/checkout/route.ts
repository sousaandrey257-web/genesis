import { auth } from '@/auth';
import { getStripe } from '@/lib/stripe';
import { getPlan, priceIdFor } from '@/lib/plans';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Create a Stripe Checkout Session for the chosen plan and return its URL.
 * Requires an authenticated user; reuses/creates their Stripe customer.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'auth_required', redirect: '/login' }, { status: 401 });
  }

  const { plan: planId } = (await req.json()) as { plan?: string };
  const plan = getPlan(planId);
  if (plan.id === 'free') {
    return Response.json({ error: 'Plan invalide.' }, { status: 400 });
  }

  const stripe = getStripe();
  const priceId = priceIdFor(plan);
  if (!stripe || !priceId) {
    return Response.json(
      { error: 'Stripe non configuré (clé ou Price ID manquant).' },
      { status: 503 },
    );
  }

  // Find or create the Stripe customer, stored on the profile.
  const admin = supabaseAdmin();
  let customerId: string | undefined;
  if (admin) {
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', session.user.id)
      .maybeSingle();
    customerId = profile?.stripe_customer_id ?? undefined;
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    if (admin) {
      await admin
        .from('profiles')
        .upsert(
          { id: session.user.id, email: session.user.email, stripe_customer_id: customerId },
          { onConflict: 'id' },
        );
    }
  }

  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: session.user.id,
    metadata: { userId: session.user.id, plan: plan.id },
    subscription_data: { metadata: { userId: session.user.id, plan: plan.id } },
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/?checkout=cancelled#pricing`,
    allow_promotion_codes: true,
  });

  return Response.json({ url: checkout.url });
}
