// Identity-management glue. Wires Supabase auth -> PostHog identify/reset/group.
//
// Call `identifyUser()` after a signup or sign-in resolves. Call `resetIdentity()`
// on logout. The wrappers are no-ops when PostHog isn't configured (preview
// deploys, local dev) so they're safe to call unconditionally.

import type { User } from '@supabase/supabase-js';
import { getClientPostHog, optOutInternalUser } from './posthog-client';
import type { UserTraits, BusinessAccountTraits } from './types';

// Diego's own email is excluded from PostHog so internal usage doesn't
// pollute funnels. Vercel Analytics + the Supabase app_events log still
// receive the events for admin debugging.
const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL?.toLowerCase();

export function identifyUser(user: User, traits: Partial<UserTraits>): void {
  const ph = getClientPostHog();
  if (!ph) return;

  if (OWNER_EMAIL && user.email?.toLowerCase() === OWNER_EMAIL) {
    optOutInternalUser();
    return;
  }

  // PostHog convention: $set applies on every event from now on,
  // $set_once only writes when the property is unset on the person.
  ph.identify(user.id, {
    tier: traits.tier ?? 'free',
    is_founder: traits.is_founder ?? false,
    install_state: traits.install_state ?? 'web',
    language: traits.language ?? 'es',
    home_region: traits.home_region ?? null,
    display_name: traits.display_name ?? null,
    email: user.email ?? null,
    pro_started_at: traits.pro_started_at ?? null,
    business_started_at: traits.business_started_at ?? null,
    last_active_at: new Date().toISOString(),
    // Pass-through scalar counts when caller has them
    saved_crossings_count: traits.saved_crossings_count,
    alerts_count: traits.alerts_count,
    reports_submitted_count: traits.reports_submitted_count,
    points: traits.points,
    share_count: traits.share_count,
    // One-time only — don't overwrite on every login
    $set_once: {
      signed_up_at: traits.signed_up_at ?? user.created_at,
      first_seen_at: new Date().toISOString(),
    },
  });
}

export function resetIdentity(): void {
  const ph = getClientPostHog();
  ph?.reset();
}

// Bind a Business-tier user to the business_account group. Browser SDK
// is stateful — after this call every capture() in the session is
// attributed to the group automatically.
export function groupBusinessAccount(
  dispatcherId: string,
  traits?: Partial<BusinessAccountTraits>,
): void {
  const ph = getClientPostHog();
  if (!ph) return;
  ph.group('business_account', dispatcherId, {
    plan: 'business' as const,
    ...traits,
  });
}
