import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { planForPriceId } from '@/lib/plans';

export const runtime = 'nodejs';

/**
 * Stripe webhook → syncs subscription state into public.subscriptions.
 * Configure the endpoint in Stripe to send checkout.session.completed and
 * customer.subscription.* events. Uses the raw body for signature verification.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return new Response('Stripe webhook not configured', { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing signature', { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return new Response(`Webhook signature error: ${(err as Error).message}`, { status: 400 });
  }

  const admin = supabaseAdmin();

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.metadata?.userId || s.client_reference_id;
      if (userId && s.subscription) {
        const sub = await stripe.subscriptions.retrieve(s.subscription as string);
        await upsertSubscription(admin, userId, sub);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) await upsertSubscription(admin, userId, sub);
      break;
    }
    default:
      break;
  }

  return Response.json({ received: true });
}

async function upsertSubscription(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string,
  sub: Stripe.Subscription,
) {
  if (!admin) return;
  const priceId = sub.items.data[0]?.price.id ?? '';
  const active = sub.status === 'active' || sub.status === 'trialing';
  await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan: active ? planForPriceId(priceId) : 'free',
      status: sub.status,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}
