-- =============================================================
-- Cruzar — data moat field additions (2026-04-14)
-- =============================================================
-- Paste into Supabase SQL editor. Idempotent.
--
-- Adds the 10 high-value columns buyers across trucking, insurance,
-- OEMs, CBP/DHS, and academics would pay for. See
-- memory/project_cruzar_data_moat_buyers_20260414.md for the
-- buyer-value mapping.
--
-- The two highest-value fields (🔥 across every segment):
--   - secondary_inspection
--   - made_it_on_time
-- Both are single-toggle additions to ReportForm but create
-- longitudinal risk + delivery-reliability datasets nobody else has.
-- =============================================================

ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
COMMENT ON COLUMN crossing_reports.vehicle_type IS
  'passenger_car | pickup | suv | cargo_van | semi_truck | rv | trailer | motorcycle | pedestrian | bicycle';

ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS trip_purpose TEXT;
COMMENT ON COLUMN crossing_reports.trip_purpose IS
  'commute | leisure | commercial | medical | shopping | family | other';

ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS trusted_traveler_program TEXT;
COMMENT ON COLUMN crossing_reports.trusted_traveler_program IS
  'none | sentri | nexus | fast | global_entry | ready';

ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS secondary_inspection BOOLEAN;
COMMENT ON COLUMN crossing_reports.secondary_inspection IS
  'true if user was sent to secondary inspection. High-value signal for insurance + CBP.';

ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS made_it_on_time BOOLEAN;
COMMENT ON COLUMN crossing_reports.made_it_on_time IS
  'true if the crossing got the user to their destination on time. Delivery-reliability signal nobody else has.';

ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS satisfaction_score SMALLINT;
COMMENT ON COLUMN crossing_reports.satisfaction_score IS
  'User rating 1-5 of the crossing experience. CBP-relevant perception signal.';

ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS party_size SMALLINT;
COMMENT ON COLUMN crossing_reports.party_size IS
  'Number of people in the vehicle. Affects inspection speed modeling.';

ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS vehicle_origin TEXT;
COMMENT ON COLUMN crossing_reports.vehicle_origin IS
  'us_plate | mx_plate | other';

ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS cargo_summary TEXT;
COMMENT ON COLUMN crossing_reports.cargo_summary IS
  'Commercial-only: empty | perishable | electronics | auto_parts | hazmat | household | mixed. OEM + insurance gold.';

ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS booth_number SMALLINT;
COMMENT ON COLUMN crossing_reports.booth_number IS
  'Which specific inspection booth the user went through. Enables booth-level analytics for CBP.';

ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS weather_snapshot JSONB;
COMMENT ON COLUMN crossing_reports.weather_snapshot IS
  'Weather conditions at the port at submit time. Joined from OpenWeatherMap on ingestion. JSONB: {temp_c, feels_like_c, humidity, wind_kph, precipitation_mm, condition, description}.';

-- ─── Supporting indexes for buyer-relevant queries ─────────────

CREATE INDEX IF NOT EXISTS idx_reports_secondary_inspection
  ON crossing_reports(port_id, created_at DESC)
  WHERE secondary_inspection = TRUE;

CREATE INDEX IF NOT EXISTS idx_reports_made_on_time
  ON crossing_reports(port_id, created_at DESC)
  WHERE made_it_on_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_trusted_traveler
  ON crossing_reports(trusted_traveler_program, port_id, created_at DESC)
  WHERE trusted_traveler_program IS NOT NULL AND trusted_traveler_program != 'none';

CREATE INDEX IF NOT EXISTS idx_reports_vehicle_type
  ON crossing_reports(vehicle_type, port_id, created_at DESC)
  WHERE vehicle_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_cargo_summary
  ON crossing_reports(cargo_summary, port_id, created_at DESC)
  WHERE cargo_summary IS NOT NULL;
