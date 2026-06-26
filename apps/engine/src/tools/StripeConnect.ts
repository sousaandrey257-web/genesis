import Stripe from 'stripe';

/**
 * Stripe Connect helpers powering the GENESIS marketplace.
 *
 * Sellers (and template creators) onboard as Stripe Express connected accounts.
 * Buyers pay through Checkout; GENESIS keeps a commission via an application fee
 * and the remainder is transferred to the connected account.
 *
 * Everything degrades gracefully: when Stripe is not configured (no
 * STRIPE_SECRET_KEY) the async helpers return `null` instead of throwing, so the
 * rest of the pipeline keeps working in development. `commissionFor` is pure and
 * always available.
 */

/** Platform commission on a site sale. Env `MARKETPLACE_COMMISSION`, default 0.15, clamped to 0..1. */
export const MARKETPLACE_COMMISSION: number = clamp01(
  parseRate(process.env.MARKETPLACE_COMMISSION, 0.15),
);

/** Platform commission on a premium template sale — the creator keeps 70%. */
export const TEMPLATE_COMMISSION: number = 0.3;

/** True when both the secret key and the Connect client id are present. */
export const isConnectConfigured: boolean = Boolean(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_CONNECT_CLIENT_ID,
);

export interface ConnectAccount {
  id: string;
  onboardingUrl: string;
}

export interface MarketplaceCheckout {
  url: string;
  sessionId: string;
}

let stripe: Stripe | null = null;

/**
 * Lazily-constructed Stripe client. Returns null when STRIPE_SECRET_KEY is
 * missing. We intentionally do NOT pin `apiVersion` so the SDK's default for the
 * installed major version is used (avoids type drift across SDK upgrades).
 */
function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      appInfo: { name: 'GENESIS' },
    });
  }
  return stripe;
}

/**
 * Create a Stripe Express connected account for a seller plus an onboarding
 * link. Returns null when unconfigured or on any Stripe error.
 */
export async function createConnectedAccount(opts: {
  email: string;
  country?: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<ConnectAccount | null> {
  const client = getStripe();
  if (!client) return null;

  try {
    const account = await client.accounts.create({
      type: 'express',
      email: opts.email,
      country: opts.country || 'FR',
    });
    const link = await client.accountLinks.create({
      account: account.id,
      refresh_url: opts.refreshUrl,
      return_url: opts.returnUrl,
      type: 'account_onboarding',
    });
    return { id: account.id, onboardingUrl: link.url };
  } catch (err) {
    console.error('[StripeConnect] createConnectedAccount failed:', err);
    return null;
  }
}

/**
 * Refresh / continue onboarding for an existing connected account. Returns the
 * new account-link URL, or null when unconfigured or on error.
 */
export async function createAccountLink(
  accountId: string,
  opts: { refreshUrl: string; returnUrl: string },
): Promise<string | null> {
  const client = getStripe();
  if (!client) return null;

  try {
    const link = await client.accountLinks.create({
      account: accountId,
      refresh_url: opts.refreshUrl,
      return_url: opts.returnUrl,
      type: 'account_onboarding',
    });
    return link.url;
  } catch (err) {
    console.error('[StripeConnect] createAccountLink failed:', err);
    return null;
  }
}

/**
 * Buyer pays for a generated site. GENESIS keeps MARKETPLACE_COMMISSION as an
 * application fee; the rest is transferred to the seller's connected account.
 * Returns null when unconfigured or on error.
 */
export async function createSiteCheckout(opts: {
  priceEUR: number;
  sellerAccountId: string;
  siteId: string;
  productName: string;
  buyerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<MarketplaceCheckout | null> {
  return createMarketplaceCheckout({
    priceEUR: opts.priceEUR,
    destination: opts.sellerAccountId,
    productName: opts.productName,
    buyerEmail: opts.buyerEmail,
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
    kind: 'site',
    metadata: { siteId: opts.siteId, kind: 'site' },
  });
}

/**
 * Buyer pays for a premium template. The creator keeps 70%; GENESIS keeps
 * TEMPLATE_COMMISSION as an application fee. Returns null when unconfigured or
 * on error.
 */
export async function createTemplateCheckout(opts: {
  priceEUR: number;
  creatorAccountId: string;
  templateId: string;
  productName: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<MarketplaceCheckout | null> {
  return createMarketplaceCheckout({
    priceEUR: opts.priceEUR,
    destination: opts.creatorAccountId,
    productName: opts.productName,
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
    kind: 'template',
    metadata: { templateId: opts.templateId, kind: 'template' },
  });
}

/**
 * Pure helper: split a price into the platform fee and the seller's net for the
 * given sale kind. Always works, even when Stripe is unconfigured.
 */
export function commissionFor(
  priceEUR: number,
  kind: 'site' | 'template',
): { platformFeeEUR: number; sellerNetEUR: number; feeRate: number } {
  const feeRate = kind === 'template' ? TEMPLATE_COMMISSION : MARKETPLACE_COMMISSION;
  const price = Math.max(0, priceEUR);
  const platformFeeEUR = round2(price * feeRate);
  const sellerNetEUR = round2(price - platformFeeEUR);
  return { platformFeeEUR, sellerNetEUR, feeRate };
}

/** Shared Checkout builder for both site and template sales. */
async function createMarketplaceCheckout(opts: {
  priceEUR: number;
  destination: string;
  productName: string;
  buyerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  kind: 'site' | 'template';
  metadata: Stripe.MetadataParam;
}): Promise<MarketplaceCheckout | null> {
  const client = getStripe();
  if (!client) return null;

  try {
    const { platformFeeEUR } = commissionFor(opts.priceEUR, opts.kind);
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      customer_email: opts.buyerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: toCents(opts.priceEUR),
            product_data: { name: opts.productName },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: toCents(platformFeeEUR),
        transfer_data: { destination: opts.destination },
        metadata: opts.metadata,
      },
      metadata: opts.metadata,
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
    });

    if (!session.url) return null;
    return { url: session.url, sessionId: session.id };
  } catch (err) {
    console.error('[StripeConnect] createMarketplaceCheckout failed:', err);
    return null;
  }
}

/** Parse a numeric rate from an env string, falling back to `fallback`. */
function parseRate(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Clamp a rate into the inclusive 0..1 range. */
function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Euros → integer cents for Stripe amounts. */
function toCents(eur: number): number {
  return Math.round(Math.max(0, eur) * 100);
}

/** Round euros to 2 decimal places. */
function round2(eur: number): number {
  return Math.round(eur * 100) / 100;
}
