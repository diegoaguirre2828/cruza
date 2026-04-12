-- v15: Geo-gated reports + regional localization for businesses
--
-- Run this in Supabase SQL Editor. It adds:
--   1. Geo confidence columns on crossing_reports — so we can weight reports
--      by how close the user was to the bridge when they submitted, and
--      reject trolls submitting fake data from Houston.
--   2. mega_region on rewards_businesses — so a user in Tijuana doesn't see
--      McAllen panaderías.

-- ─── Reports: distance confidence ───────────────────────────────────────
alter table crossing_reports
  add column if not exists location_confidence varchar default 'unknown';
-- values: 'near'    — within ~5 km of the bridge (user is physically there,
--                     strongest signal, 3× weight in blending)
--         'nearby'  — within ~50 km (metro area, likely recent crosser, 3× weight)
--         'far'     — beyond 50 km (probably troll or wrong bridge, ignored)
--         'unknown' — geolocation was denied or unavailable (1× weight, default)

alter table crossing_reports
  add column if not exists reporter_distance_km numeric;
-- Privacy note: we intentionally do NOT store the reporter's raw lat/lng.
-- The distance to the bridge is enough to weight the report and nothing
-- more — it doesn't leak where the user lives or where they are right now.

create index if not exists idx_crossing_reports_location_confidence
  on crossing_reports (location_confidence);

-- Backfill existing rows so the column is never NULL
update crossing_reports
  set location_confidence = 'unknown'
  where location_confidence is null;

-- ─── Businesses: mega region for localization ──────────────────────────
alter table rewards_businesses
  add column if not exists mega_region varchar default 'rgv';
-- values: 'rgv' / 'laredo' / 'coahuila-tx' / 'el-paso' / 'sonora-az' / 'baja' / 'other'

create index if not exists idx_rewards_businesses_mega_region
  on rewards_businesses (mega_region);

-- Backfill every existing business as RGV (that's all we have right now)
update rewards_businesses
  set mega_region = 'rgv'
  where mega_region is null;
