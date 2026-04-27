// Auto-generated from .telemetry/tracking-plan.yaml v1 (2026-04-26).
// Regenerate by running the product-tracking-implement-tracking skill.
//
// Single source of truth for every PostHog event name in Cruzar. Importing
// from EVENTS guarantees no typos and gives the design phase a place to
// audit the full event vocabulary in one file.

export const EVENTS = {
  // Lifecycle
  USER_SIGNED_UP: 'user.signed_up',
  USER_SIGNED_IN: 'user.signed_in',
  USER_SIGNED_OUT: 'user.signed_out',
  USER_ACCOUNT_DELETED: 'user.account_deleted',
  INSTALL_COMPLETED: 'install.completed',

  // Core value — wait times, alerts, smart-route
  HOME_VISITED: 'home.visited',
  PORT_VIEWED: 'port.viewed',
  CROSSING_SAVED: 'crossing.saved',
  CROSSING_UNSAVED: 'crossing.unsaved',
  ALERT_CREATED: 'alert.created',
  ALERT_REMOVED: 'alert.removed',
  ALERT_DELIVERED: 'alert.delivered',
  ALERT_OPENED: 'alert.opened',
  SMART_ROUTE_REQUESTED: 'smart_route.requested',
  BEST_TIMES_VIEWED: 'best_times.viewed',
  REPORT_SUBMITTED: 'report.submitted',
  REPORT_UPVOTED: 'report.upvoted',
  WAIT_CONFIRM_VOTED: 'wait_confirm.voted',
  PHOTO_SUBMITTED: 'photo.submitted',
  AUTO_CROSSING_DETECTED: 'auto_crossing.detected',
  AUTO_CROSSING_CONFIRMED: 'auto_crossing.confirmed',
  AUTO_CROSSING_REJECTED: 'auto_crossing.rejected',

  // Push
  PUSH_PERMISSION_PROMPTED: 'push.permission_prompted',
  PUSH_PERMISSION_RESOLVED: 'push.permission_resolved',

  // Business tier
  DRIVER_ADDED: 'driver.added',
  DRIVER_REMOVED: 'driver.removed',
  DRIVER_CHECKED_IN: 'driver.checked_in',
  SHIPMENT_CREATED: 'shipment.created',
  SHIPMENT_STATUS_CHANGED: 'shipment.status_changed',
  FLEET_DASHBOARD_VIEWED: 'fleet_dashboard.viewed',
  FLEET_EXPORT_REQUESTED: 'fleet_export.requested',

  // Billing
  PRICING_VIEWED: 'pricing.viewed',
  CHECKOUT_STARTED: 'checkout.started',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',
  PWA_GRANT_CLAIMED: 'pwa_grant.claimed',

  // Collaboration / social
  SHARE_EXECUTED: 'share.executed',
  REFERRAL_LINK_VISITED: 'referral.link_visited',
  FB_PAGE_FOLLOW_CLICKED: 'fb_page.follow_clicked',

  // Configuration
  LANGUAGE_CHANGED: 'language.changed',
  INSTALL_NUDGE_SHOWN: 'install_nudge.shown',
  INSTALL_NUDGE_RESOLVED: 'install_nudge.resolved',

  // Outbound
  OUTBOUND_AFFILIATE_CLICKED: 'outbound.affiliate_clicked',
  OUTBOUND_BUSINESS_CLICKED: 'outbound.business_clicked',

  // Navigation
  INSIGHTS_VIEWED: 'insights.viewed',
  PRICING_TABLE_VIEWED: 'pricing_table.viewed',
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];

// ---------------------------------------------------------------------------
// Legacy snake_case names already in use across 81 call sites in the codebase.
// The trackEvent() wrapper in lib/trackEvent.ts maps these to the dotted
// PostHog names above. Keeps the existing call sites untouched.
// ---------------------------------------------------------------------------

