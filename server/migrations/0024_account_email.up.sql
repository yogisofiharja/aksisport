-- DP-015 Account Email & Password Recovery.
--
-- users.email now means "confirmed email" — it is only ever written by a
-- successful code verification. An address still awaiting its code lives
-- in pending_email, so changing email never drops the confirmed one (and
-- with it, password recovery) before the new one is proven. Anything
-- already in users.email was typed in unverified through PATCH /me, so it
-- moves to pending_email.
--
-- email_required marks accounts created under DP-015, which must confirm
-- an email before using the app. Accounts that predate it stay false and
-- are only reminded.
ALTER TABLE users
  ADD COLUMN pending_email TEXT,
  ADD COLUMN email_required BOOLEAN NOT NULL DEFAULT false;

UPDATE users SET pending_email = email, email = NULL WHERE email IS NOT NULL;

CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE email IS NOT NULL;

-- One row per code sent. Only the newest unconsumed, unexpired row for a
-- (user, purpose) is ever accepted; the code itself is stored hashed.
CREATE TABLE email_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose      TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  email        TEXT NOT NULL,
  code_hash    TEXT NOT NULL,
  attempts     INT NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_codes_user_purpose_idx ON email_codes (user_id, purpose, created_at DESC);
