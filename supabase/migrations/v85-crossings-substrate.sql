-- v85 — Cruzar Crossing substrate
--
-- Per-trip signed record that every consumer-side feature composes onto.
-- Fixes the "list of disconnected point-tools" problem (Diego 2026-05-04
-- night). Mirrors the B2B Cruzar Ticket pattern (lib/ticket/) — Ed25519
-- signed canonical JSON with modules_present array.
--
-- Block schema (jsonb):
--   prep      — bridge intent, doc status, weather, predicted-wait at start
--   alert     — alert fire timestamp, threshold, channels
--   live      — wait readings + camera frames during cross
--   detection — auto-cross timestamp, geofence path, confidence
--   report    — linked crossing_report row
--   closure   — alert turned off, reason, snoozed_until
--   safety    — co-pilot, family ETA, /sos
--   context   — EONET nearby events, closures, officer staffing
--   commerce  — casa-de-cambio used, business visited, exchange rate

create table if not exists public.crossings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  port_id text not null,
  direction text not null check (direction in ('us_to_mx', 'mx_to_us')),
  status text not null default 'planning'
    check (status in ('planning', 'en_route', 'in_line', 'crossing', 'completed', 'abandoned')),
  modules_present text[] not null default '{}',
  cohort_tags text[] not null default '{}',
  blocks jsonb not null default '{}'::jsonb,
  signature text,
  signed_at timestamptz,
  signing_key_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crossings_user_id_idx on public.crossings (user_id, started_at desc);
create index if not exists crossings_port_id_started_idx on public.crossings (port_id, started_at desc);
create index if not exists crossings_status_idx on public.crossings (status) where status in ('planning', 'en_route', 'in_line', 'crossing');

-- updated_at trigger
create or replace function public.touch_crossings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_crossings_touch on public.crossings;
create trigger trg_crossings_touch
  before update on public.crossings
  for each row execute function public.touch_crossings_updated_at();

-- RLS — users see their own; admin (service role) sees all.
-- Public viewer at /crossing/[id] is opt-in via a separate share-token
-- mechanism (not in v0; planning will use service-role read for the
-- viewer page, which the user can choose to share or not).
alter table public.crossings enable row level security;

drop policy if exists "users read own crossings" on public.crossings;
create policy "users read own crossings" on public.crossings
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own crossings" on public.crossings;
create policy "users insert own crossings" on public.crossings
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own crossings" on public.crossings;
create policy "users update own crossings" on public.crossings
  for update using (auth.uid() = user_id);

-- Alert snooze column. Closure block writes here when an alert is
-- auto-disabled (cross-detected or user tapped "ya crucé"). send-alerts
-- cron skips alerts where snoozed_until > now().
alter table public.alert_preferences
  add column if not exists snoozed_until timestamptz;

create index if not exists alert_preferences_snoozed_until_idx
  on public.alert_preferences (snoozed_until)
  where snoozed_until is not null;

-- Link from crossings back to source rows (for backfill + future joins).
alter table public.crossings
  add column if not exists linked_auto_crossing_id uuid,
  add column if not exists linked_report_id uuid;
