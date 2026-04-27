// Typed PostHog capture wrappers. One function per event keeps the API
// explicit and lets TypeScript catch typos in property names + enum values
// at compile time.
//
// All wrappers:
//   - Are safe to call in any environment (no-op when window/env missing)
//   - Never throw — telemetry must never break a user flow
//   - Are fire-and-forget — no await needed at call sites

import { getClientPostHog } from './posthog-client';
import { EVENTS, LEGACY_TO_POSTHOG, LEGACY_TO_VARIANT, LEGACY_TO_OUTCOME } from './events';
import type {
  UserSignedUpProps,
  UserSignedInProps,
  UserAccountDeletedProps,
  InstallCompletedProps,
  HomeVisitedProps,
  PortViewedProps,
  CrossingSavedProps,
  CrossingUnsavedProps,
  AlertCreatedProps,
  AlertRemovedProps,
  AlertOpenedProps,
  SmartRouteRequestedProps,
  BestTimesViewedProps,
  ReportSubmittedProps,
  ReportUpvotedProps,
  WaitConfirmVotedProps,
  PhotoSubmittedProps,
  AutoCrossingProps,
  PushPermissionPromptedProps,
  PushPermissionResolvedProps,
  DriverAddedProps,
  DriverRemovedProps,
  ShipmentCreatedProps,
  FleetExportRequestedProps,
  PricingViewedProps,
  CheckoutStartedProps,
  PwaGrantClaimedProps,
  ShareExecutedProps,
  ReferralLinkVisitedProps,
  FbPageFollowClickedProps,
  LanguageChangedProps,
  InstallNudgeShownProps,
  InstallNudgeResolvedProps,
  OutboundAffiliateClickedProps,
  OutboundBusinessClickedProps,
  InsightsViewedProps,
} from './types';

// ---------------------------------------------------------------------------
// Generic capture — used by the legacy trackEvent() bridge. Prefer the typed
// helpers below for new code so TypeScript can validate properties.
// ---------------------------------------------------------------------------

export function capture(eventName: string, props?: Record<string, unknown>): void {
  const ph = getClientPostHog();
  if (!ph) return;
  try {
    ph.capture(eventName, props ?? {});
  } catch { /* never throw */ }
}

