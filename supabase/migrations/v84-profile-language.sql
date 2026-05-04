-- v84 — add language column to profiles for notification copy.
--
-- 2026-05-03 night: Diego flagged that push notifications send both EN
-- and ES side-by-side ("Bajó la espera · Wait dropped"), violating the
-- "never side-by-side bilingual" rule (feedback memo
-- bilingual_toggle_not_both_on_one_page_20260503). The send-alerts cron
-- needs a per-user language preference to compose single-language
-- notification copy.
--
-- Default 'es' because Cruzar's primary RGV audience is Spanish-first
-- (per CLAUDE.md). A separate /api/profile/language endpoint + client
-- LangContext persistence (TODO) will keep this in sync with the
-- visible toggle on the website.

alter table public.profiles
  add column if not exists language text not null default 'es';

-- Sanity check — only allow 'en' or 'es' to keep cron logic simple.
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_language_check'
  ) then
    alter table public.profiles
      add constraint profiles_language_check
      check (language in ('en', 'es'));
  end if;
end $$;
