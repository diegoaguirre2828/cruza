-- Cruzar schema v24: enrich wait_time_readings with weather + lane counts
--
-- Motivation: after 14+ days of CBP wait data accumulating in
-- wait_time_readings, the biggest unique data play left on the table is
-- weather correlation and lane utilization. Neither CBP nor any border
-- app publishes "how wait time changes under rain" or "how many lanes
-- were actually open when wait was high" — and both become proprietary
-- data the moment we start storing them.
--
-- Run this once in the Supabase SQL Editor. The columns are nullable
-- so existing rows stay untouched, and the cron starts populating them
-- on the next run after the migration lands.

alter table wait_time_readings
  add column if not exists weather_temp_c          real,
  add column if not exists weather_precip_mm       real,
  add column if not exists weather_wind_kph        real,
  add column if not exists weather_visibility_km   real,
  add column if not exists weather_condition       text,
  add column if not exists lanes_vehicle_open      smallint,
  add column if not exists lanes_sentri_open       smallint,
  add column if not exists lanes_pedestrian_open   smallint,
  add column if not exists lanes_commercial_open   smallint;

-- Index so the Datos tab can efficiently query "waits by weather"
-- per-port without a full table scan. Partial index — most rows will
-- have weather from the time the migration lands forward, so the
-- index only covers populated rows.
create index if not exists idx_wait_time_readings_weather
  on wait_time_readings (port_id, weather_precip_mm)
  where weather_precip_mm is not null;

create index if not exists idx_wait_time_readings_lanes
  on wait_time_readings (port_id, lanes_vehicle_open)
  where lanes_vehicle_open is not null;
