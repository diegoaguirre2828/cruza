// Cruzar Insights B2B tier definitions — single source of truth for limits.
// Pricing in PLANS (lib/stripe.ts) is the marketing surface; this file is the
// runtime contract.

export type InsightsTier = 'free' | 'starter' | 'pro' | 'fleet';

export interface TierLimits {
  maxWatchedPorts: number;
  maxRecipientEmails: number;
  maxRecipientPhones: number;
  channels: { email: boolean; sms: boolean; whatsapp: boolean };
  perPortThresholds: boolean;
  monthlyUsd: number;
  stripePriceEnv: string | null;
}

export const TIER_LIMITS: Record<InsightsTier, TierLimits> = {
  free: {
    maxWatchedPorts: 1,
    maxRecipientEmails: 1,
    maxRecipientPhones: 0,
    channels: { email: true, sms: false, whatsapp: false },
    perPortThresholds: false,
    monthlyUsd: 0,
    stripePriceEnv: null,
  },
  starter: {
    maxWatchedPorts: 5,
    maxRecipientEmails: 1,
    maxRecipientPhones: 1,
    channels: { email: true, sms: true, whatsapp: false },
    perPortThresholds: false,
    monthlyUsd: 99,
    stripePriceEnv: 'STRIPE_INSIGHTS_STARTER_PRICE_ID',
  },
  pro: {
    maxWatchedPorts: 20,
    maxRecipientEmails: 2,
    maxRecipientPhones: 1,
    channels: { email: true, sms: true, whatsapp: true },
    perPortThresholds: true,
    monthlyUsd: 299,
    stripePriceEnv: 'STRIPE_INSIGHTS_PRO_PRICE_ID',
  },
  fleet: {
    maxWatchedPorts: 50,
    maxRecipientEmails: 10,
    maxRecipientPhones: 10,
    channels: { email: true, sms: true, whatsapp: true },
    perPortThresholds: true,
    monthlyUsd: 999,
    stripePriceEnv: 'STRIPE_INSIGHTS_FLEET_PRICE_ID',
  },
};

export function getStripePriceIdForTier(tier: InsightsTier): string | null {
  const limits = TIER_LIMITS[tier];
  if (!limits.stripePriceEnv) return null;
  return process.env[limits.stripePriceEnv]?.trim() ?? null;
}
