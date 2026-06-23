import Stripe from 'stripe';

export const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

let stripe: Stripe | null = null;

/** Lazily-constructed Stripe client. Returns null when unconfigured. */
export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
      appInfo: { name: 'GENESIS' },
    });
  }
  return stripe;
}
