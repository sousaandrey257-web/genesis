import { auth } from '@/auth';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/** Open the Stripe customer portal so a user can manage their subscription. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'auth_required', redirect: '/login' }, { status: 401 });
  }

  const stripe = getStripe();
  const admin = supabaseAdmin();
  if (!stripe || !admin) {
    return Response.json({ error: 'Facturation non configurée.' }, { status: 503 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    return Response.json({ error: 'Aucun abonnement actif.' }, { status: 400 });
  }

  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const portal = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/dashboard`,
  });

  return Response.json({ url: portal.url });
}
