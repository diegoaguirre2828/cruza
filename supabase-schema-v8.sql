-- Community system: points, badges, upvotes

-- Add points + badge columns to profiles
alter table profiles add column if not exists points integer default 0;
alter table profiles add column if not exists badges text[] default '{}';
alter table profiles add column if not exists display_name varchar;
alter table profiles add column if not exists reports_count integer default 0;

-- Add user_id and wait_minutes to crossing_reports (for Just Crossed submissions)
alter table crossing_reports add column if not exists wait_minutes integer;
alter table crossing_reports add column if not exists user_id_ref uuid references auth.users on delete set null;

-- Report upvotes table (one per user per report)
create table if not exists report_upvotes (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references crossing_reports on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  unique(report_id, user_id)
);

alter table report_upvotes enable row level security;
create policy "Users manage own upvotes"
  on report_upvotes for all using (auth.uid() = user_id);
create policy "Anyone can read upvotes"
  on report_upvotes for select using (true);

-- Update crossing_reports to track user
alter table crossing_reports add column if not exists username varchar;

-- Leaderboard view
create or replace view community_leaderboard as
select
  p.id,
  coalesce(p.display_name, split_part(u.email, '@', 1)) as username,
  p.points,
  p.reports_count,
  p.badges
from profiles p
join auth.users u on u.id = p.id
where p.points > 0
order by p.points desc
limit 50;
