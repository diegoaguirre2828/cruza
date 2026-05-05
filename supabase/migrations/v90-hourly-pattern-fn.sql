-- Aggregates all wait_time_readings for a port into hourly DOW buckets.
-- Returns 168 rows max (24h × 7 DOW) instead of pulling raw rows to JS.
CREATE OR REPLACE FUNCTION get_port_hourly_pattern(p_port_id text)
RETURNS TABLE (
  hour_of_day   int,
  day_of_week   int,
  avg_wait      int,
  samples       bigint,
  oldest_at     timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    hour_of_day::int,
    day_of_week::int,
    ROUND(AVG(vehicle_wait))::int  AS avg_wait,
    COUNT(*)                        AS samples,
    MIN(recorded_at)                AS oldest_at
  FROM wait_time_readings
  WHERE port_id     = p_port_id
    AND vehicle_wait IS NOT NULL
  GROUP BY hour_of_day, day_of_week;
$$;

-- Allow anon + authenticated to call it (same access as the table read)
GRANT EXECUTE ON FUNCTION get_port_hourly_pattern(text) TO anon, authenticated;
