-- Performance indexes for high-frequency query paths
-- crossing_reports: first-report-of-day check by port + time
CREATE INDEX IF NOT EXISTS idx_crossing_reports_port_created
  ON crossing_reports (port_id, created_at DESC);

-- alert_preferences: active-alert scan in send-alerts cron (OR query on active + triggered + snoozed)
CREATE INDEX IF NOT EXISTS idx_alert_preferences_active_triggered
  ON alert_preferences (active, last_triggered_at DESC NULLS FIRST, snoozed_until DESC NULLS FIRST);

-- app_events: 5-min active-user window + 24h SMS cap check
CREATE INDEX IF NOT EXISTS idx_app_events_created_user
  ON app_events (created_at DESC, user_id)
  WHERE user_id IS NOT NULL;

-- exchange_rate_reports: 6-hour community rate window
CREATE INDEX IF NOT EXISTS idx_exchange_rate_reports_reported_at
  ON exchange_rate_reports (reported_at DESC);