// Used by lib/trackEvent.ts to forward legacy snake_case names into PostHog
// with the alias map applied + variant/outcome derivation.
export function captureLegacy(
  eventName: string,
  props?: Record<string, string | number | boolean | null | undefined>,
): void {
  const ph = getClientPostHog();
  if (!ph) return;
  const phName = LEGACY_TO_POSTHOG[eventName] ?? eventName;
  const phProps: Record<string, unknown> = { ...(props ?? {}) };
  const variant = LEGACY_TO_VARIANT[eventName];
  if (variant && phProps.variant === undefined) phProps.variant = variant;
  const outcome = LEGACY_TO_OUTCOME[eventName];
  if (outcome && phProps.outcome === undefined) phProps.outcome = outcome;
  try {
    ph.capture(phName, phProps);
  } catch { /* never throw */ }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function trackUserSignedUp(props: UserSignedUpProps): void {
  capture(EVENTS.USER_SIGNED_UP, props as unknown as Record<string, unknown>);
}

export function trackUserSignedIn(props: UserSignedInProps): void {
  capture(EVENTS.USER_SIGNED_IN, props as unknown as Record<string, unknown>);
}

export function trackUserSignedOut(): void {
  capture(EVENTS.USER_SIGNED_OUT);
}

export function trackUserAccountDeleted(props: UserAccountDeletedProps = {}): void {
  capture(EVENTS.USER_ACCOUNT_DELETED, props as unknown as Record<string, unknown>);
}

export function trackInstallCompleted(props: InstallCompletedProps): void {
  capture(EVENTS.INSTALL_COMPLETED, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Core value
// ---------------------------------------------------------------------------

export function trackHomeVisited(props: HomeVisitedProps): void {
  capture(EVENTS.HOME_VISITED, props as unknown as Record<string, unknown>);
}

export function trackPortViewed(props: PortViewedProps): void {
  capture(EVENTS.PORT_VIEWED, props as unknown as Record<string, unknown>);
}

export function trackCrossingSaved(props: CrossingSavedProps): void {
  capture(EVENTS.CROSSING_SAVED, props as unknown as Record<string, unknown>);
}

export function trackCrossingUnsaved(props: CrossingUnsavedProps): void {
  capture(EVENTS.CROSSING_UNSAVED, props as unknown as Record<string, unknown>);
}

export function trackAlertCreated(props: AlertCreatedProps): void {
  capture(EVENTS.ALERT_CREATED, props as unknown as Record<string, unknown>);
}

export function trackAlertRemoved(props: AlertRemovedProps): void {
  capture(EVENTS.ALERT_REMOVED, props as unknown as Record<string, unknown>);
}

export function trackAlertOpened(props: AlertOpenedProps): void {
  capture(EVENTS.ALERT_OPENED, props as unknown as Record<string, unknown>);
}

export function trackSmartRouteRequested(props: SmartRouteRequestedProps): void {
  capture(EVENTS.SMART_ROUTE_REQUESTED, props as unknown as Record<string, unknown>);
}

export function trackBestTimesViewed(props: BestTimesViewedProps): void {
  capture(EVENTS.BEST_TIMES_VIEWED, props as unknown as Record<string, unknown>);
}

export function trackReportSubmitted(props: ReportSubmittedProps): void {
  capture(EVENTS.REPORT_SUBMITTED, props as unknown as Record<string, unknown>);
}

export function trackReportUpvoted(props: ReportUpvotedProps): void {
  capture(EVENTS.REPORT_UPVOTED, props as unknown as Record<string, unknown>);
}

export function trackWaitConfirmVoted(props: WaitConfirmVotedProps): void {
  capture(EVENTS.WAIT_CONFIRM_VOTED, props as unknown as Record<string, unknown>);
}

export function trackPhotoSubmitted(props: PhotoSubmittedProps): void {
  capture(EVENTS.PHOTO_SUBMITTED, props as unknown as Record<string, unknown>);
}

export function trackAutoCrossingDetected(props: AutoCrossingProps): void {
  capture(EVENTS.AUTO_CROSSING_DETECTED, props as unknown as Record<string, unknown>);
}

export function trackAutoCrossingConfirmed(props: AutoCrossingProps): void {
  capture(EVENTS.AUTO_CROSSING_CONFIRMED, props as unknown as Record<string, unknown>);
}

export function trackAutoCrossingRejected(props: AutoCrossingProps): void {
  capture(EVENTS.AUTO_CROSSING_REJECTED, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

export function trackPushPermissionPrompted(props: PushPermissionPromptedProps = {}): void {
  capture(EVENTS.PUSH_PERMISSION_PROMPTED, props as unknown as Record<string, unknown>);
}

export function trackPushPermissionResolved(props: PushPermissionResolvedProps): void {
  capture(EVENTS.PUSH_PERMISSION_RESOLVED, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Business tier (browser-side; server emits driver.checked_in + shipment.* via posthog-server)
// ---------------------------------------------------------------------------

export function trackDriverAdded(props: DriverAddedProps): void {
  capture(EVENTS.DRIVER_ADDED, props as unknown as Record<string, unknown>);
}

export function trackDriverRemoved(props: DriverRemovedProps): void {
  capture(EVENTS.DRIVER_REMOVED, props as unknown as Record<string, unknown>);
}

export function trackShipmentCreated(props: ShipmentCreatedProps): void {
  capture(EVENTS.SHIPMENT_CREATED, props as unknown as Record<string, unknown>);
}

export function trackFleetDashboardViewed(): void {
  capture(EVENTS.FLEET_DASHBOARD_VIEWED);
}

export function trackFleetExportRequested(props: FleetExportRequestedProps = {}): void {
  capture(EVENTS.FLEET_EXPORT_REQUESTED, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export function trackPricingViewed(props: PricingViewedProps = {}): void {
  capture(EVENTS.PRICING_VIEWED, props as unknown as Record<string, unknown>);
}

export function trackCheckoutStarted(props: CheckoutStartedProps): void {
  capture(EVENTS.CHECKOUT_STARTED, props as unknown as Record<string, unknown>);
}

export function trackPwaGrantClaimed(props: PwaGrantClaimedProps): void {
  capture(EVENTS.PWA_GRANT_CLAIMED, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

export function trackShareExecuted(props: ShareExecutedProps): void {
  capture(EVENTS.SHARE_EXECUTED, props as unknown as Record<string, unknown>);
}

export function trackReferralLinkVisited(props: ReferralLinkVisitedProps): void {
  capture(EVENTS.REFERRAL_LINK_VISITED, props as unknown as Record<string, unknown>);
}

export function trackFbPageFollowClicked(props: FbPageFollowClickedProps): void {
  capture(EVENTS.FB_PAGE_FOLLOW_CLICKED, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export function trackLanguageChanged(props: LanguageChangedProps): void {
  capture(EVENTS.LANGUAGE_CHANGED, props as unknown as Record<string, unknown>);
}

export function trackInstallNudgeShown(props: InstallNudgeShownProps): void {
  capture(EVENTS.INSTALL_NUDGE_SHOWN, props as unknown as Record<string, unknown>);
}

export function trackInstallNudgeResolved(props: InstallNudgeResolvedProps): void {
  capture(EVENTS.INSTALL_NUDGE_RESOLVED, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Outbound
// ---------------------------------------------------------------------------

export function trackOutboundAffiliateClicked(props: OutboundAffiliateClickedProps): void {
  capture(EVENTS.OUTBOUND_AFFILIATE_CLICKED, props as unknown as Record<string, unknown>);
}

export function trackOutboundBusinessClicked(props: OutboundBusinessClickedProps): void {
  capture(EVENTS.OUTBOUND_BUSINESS_CLICKED, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export function trackInsightsViewed(props: InsightsViewedProps = {}): void {
  capture(EVENTS.INSIGHTS_VIEWED, props as unknown as Record<string, unknown>);
}

export function trackPricingTableViewed(): void {
  capture(EVENTS.PRICING_TABLE_VIEWED);
}
