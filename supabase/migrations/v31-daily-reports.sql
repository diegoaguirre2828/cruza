-- Daily border report cache table for SEO landing pages at /data/[date].
-- The cron at /api/cron/daily-report computes aggregate stats from
-- wait_time_readings and stores the result here as JSONB so the SEO
-- page can serve it without re-scanning thousands of rows on every hit.
-- If the row doesn't exist, the page falls back to computing on the fly.

CREATE TABLE IF NOT EXISTS daily_reports (
  report_date DATE PRIMARY KEY,
  report_data JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public read so the anon key can fetch for the SSR page.
-- Only the service role (cron) can write.
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read daily_reports"
  ON daily_reports FOR SELECT
  USING (true);

CREATE POLICY "Service role write daily_reports"
  ON daily_reports FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index on report_date is implicit (primary key), no extra index needed.
