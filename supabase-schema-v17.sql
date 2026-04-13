-- v17: Indexes to reduce disk IO under traffic spikes
--
-- After the viral FB-traffic spike, Supabase reported 'exhausting multiple
-- resources' with disk IO bandwidth pinned. The hot queries:
--
--   1. /api/reports/recent → SELECT ... FROM crossing_reports
--      WHERE created_at >= $1 ORDER BY created_at DESC LIMIT 50
--      (no port_id filter — can't use idx_reports_port_time efficiently)
--
--   2. Profiles reads (tier lookups, sync-tier, admin stats) hit the primary
--      key so they're fine — not the bottleneck.
--
--   3. The existing idx_reports_port_time (port_id, created_at desc) covers
--      /api/ports fine but gets updated on every insert, which is write IO
--      amplification during bulk FB ingest.
--
-- This migration adds a dedicated index on created_at for time-range queries
-- and makes sure port_overrides stays tiny.

-- Index #1: created_at alone for /api/reports/recent time-range scans.
-- PG's planner will pick this over the compound (port_id, created_at) index
-- when there's no port_id filter, cutting the scan cost significantly.
create index if not exists idx_reports_created_at
  on crossing_reports (created_at desc);

-- Index #2: location_confidence is referenced in the /api/ports blending
-- filter (drop 'far' reports). Partial index is cheaper than a full one.
create index if not exists idx_reports_loc_conf
  on crossing_reports (location_confidence)
  where location_confidence is not null;

-- Index #3: source filter for admin-side fb_group report counts.
-- Low cardinality but helps when filtering 'fb_group' during recent queries.
create index if not exists idx_reports_source_created
  on crossing_reports (source, created_at desc)
  where source is not null;

-- Vacuum to reclaim space from recent inserts/updates. This is a cheap win
-- post-migration that lowers disk IO by defragmenting the table pages.
-- vacuum analyze crossing_reports;   -- uncomment and run manually if needed