export const LEGACY_TO_POSTHOG: Record<string, EventName> = {
  // Direct renames
  home_visited: EVENTS.HOME_VISITED,
  report_submitted: EVENTS.REPORT_SUBMITTED,
  alert_created: EVENTS.ALERT_CREATED,
  one_tap_alert_created: EVENTS.ALERT_CREATED,
  affiliate_clicked: EVENTS.OUTBOUND_AFFILIATE_CLICKED,
  pwa_grant_claimed: EVENTS.PWA_GRANT_CLAIMED,
  pwa_grant_claimed_manual: EVENTS.PWA_GRANT_CLAIMED,
  install_completed: EVENTS.INSTALL_COMPLETED,
  fb_page_follow_click: EVENTS.FB_PAGE_FOLLOW_CLICKED,
  wait_confirm_vote: EVENTS.WAIT_CONFIRM_VOTED,
  port_photo_submitted: EVENTS.PHOTO_SUBMITTED,
  auto_crossing_started: EVENTS.AUTO_CROSSING_DETECTED,
  auto_crossing_confirmed: EVENTS.AUTO_CROSSING_CONFIRMED,
  auto_crossing_rejected: EVENTS.AUTO_CROSSING_REJECTED,
  servicios_page_view: EVENTS.PRICING_TABLE_VIEWED, // closest fit; also redundant w/ $pageview
  insights_pill_tapped: EVENTS.INSIGHTS_VIEWED,
  planner_cta_tapped: EVENTS.SMART_ROUTE_REQUESTED,

  // Push family — collapsed into 2 events
  push_prompt_allow_clicked: EVENTS.PUSH_PERMISSION_PROMPTED,
  push_prompt_granted: EVENTS.PUSH_PERMISSION_RESOLVED,
  push_prompt_denied: EVENTS.PUSH_PERMISSION_RESOLVED,
  push_prompt_dismissed: EVENTS.PUSH_PERMISSION_RESOLVED,

  // Install nudge family — collapsed into install_nudge.shown / install_nudge.resolved
  install_sheet_shown: EVENTS.INSTALL_NUDGE_SHOWN,
  install_sheet_dismissed: EVENTS.INSTALL_NUDGE_RESOLVED,
  install_prompt_available: EVENTS.INSTALL_NUDGE_SHOWN,
  install_button_tapped: EVENTS.INSTALL_NUDGE_RESOLVED,
  install_prompt_choice: EVENTS.INSTALL_NUDGE_RESOLVED,
  ios_install_page_view: EVENTS.INSTALL_NUDGE_SHOWN,
  ios_install_copy_link: EVENTS.INSTALL_NUDGE_RESOLVED,
  ios_install_whatsapp: EVENTS.INSTALL_NUDGE_RESOLVED,
  ios_install_skip: EVENTS.INSTALL_NUDGE_RESOLVED,
  post_signup_install_nudge_shown: EVENTS.INSTALL_NUDGE_SHOWN,
  post_signup_install_nudge_dismissed: EVENTS.INSTALL_NUDGE_RESOLVED,
  post_signup_install_nudge_tapped: EVENTS.INSTALL_NUDGE_RESOLVED,
  pwa_welcome_install_tapped: EVENTS.INSTALL_NUDGE_RESOLVED,
  pwa_welcome_install_choice: EVENTS.INSTALL_NUDGE_RESOLVED,
  twa_banner_shown: EVENTS.INSTALL_NUDGE_SHOWN,
  twa_banner_install_clicked: EVENTS.INSTALL_NUDGE_RESOLVED,
  twa_banner_dismissed: EVENTS.INSTALL_NUDGE_RESOLVED,
  iab_banner_shown: EVENTS.INSTALL_NUDGE_SHOWN,
  iab_banner_dismissed: EVENTS.INSTALL_NUDGE_RESOLVED,
  iab_banner_escape: EVENTS.INSTALL_NUDGE_RESOLVED,
  camaras_install_cta_shown: EVENTS.INSTALL_NUDGE_SHOWN,
  camaras_install_cta_dismissed: EVENTS.INSTALL_NUDGE_RESOLVED,
  camaras_install_cta_clicked: EVENTS.INSTALL_NUDGE_RESOLVED,
  camaras_install_cta_choice: EVENTS.INSTALL_NUDGE_RESOLVED,
  camaras_sticky_shown: EVENTS.INSTALL_NUDGE_SHOWN,
  camaras_sticky_dismissed: EVENTS.INSTALL_NUDGE_RESOLVED,
  camaras_sticky_clicked: EVENTS.INSTALL_NUDGE_RESOLVED,
};

// Maps a legacy event name to the variant property value PostHog expects on
// the consolidated install_nudge.shown / install_nudge.resolved events.
export const LEGACY_TO_VARIANT: Record<string, string> = {
  install_sheet_shown: 'first_visit_sheet',
  install_sheet_dismissed: 'first_visit_sheet',
  install_prompt_available: 'browser_prompt',
  install_button_tapped: 'browser_prompt',
  install_prompt_choice: 'browser_prompt',
  ios_install_page_view: 'ios_install_page',
  ios_install_copy_link: 'ios_install_page',
  ios_install_whatsapp: 'ios_install_page',
  ios_install_skip: 'ios_install_page',
  post_signup_install_nudge_shown: 'post_signup',
  post_signup_install_nudge_dismissed: 'post_signup',
  post_signup_install_nudge_tapped: 'post_signup',
  pwa_welcome_install_tapped: 'pwa_welcome',
  pwa_welcome_install_choice: 'pwa_welcome',
  twa_banner_shown: 'twa_banner',
  twa_banner_install_clicked: 'twa_banner',
  twa_banner_dismissed: 'twa_banner',
  iab_banner_shown: 'iab_banner',
  iab_banner_dismissed: 'iab_banner',
  iab_banner_escape: 'iab_banner',
  camaras_install_cta_shown: 'camaras_sticky',
  camaras_install_cta_dismissed: 'camaras_sticky',
  camaras_install_cta_clicked: 'camaras_sticky',
  camaras_install_cta_choice: 'camaras_sticky',
  camaras_sticky_shown: 'camaras_sticky',
  camaras_sticky_dismissed: 'camaras_sticky',
  camaras_sticky_clicked: 'camaras_sticky',
};

// Maps a legacy event name to the outcome property value for resolved events.
export const LEGACY_TO_OUTCOME: Record<string, string> = {
  push_prompt_granted: 'granted',
  push_prompt_denied: 'denied',
  push_prompt_dismissed: 'dismissed',
  install_sheet_dismissed: 'dismissed',
  install_button_tapped: 'tapped_install',
  ios_install_copy_link: 'copy_link',
  ios_install_whatsapp: 'whatsapp',
  ios_install_skip: 'skip',
  post_signup_install_nudge_dismissed: 'dismissed',
  post_signup_install_nudge_tapped: 'tapped_install',
  twa_banner_install_clicked: 'tapped_install',
  twa_banner_dismissed: 'dismissed',
  iab_banner_dismissed: 'dismissed',
  iab_banner_escape: 'tapped_install',
  camaras_install_cta_dismissed: 'dismissed',
  camaras_install_cta_clicked: 'tapped_install',
  camaras_sticky_dismissed: 'dismissed',
  camaras_sticky_clicked: 'tapped_install',
};
