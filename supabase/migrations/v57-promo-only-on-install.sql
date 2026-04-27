-- v57: stop auto-granting first-1000 lifetime promo on bare signup.
--
-- Background: v51 (2026-04-25) put the promo grant inside handle_new_user
-- so every signup got lifetime Pro. Result by 2026-04-26: 267 users / 267
-- promos out, 0 paid Pro conversions, ~80% Web (uninstalled). Diego's call:
-- "seems like we are just giving pro away, i think it should just be for
-- users who sign up and get the pwa." Move the grant from signup to actual
-- PWA install verification (handled in /api/user/claim-pwa-pro after the
-- existing 24h anti-spam gate).
--
-- Existing 267 grants are GRANDFATHERED — this migration does not revoke
-- anyone. The change applies only to new signups going forward.
--
-- Idempotent. The trigger function is replaced; the row data is untouched.

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

  -- Promo grant moved to /api/user/claim-pwa-pro post-install-verify.
  -- See v51 for the prior logic.
  return new;
end;
$$;

do $$
declare
  total_now int;
begin
  select count(*) into total_now from public.profiles where promo_first_1000_until is not null;
  raise notice 'v57 applied — signup trigger no longer auto-grants the first-1000 promo. % existing grants preserved.', total_now;
end;
$$;
