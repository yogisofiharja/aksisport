-- DP-029 Attendance. A confirmed player who leaves within 3 hours of the
-- start (or after it) is a late cancellation; whether a leave was late is
-- decided when it happens, since the status it left from isn't kept.
-- An organizer may correct attended/no-show for 7 days after a Session
-- ends; the correction is recorded.
ALTER TABLE session_participants
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN late_cancel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN attendance_corrected_at TIMESTAMPTZ,
  ADD COLUMN attendance_corrected_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS session_participants_user_idx ON session_participants (user_id);
