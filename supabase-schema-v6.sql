-- Fix: ensure new users always get tier = 'free' on signup
-- Also ensures profiles.tier column exists with correct default

alter table profiles add column if not exists tier varchar default 'free';

-- Update any profiles missing a tier value
update profiles set tier = 'free' where tier is null;

-- Fix the signup trigger to explicitly set tier = 'free'
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, tier)
  values (new.id, new.email, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
