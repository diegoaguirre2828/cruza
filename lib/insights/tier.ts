// lib/insights/tier.ts
// User-tier resolver + capability checks. Single source of truth for what
// each tier can do across the product. Used by API routes to gate features
// and by client UI to render tier-specific CTAs.
//
// Tier resolution:
//   anon    — no Supabase user
//   free    — authed, insights_subscribers row with tier='free' (or no row at all)
//   starter — insights_subscribers row with tier='starter' + status='active'
//   pro     — insights_subscribers row with tier='pro' + status='active'
//   fleet   — insights_subscribers row with tier='fleet' + status='active'
//
// Capability gates anchor the actual paywall: free returns math, paid
// composes signed Cruzar Tickets + downloadable filing artifacts.

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { InsightsTier } from './stripe-tiers';

export type UserTier = 'anon' | InsightsTier;

export interface TierCapabilities {
  /** Run the orchestrator + per-module scanners (free returns math). */
  can_scan: boolean;
  /** Compose a signed Cruzar Ticket persisted to the DB. Free anon scans return math; paid composes the audit-shielded artifact. */
  can_compose_ticket: boolean;
  /** Download actual filing artifacts (CAPE CSV, Form 19 PDF, Form 7551, pedimento DODA, EUDAMED XML, etc). */
  can_download_filings: boolean;
  /** Persist scan history (every scan replayable). Free anon = no history. */
  can_persist_history: boolean;
  /** Multi-user account access (Fleet only). */
  can_multi_user: boolean;
  /** Number of free Cruzar Tickets per month before rate-limit. 0 = no compose at all. */
  monthly_ticket_quota: number;
}

const TIER_CAPABILITIES: Record<UserTier, TierCapabilities> = {
  anon: {
    can_scan: true,                  // free public scans (10/IP/hr) — the wedge
    can_compose_ticket: false,       // can't sign without a user
    can_download_filings: false,
    can_persist_history: false,
    can_multi_user: false,
    monthly_ticket_quota: 0,
  },
  free: {
    can_scan: true,
    can_compose_ticket: true,        // free signup unlocks 1 signed Ticket
    can_download_filings: false,     // filing artifacts paid-only
    can_persist_history: true,
    can_multi_user: false,
    monthly_ticket_quota: 1,
  },
  starter: {
    can_scan: true,
    can_compose_ticket: true,
    can_download_filings: true,      // full CAPE CSV + Form 19 + Form 7551 access
    can_persist_history: true,
    can_multi_user: false,
    monthly_ticket_quota: 25,
  },
  pro: {
    can_scan: true,
    can_compose_ticket: true,
    can_download_filings: true,
    can_persist_history: true,
    can_multi_user: false,
    monthly_ticket_quota: 100,
  },
  fleet: {
    can_scan: true,
    can_compose_ticket: true,
    can_download_filings: true,
    can_persist_history: true,
    can_multi_user: true,
    monthly_ticket_quota: 500,
  },
};

/**
 * Resolve the tier for a Supabase auth user. Looks up the
 * insights_subscribers row; falls back to 'free' for authed-but-no-row,
 * 'anon' for null user.
 */
export async function resolveUserTier(
  sb: SupabaseClient,
  user: User | null,
): Promise<{ tier: UserTier; capabilities: TierCapabilities; subscriber_id?: number }> {
  if (!user) {
    return { tier: 'anon', capabilities: TIER_CAPABILITIES.anon };
  }
  const { data } = await sb
    .from('insights_subscribers')
    .select('id, tier, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) {
    return { tier: 'free', capabilities: TIER_CAPABILITIES.free };
  }
  // Anything past free requires status='active'
  const isPaidActive =
    (data.tier === 'starter' || data.tier === 'pro' || data.tier === 'fleet') &&
    data.status === 'active';
  const tier: UserTier = isPaidActive ? (data.tier as InsightsTier) : 'free';
  return {
    tier,
    capabilities: TIER_CAPABILITIES[tier],
    subscriber_id: data.id,
  };
}

export function capabilitiesFor(tier: UserTier): TierCapabilities {
  return TIER_CAPABILITIES[tier];
}
