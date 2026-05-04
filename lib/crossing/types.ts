// lib/crossing/types.ts
//
// Cruzar Crossing — per-trip signed substrate.
//
// Mirrors the architecture of lib/ticket/types.ts (B2B trade-clearance side)
// but composes consumer-side trip blocks: prep, alert, live, detection,
// report, closure, safety, context, commerce.
//
// Same Ed25519 signing key as Ticket (CRUZAR_TICKET_SIGNING_KEY env). One
// signing key for all signed Cruzar artifacts.
//
// modules_present array tells consumers (UI / ML training / API) which
// blocks fired for this crossing.

export type CrossingDirection = 'us_to_mx' | 'mx_to_us';

export type CrossingStatus =
  | 'planning'    // user opened bridge page or set alert; not yet at the bridge
  | 'en_route'    // co-pilot active, on the way
  | 'in_line'    // detected at bridge approach geofence
  | 'crossing'   // detected mid-cross (between approach and exit geofence)
  | 'completed'  // exit geofence crossed OR report submitted
  | 'abandoned'; // crossed back without going through, or trip cancelled

export type CrossingModule =
  | 'prep' | 'alert' | 'live' | 'detection'
  | 'report' | 'closure' | 'safety' | 'context' | 'commerce';

// === per-module blocks ===

export interface CrossingPrepBlock {
  predicted_wait_min_at_start: number | null;
  predicted_wait_source: 'cbp_climatology' | 'rf_v0_5_2' | 'community' | null;
  has_sentri: boolean | null;
  vehicle_type?: 'sedan' | 'pickup' | 'truck' | 'commercial' | 'pedestrian' | null;
  documents_ready?: { passport?: boolean; sentri_card?: boolean; fmm?: boolean; insurance?: boolean };
  weather_at_start?: { temp_f?: number; conditions?: string };
  route_plan?: { from?: string; to?: string };
  party_size?: number;
}

export interface CrossingAlertBlock {
  alert_id: string;
  threshold_minutes: number;
  fired_at: string; // ISO
  predicted_drop_min: number; // wait at fire time
  channels: ('push' | 'sms' | 'email')[];
  delivered_to_devices: number;
}

export interface CrossingLiveBlock {
  wait_readings: { recorded_at: string; vehicle?: number | null; sentri?: number | null; pedestrian?: number | null; commercial?: number | null }[];
  camera_frames: { url: string; captured_at: string }[];
  anomaly_flags: ('officer_staffing_drop' | 'wait_spike' | 'eonet_event_nearby')[];
}

export interface CrossingDetectionBlock {
  detected_at: string;
  detection_source: 'geofence_approach' | 'geofence_exit' | 'manual_button' | 'report_submission';
  confidence: number; // 0..1
  approach_at?: string;
  exit_at?: string;
  duration_min?: number;
  lane_inferred?: 'vehicle' | 'sentri' | 'pedestrian' | 'commercial' | null;
  geofence_path?: { lat: number; lng: number; t: string }[];
}

export interface CrossingReportBlock {
  report_id: string; // crossing_reports.id
  wait_minutes: number | null;
  report_type: string;
  submitted_at: string;
}

export interface CrossingClosureBlock {
  closed_at: string;
  reason: 'auto_geofence_exit' | 'user_button_ya_cruce' | 'report_submitted' | 'manual';
  alert_id_snoozed: string | null;
  snoozed_until: string | null; // ISO
}

export interface CrossingSafetyBlock {
  copilot_active: boolean;
  family_eta_fired: boolean;
  contacts_texted: number;
  sos_invoked: boolean;
}

export interface CrossingContextBlock {
  eonet_events_nearby: { id: string; title: string; category: string; distance_km: number }[];
  closures_detected: string[];
  officer_staffing_anomaly: boolean | null;
}

export interface CrossingCommerceBlock {
  casa_de_cambio_used?: { name?: string; rate?: number };
  business_visited?: string[]; // negocios ids
  exchange_rate_snapshot?: { sell?: number; buy?: number; ts: string };
}

// === main payload ===

export interface CruzarCrossingV1 {
  schema: 'cruzar.crossing.v1';
  id: string;
  user_id: string;
  port_id: string;
  port_name?: string;
  direction: CrossingDirection;
  status: CrossingStatus;
  modules_present: CrossingModule[];
  cohort_tags: string[];
  started_at: string;
  ended_at: string | null;
  blocks: {
    prep?: CrossingPrepBlock;
    alert?: CrossingAlertBlock;
    live?: CrossingLiveBlock;
    detection?: CrossingDetectionBlock;
    report?: CrossingReportBlock;
    closure?: CrossingClosureBlock;
    safety?: CrossingSafetyBlock;
    context?: CrossingContextBlock;
    commerce?: CrossingCommerceBlock;
  };
}

export interface SignedCrossing {
  payload_canonical: string;
  payload: CruzarCrossingV1;
  content_hash: string;
  signature_b64: string;
  signing_key_id: string;
}

// Composer input — partial blocks; only present blocks appear in modules_present.
export interface CrossingComposeInput {
  user_id: string;
  port_id: string;
  port_name?: string;
  direction: CrossingDirection;
  status?: CrossingStatus;
  cohort_tags?: string[];
  prep?: CrossingPrepBlock;
  alert?: CrossingAlertBlock;
  live?: CrossingLiveBlock;
  detection?: CrossingDetectionBlock;
  report?: CrossingReportBlock;
  closure?: CrossingClosureBlock;
  safety?: CrossingSafetyBlock;
  context?: CrossingContextBlock;
  commerce?: CrossingCommerceBlock;
}
