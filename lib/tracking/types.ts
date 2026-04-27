// Auto-generated from .telemetry/tracking-plan.yaml v1 (2026-04-26).
//
// Per-event property contracts. The wrapper functions in tracking.ts use
// these to give callers compile-time safety on property names and values.
// PII (email, display_name) lives ONLY on UserTraits, never on event types.

// ---------------------------------------------------------------------------
// Identity traits — passed to identifyUser()
// ---------------------------------------------------------------------------

export type Tier = 'guest' | 'free' | 'pro' | 'business';
export type InstallState = 'web' | 'pwa' | 'twa' | 'capacitor';
export type Language = 'es' | 'en';

export interface UserTraits {
  tier: Tier;
  is_founder?: boolean;
  install_state?: InstallState;
  language?: Language;
  home_region?: string | null;
  display_name?: string | null;     // PII — traits only, never event props
  email?: string | null;            // PII — traits only, never event props
  signed_up_at?: string;            // ISO datetime, set once
  pro_started_at?: string | null;
  business_started_at?: string | null;
  // Snapshot metrics — usually written by the daily snapshot cron
  saved_crossings_count?: number;
  alerts_count?: number;
  reports_submitted_count?: number;
  points?: number;
  share_count?: number;
  last_active_at?: string;
}

// ---------------------------------------------------------------------------
// Group traits — passed to groupBusinessAccount()
// ---------------------------------------------------------------------------

export interface BusinessAccountTraits {
  name?: string;
  plan: 'business';
  mrr: number;
  created_at: string;             // ISO
  drivers_count: number;
  shipments_active_count?: number;
  shipments_total_count?: number;
}

// ---------------------------------------------------------------------------
// Event property contracts
// ---------------------------------------------------------------------------

export type SignupMethod = 'email' | 'google' | 'apple' | 'magic' | 'phone' | 'password';

export interface UserSignedUpProps {
  method: SignupMethod;
  source?: string;                // e.g. 'fb', 'whatsapp', 'r/<code>'
  referrer_code?: string;
}

export interface UserSignedInProps {
  method: SignupMethod;
}

export interface UserAccountDeletedProps {
  reason?: string;
}

export type InstallVariant =
  | 'first_visit_sheet'
  | 'browser_prompt'
  | 'ios_install_page'
  | 'post_signup'
  | 'pwa_welcome'
  | 'twa_banner'
  | 'iab_banner'
  | 'camaras_sticky'
  | 'pwa_browser'
  | 'ios_capacitor'
  | 'android_twa'
  | 'ios_safari';

export interface InstallCompletedProps {
  variant: InstallVariant;
  source?: string;
}

export interface HomeVisitedProps {
  has_saved_bridge: boolean;
  panel?: 'cerca' | 'mio' | 'comunidad';
}

export type Direction = 'northbound' | 'southbound';

export interface PortViewedProps {
  port_id: string;
  port_name: string;
  direction: Direction;
  vehicle_wait?: number;
  source?: string;                // home_saved, list, map, alert_push, etc.
}

export interface CrossingSavedProps {
  port_id: string;
  source?: string;
}

export interface CrossingUnsavedProps {
  port_id: string;
}

export type LaneType = 'vehicle' | 'sentri' | 'pedestrian' | 'commercial';

export interface AlertCreatedProps {
  port_id: string;
  threshold_minutes: number;
  lane_type: LaneType;
  source?: string;
}

export interface AlertRemovedProps {
  port_id: string;
}

export type AlertChannel = 'push' | 'email' | 'sms';

export interface AlertDeliveredProps {
  port_id: string;
  channel: AlertChannel;
  threshold_minutes: number;
  actual_wait: number;
}

export interface AlertOpenedProps {
  port_id?: string;
  channel: AlertChannel;
}

export interface SmartRouteRequestedProps {
  from_lat?: number;
  from_lng?: number;
  top_pick_port_id?: string;
  top_pick_wait_minutes?: number;
}

