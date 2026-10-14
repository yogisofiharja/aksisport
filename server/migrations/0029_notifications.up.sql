-- DP-018 Push Notifications.

-- Keys the server generates for itself and must keep stable across
-- restarts — today only the VAPID key pair that signs Web Push messages
-- (browsers tie a push subscription to the public key it was made with,
-- so a new pair would silently orphan every existing subscription).
CREATE TABLE server_keys (
  name        TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per device (browser or phone app) that may receive pushes for
-- a User. `address` is what a push is sent to: a Web Push endpoint URL, or
-- an Expo push token. A device belongs to whoever registered it last —
-- signing in as someone else on the same browser moves it.
CREATE TABLE push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('web', 'expo')),
  address       TEXT NOT NULL,
  -- Web Push only: the browser's encryption keys for this subscription.
  p256dh        TEXT,
  auth          TEXT,
  -- The app language on that device, so a push arrives in it.
  locale        TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'id')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX push_subscriptions_address_unique ON push_subscriptions (address);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);

-- Every notification, whether or not a push reached a device — this is
-- what the Notifications page lists. The text is not stored: `type` and
-- `params` are rendered in the reader's language when shown. `path` is the
-- app address it opens (the same paths as the web app's URLs).
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  params      JSONB NOT NULL DEFAULT '{}',
  path        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);
CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
