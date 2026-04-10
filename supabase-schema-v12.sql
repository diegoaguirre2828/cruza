-- ============================================================
-- Schema v12 — Crowdsourced exchange rates + Negocios directory
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Exchange rate reports (crowdsourced real rates from casas de cambio)
create table if not exists exchange_rate_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  house_name varchar(200) not null,
  sell_rate numeric(8,4) not null,  -- MXN you get per 1 USD (what the casa gives you)
  buy_rate numeric(8,4),            -- optional: MXN they charge per 1 USD
  port_id varchar(20),              -- which crossing this is near
  city varchar(100),
  reported_at timestamptz default now()
);

alter table exchange_rate_reports enable row level security;

create policy "Anyone can read exchange rate reports"
  on exchange_rate_reports for select using (true);

create policy "Anyone can submit exchange rate reports"
  on exchange_rate_reports for insert with check (true);

-- 2. Enhance rewards_businesses for the Negocios directory
alter table rewards_businesses
  add column if not exists whatsapp varchar(50),
  add column if not exists hours varchar(300),
  add column if not exists claimed boolean default false,
  add column if not exists listing_tier varchar(20) default 'free',
  add column if not exists notes_es varchar(500),
  add column if not exists instagram varchar(100),
  add column if not exists facebook varchar(100);

-- Update rewards_businesses RLS: allow public read of all approved listings
-- and allow anyone to submit a new business (free listing)
drop policy if exists "Anyone can read approved businesses" on rewards_businesses;

create policy "Anyone can read approved businesses"
  on rewards_businesses for select using (approved = true);

create policy "Anyone can submit a business listing"
  on rewards_businesses for insert with check (true);

-- 3. Auto-approve the seeded example businesses so they show up
update rewards_businesses set approved = true where approved = false;

-- 4. Seed a few unclaimed business examples to demonstrate the directory
insert into rewards_businesses (name, description, address, port_ids, category, logo_emoji, phone, whatsapp, hours, approved, claimed, listing_tier, notes_es)
values
  ('Casa de Cambio El Puente', 'Mejor tipo de cambio cerca del puente', 'Av. Álvaro Obregón 120, Reynosa', array['230501','230502'], 'exchange', '💱', '+52 899 922-1100', '528999221100', 'Lun-Sáb 8am–7pm, Dom 9am–3pm', true, false, 'free', 'Cambia dólares al mejor precio antes de cruzar'),
  ('Farmacia San Miguel', 'Medicamentos genéricos y de marca', 'Calle Hidalgo 45, Matamoros', array['535501','535502'], 'pharmacy', '💊', '+52 868 812-3344', '528688123344', 'Todos los días 8am–10pm', true, false, 'free', 'Precios bajos, sin receta para muchos medicamentos'),
  ('Tacos El Gordito', 'Los mejores tacos al pastor cerca del puente', 'Blvd. Canales 300, Reynosa', array['230501'], 'restaurant', '🌮', '+52 899 100-5566', null, 'Mar-Dom 7am–3pm', true, false, 'free', 'Desayunos y tacos desde las 7am'),
  ('Llantero Express', 'Reparación de llantas y servicio rápido', 'Carretera a Matamoros Km 3, Reynosa', array['230501','230502'], 'tire', '🔧', '+52 899 200-7788', '528992007788', 'Lun-Sáb 7am–6pm', true, false, 'free', 'Ponchadura, inflado y balanceo mientras esperas')
on conflict do nothing;
