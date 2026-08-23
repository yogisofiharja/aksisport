-- Milestone 5 (Session Finance) — a Club can list more than one bank
-- account (e.g. a BCA and a Mandiri account), set by the owner, shown on
-- every priced Session's Payment tab so members know where to send
-- money. Plain display fields, no payment processor integration.
CREATE TABLE club_bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  bank_name       TEXT NOT NULL,
  account_number  TEXT NOT NULL,
  account_name    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX club_bank_accounts_club_id_idx ON club_bank_accounts(club_id);
