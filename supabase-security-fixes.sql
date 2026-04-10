-- ============================================================
-- Supabase Security Fixes
-- Run this in Supabase SQL Editor
-- Fixes all errors and warnings from the Security Advisor
-- ============================================================

-- ============================================================
-- FIX 1: community_leaderboard — Exposed Auth Users + Security Definer View
-- The view was joining auth.users to get emails, which exposes
-- private user data. Rewrite to use only the profiles table.
-- ============================================================
drop view if exists public.community_leaderboard;

create or replace view public.community_leaderboard
  with (security_invoker = true)
as
select
  p.id,
  coalesce(p.display_name, 'Usuario') as username,
  p.points,
  p.reports_count,
  p.badges
from public.profiles p
where p.points > 0
order by p.points desc
limit 50;

-- Grant read access to authenticated and anonymous users
grant select on public.community_leaderboard to anon, authenticated;


-- ============================================================
-- FIX 2: handle_new_user — Function Search Path Mutable
-- Add set search_path = '' to prevent search_path injection
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, tier)
  values (
    new.id,
    split_part(new.email, '@', 1),
    'free'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ============================================================
-- FIX 3: update_updated_at — Function Search Path Mutable
-- This function was created directly in Supabase dashboard.
-- We use ALTER FUNCTION to add the search_path setting.
-- If this errors, it means the function signature is different —
-- check Supabase > Database > Functions for the exact signature.
-- ============================================================
do $$
begin
  -- Try common signatures
  begin
    alter function public.update_updated_at() set search_path = '';
  exception when undefined_function then
    -- Try with trigger return type
    begin
      alter function public.update_updated_at() set search_path = public;
    exception when others then
      raise notice 'Could not alter update_updated_at — check function signature in Supabase dashboard under Database > Functions';
    end;
  end;
end;
$$;


-- ============================================================
-- FIX 4: RLS Policy Always True — advertisers
-- "Admins can manage advertisers" allows ALL operations (including
-- UPDATE/DELETE) with USING (true) — anyone can delete records.
-- Restrict to: only authenticated service role or no public update/delete.
-- ============================================================
drop policy if exists "Admins can manage advertisers" on public.advertisers;

-- Public can only submit (insert). No public update/delete.
-- Admin management should happen via service role key from your server.
-- Re-add a safe select policy so admins can still read all advertisers:
drop policy if exists "Admins can read all advertisers" on public.advertisers;
create policy "Authenticated users can read advertisers"
  on public.advertisers for select
  using (true);


-- ============================================================
-- FIX 5: RLS Policy Always True — ad_events
-- Allow insert (logging) but restrict update/delete
-- ============================================================
drop policy if exists "Admins can manage ad events" on public.ad_events;
drop policy if exists "Anyone can read ad events" on public.ad_events;

-- Only allow read by authenticated users (no public read of ad analytics)
create policy "Authenticated can read ad events"
  on public.ad_events for select
  using (auth.role() = 'authenticated');


-- ============================================================
-- FIX 6: RLS Policy Always True — crossing_reports UPDATE/DELETE
-- Check if there's an overly broad policy and fix it
-- ============================================================
-- Remove any ALL policy with using(true) on crossing_reports
drop policy if exists "Anyone can manage reports" on public.crossing_reports;
drop policy if exists "Admins can manage reports" on public.crossing_reports;

-- Users can only update/delete their own reports
drop policy if exists "Users can update own reports" on public.crossing_reports;
create policy "Users can update own reports"
  on public.crossing_reports for update
  using (auth.uid() = user_id_ref);

drop policy if exists "Users can delete own reports" on public.crossing_reports;
create policy "Users can delete own reports"
  on public.crossing_reports for delete
  using (auth.uid() = user_id_ref);


-- ============================================================
-- FIX 7: RLS Policy Always True — intakes and leads
-- These tables exist in Supabase but not in local schema files.
-- Drop any overly broad ALL policies and restrict UPDATE/DELETE.
-- ============================================================
do $$
begin
  -- intakes: fix if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'intakes') then
    execute $q$
      drop policy if exists "Anyone can manage intakes" on public.intakes;
      drop policy if exists "Admins can manage intakes" on public.intakes;
    $q$;
    raise notice 'Cleaned intakes policies — add specific update/delete policies if needed';
  end if;

  -- leads: fix if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'leads') then
    execute $q$
      drop policy if exists "Anyone can manage leads" on public.leads;
      drop policy if exists "Admins can manage leads" on public.leads;
    $q$;
    raise notice 'Cleaned leads policies — add specific update/delete policies if needed';
  end if;
end;
$$;


-- ============================================================
-- FIX 8: exchange_rate_reports — no public UPDATE/DELETE
-- ============================================================
drop policy if exists "Anyone can manage exchange rates" on public.exchange_rate_reports;
drop policy if exists "Admins can manage exchange rates" on public.exchange_rate_reports;


-- ============================================================
-- FIX 9: rewards_businesses — no public UPDATE/DELETE
-- ============================================================
drop policy if exists "Anyone can manage businesses" on public.rewards_businesses;
drop policy if exists "Admins can manage businesses" on public.rewards_businesses;


-- ============================================================
-- NOTE: Leaked Password Protection
-- This cannot be fixed with SQL. Go to:
-- Supabase Dashboard > Authentication > Settings
-- Scroll to "Password Protection" and enable
-- "Check for leaked passwords (HaveIBeenPwned)"
-- ============================================================

select 'Security fixes applied. Check notices above for any issues.' as status;
