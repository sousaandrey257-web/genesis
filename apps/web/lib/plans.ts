// Single source of truth for billing plans: pricing, Stripe price IDs, limits.
// The landing PricingCards display copy stays in the component; this drives the
// actual checkout + entitlement logic.

export type PlanId = 'free' | 'starter' | 'pro' | 'business' | 'enterprise' | 'agency';

export interface Plan {
  id: PlanId;
  name: string;
  /** Display price, e.g. "79€". 'free' has no checkout. */
  price: string;
  /** Env var holding the recurring Stripe Price ID. */
  priceEnv?: string;
  /** Max sites a user can generate per calendar month (Infinity = unlimited). */
  sitesPerMonth: number;
  /** How many competitors the analysis covers. */
  competitors: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: 'free', name: 'Essai', price: '0€', sitesPerMonth: 1, competitors: 3 },
  starter: { id: 'starter', name: 'Starter', price: '19€', priceEnv: 'STRIPE_PRICE_STARTER', sitesPerMonth: 2, competitors: 5 },
  pro: { id: 'pro', name: 'Pro', price: '79€', priceEnv: 'STRIPE_PRICE_PRO', sitesPerMonth: 10, competitors: 30 },
  business: { id: 'business', name: 'Business', price: '299€', priceEnv: 'STRIPE_PRICE_BUSINESS', sitesPerMonth: Infinity, competitors: 50 },
  enterprise: { id: 'enterprise', name: 'Enterprise', price: '1 500€', priceEnv: 'STRIPE_PRICE_ENTERPRISE', sitesPerMonth: Infinity, competitors: 50 },
  agency: { id: 'agency', name: 'Agency Reseller', price: '2 999€', priceEnv: 'STRIPE_PRICE_AGENCY', sitesPerMonth: Infinity, competitors: 50 },
};

export function getPlan(id: string | null | undefined): Plan {
  return (id && PLANS[id as PlanId]) || PLANS.free;
}

/** Resolve a plan to its live Stripe Price ID, or null if not configured. */
export function priceIdFor(plan: Plan): string | null {
  if (!plan.priceEnv) return null;
  return process.env[plan.priceEnv] || null;
}

/** Reverse lookup: which plan does a given Stripe price ID belong to? */
export function planForPriceId(priceId: string): PlanId {
  for (const plan of Object.values(PLANS)) {
    if (plan.priceEnv && process.env[plan.priceEnv] === priceId) return plan.id;
  }
  return 'free';
}
