-- Add last_triggered_at to alert_preferences (prevents spam, 1 alert per hour)
alter table alert_preferences
  add column if not exists last_triggered_at timestamptz;
