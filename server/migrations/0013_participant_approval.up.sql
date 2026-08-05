-- DP-002: Join requires organizer approval, and an approved slot must be
-- claimed with payment, no exception. Adds two new states before
-- 'registered':
--
--   requested --organizer approves--> waitlist --organizer confirms
--     payment--> registered --self check-in (within the Check-In
--     Window)--> checked_in --checked_out
--
-- 'requested' is written by the self-service "join" action
-- (RegisterParticipant, POST /v1/sessions/:id/register). 'waitlist' means
-- approved but not yet paid — the member must pay (currently a manual,
-- outside-the-app payment the organizer confirms; no payment gateway
-- integration exists) to claim the slot. 'registered' now means "paid and
-- confirmed," not merely "asked to join." Organizer-initiated actions
-- (Host Playing auto-check-in, "check in a member," AddGuestParticipant)
-- are unchanged and continue to upsert straight to 'checked_in',
-- bypassing request/approval/payment entirely — they're already an
-- organizer decision.
ALTER TABLE session_participants DROP CONSTRAINT session_participants_status_check;
ALTER TABLE session_participants ADD CONSTRAINT session_participants_status_check
  CHECK (status IN ('requested', 'waitlist', 'registered', 'checked_in', 'checked_out', 'cancelled', 'no_show'));
