import 'server-only';

import Stripe from 'stripe';

let cached: Stripe | null | undefined;

/**
 * Lazily initialise Stripe. Returns null if STRIPE_SECRET_KEY is unset,
 * so callers can implement a clean mock fallback.
 */
export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    cached = null;
    return cached;
  }

  cached = new Stripe(key);
  return cached;
}