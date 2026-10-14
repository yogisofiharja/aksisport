-- DP-018 step 2: per-kind push switches, and the 2-hour Session reminder.

-- Only kinds a person turned off are stored; everything else is on.
CREATE TABLE notification_settings (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('community_requests', 'session_requests', 'payments', 'session_reminders')),
  enabled  BOOLEAN NOT NULL,
  PRIMARY KEY (user_id, category)
);

-- Set once the reminder has gone out, so it is sent once per Session.
ALTER TABLE sessions ADD COLUMN reminder_sent_at TIMESTAMPTZ;
