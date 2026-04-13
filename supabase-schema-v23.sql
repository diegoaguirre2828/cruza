-- v23: urgent push fan-out tracking
alter table alert_preferences
  add column if not exists last_urgent_at timestamptz;

create index if not exists idx_alert_preferences_port_active
  on alert_preferences (port_id, active)
  where active = true;
