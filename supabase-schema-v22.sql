-- v22: Outbound click tracking
--
-- Tracks every time a user taps a business contact (phone, WhatsApp,
-- website, address, social) or a partner outbound link. This data is
-- critical for proving value to businesses when Diego starts monetizing
-- the Negocios directory ('we sent your listing 47 calls this month').

create table if not exists business_clicks (
  id uuid default gen_random_uuid() primary key,
  business_id uuid references rewards_businesses on delete cascade,
  user_id uuid references auth.users on delete set null,
  click_type varchar not null,  -- 'phone' | 'whatsapp' | 'website' | 'address' | 'instagram' | 'facebook'
  port_id varchar,               -- which port the user was looking at, if any
  referrer varchar,              -- 'negocios_list' | 'port_detail' | 'search' | etc.
  ip_hash varchar,               -- optional anonymized IP for abuse detection
  created_at timestamptz default now()
);
create index if not exists idx_business_clicks_biz_time
  on business_clicks (business_id, created_at desc);
create index if not exists idx_business_clicks_type_time
  on business_clicks (click_type, created_at desc);

-- Partner/external link clicks that aren't tied to a business listing
-- (SENTRI signup, insurance partner, services page CTAs, etc.)
create table if not exists link_clicks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  url text not null,
  context varchar,               -- 'services_insurance' | 'sentri' | 'banner_X' | etc.
  port_id varchar,
  created_at timestamptz default now()
);
create index if not exists idx_link_clicks_context_time
  on link_clicks (context, created_at desc);

alter table business_clicks enable row level security;
alter table link_clicks enable row level security;
-- Service role (our API) handles all writes and reads — no direct client access.
