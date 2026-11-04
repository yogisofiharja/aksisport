-- Who can see a Session: anyone signed in ('public', the default) or the
-- Community's members only ('members'). A Recurring Schedule's Template
-- carries it to the Sessions it generates. Existing rows become public.
ALTER TABLE sessions
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'members'));
ALTER TABLE recurring_schedules
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'members'));
