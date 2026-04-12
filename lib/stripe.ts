import Stripe from 'stripe'

// Trim every Stripe env var. Vercel's env UI silently preserves trailing
// newlines when you copy-paste from a terminal or dashboard, and the Stripe
// SDK puts STRIPE_SECRET_KEY into the Authorization header verbatim — a
// stray \n there breaks HTTP header formatting and Stripe returns a generic
// "connection error" after two retries, which is nearly impossible to
// diagnose without a dedicated tool. Trim defensively at the source.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim()
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID?.trim()
const STRIPE_BUSINESS_PRICE_ID = process.env.STRIPE_BUSINESS_PRICE_ID?.trim()

// Intentionally do NOT pin apiVersion — mismatched pins cause fake
// "connection" errors on every request. Let the SDK use its own default.
export function getStripe() {
  return new Stripe(STRIPE_SECRET_KEY!)
}

export const PLANS = {
  pro: {
    name: 'Pro',
    price: 499, // cents
    priceId: STRIPE_PRO_PRICE_ID!,
    features: [
      'No ads',
      'AI wait time predictions',
      'Custom alerts',
      'Full route optimizer',
      'Save unlimited crossings',
    ],
  },
  business: {
    name: 'Business',
    price: 4999, // cents
    priceId: STRIPE_BUSINESS_PRICE_ID!,
    features: [
      'Everything in Pro',
      'Fleet manager panel',
      'Commercial lane focus',
      'Historical data exports (CSV)',
      'API access',
      '90-day trend analysis',
      'Priority support',
    ],
  },
}