export interface BestTimesViewedProps {
  port_id: string;
}

export type ReportType = 'wait_time' | 'slow' | 'fast' | 'closed' | 'accident' | 'other';
export type ReportSource = 'report_form' | 'just_crossed' | 'port_list_inline' | 'waiting_mode';

export interface ReportSubmittedProps {
  port_id: string;
  report_type: ReportType;
  wait_minutes?: number;
  source: ReportSource;
}

export interface ReportUpvotedProps {
  report_id: string;
  port_id: string;
}

export interface WaitConfirmVotedProps {
  port_id: string;
  accurate: boolean;
  actual_wait?: number;
}

export interface PhotoSubmittedProps {
  port_id: string;
}

export interface AutoCrossingProps {
  port_id: string;
  wait_minutes?: number;
}

export type PushOutcome = 'granted' | 'denied' | 'dismissed';

export interface PushPermissionPromptedProps {
  source?: string;
  bridge?: string;
}

export interface PushPermissionResolvedProps {
  outcome: PushOutcome;
  source?: string;
  bridge?: string;
}

export interface DriverAddedProps {
  driver_count_after: number;
}

export interface DriverRemovedProps {
  driver_count_after: number;
}

export type ShipmentStatus = 'in_line' | 'at_bridge' | 'cleared' | 'delivered';

export interface DriverCheckedInProps {
  driver_id: string;
  status: ShipmentStatus;
  port_id?: string;
}

export interface ShipmentCreatedProps {
  shipment_id: string;
  port_id?: string;
}

export interface ShipmentStatusChangedProps {
  shipment_id: string;
  from_status: string;
  to_status: string;
}

export interface FleetExportRequestedProps {
  row_count?: number;
  range_days?: number;
}

export interface PricingViewedProps {
  source?: string;
}

export type CheckoutTier = 'pro' | 'business';
export type CheckoutProvider = 'stripe' | 'revenuecat';

export interface CheckoutStartedProps {
  target_tier: CheckoutTier;
  price_id: string;
  provider: CheckoutProvider;
}

export interface SubscriptionActivatedProps {
  tier: CheckoutTier;
  provider: CheckoutProvider;
  mrr: number;
}

export interface SubscriptionRenewedProps {
  tier: CheckoutTier;
  mrr: number;
}

export interface SubscriptionCanceledProps {
  tier: CheckoutTier;
  reason?: string;
  period_end_at?: string;
}

export interface PwaGrantClaimedProps {
  days: number;
  manual: boolean;
}

export type ShareChannel = 'whatsapp' | 'copy' | 'facebook' | 'native' | 'native_success';

export interface ShareExecutedProps {
  channel: ShareChannel;
  context: string;
  port_id?: string;
}

export interface ReferralLinkVisitedProps {
  referrer_code: string;
}

export interface FbPageFollowClickedProps {
  source: string;
  variant?: string;
}

export interface LanguageChangedProps {
  from: Language;
  to: Language;
}

export interface InstallNudgeShownProps {
  variant: InstallVariant;
  platform?: 'ios' | 'android' | 'desktop' | 'ios_safari';
}

export type InstallNudgeOutcome =
  | 'tapped_install'
  | 'dismissed'
  | 'copy_link'
  | 'whatsapp'
  | 'skip'
  | 'accepted'
  | 'declined';

export interface InstallNudgeResolvedProps {
  variant: InstallVariant;
  outcome: InstallNudgeOutcome;
  platform?: string;
}

export interface OutboundAffiliateClickedProps {
  partner: string;
  slot?: string;
  port_id?: string;
}

export type BusinessClickType =
  | 'phone'
  | 'whatsapp'
  | 'website'
  | 'address'
  | 'instagram'
  | 'facebook';

export interface OutboundBusinessClickedProps {
  business_id: string;
  click_type: BusinessClickType;
  port_id?: string;
  referrer?: string;
}

export interface InsightsViewedProps {
  source?: string;
}
