-- v18: Share tracking counters
--
-- Reframe the existing points system as neutral "trackers" — report count
-- and share count — so the UI stops feeling gamey while still building
-- the data pipeline for a future redemption system tied to business offers.
--
-- The existing points column on profiles stays in place as internal state
-- (we'll flip it back on when businesses are ready to redeem), but the UI
-- will display report_count and share_count instead.

alter table profiles
  add column if not exists share_count integer default 0;

-- Backfill any null values
update profiles set share_count = 0 where share_count is null;
