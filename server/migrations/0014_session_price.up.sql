-- Session pricing (Payments, promoted out of Planning): an organizer can
-- optionally set how much a Session costs. Three models:
--   'free'        - no cost (default).
--   'per_person'  - a fixed fee per person (price_per_person, whole IDR).
--   'split_bill'  - a total bill (total_price, whole IDR) divided evenly
--                    among joined participants — the per-person amount is
--                    computed client-side from session.joinedCount, never
--                    stored.
-- IDR has no subunit in practice, so both amounts are plain integers, not
-- a fractional/decimal type. price_per_person/total_price are nullable
-- and only meaningful for their corresponding price_model — validated
-- together server-side (validatePriceModel), not enforced by a CHECK
-- here (same convention as Skill Level's all-or-nothing pair, which also
-- isn't CHECK-enforced at the DB level).
--
-- Also added to recurring_schedules — copied onto every generated Session
-- at creation time, same as every other Template field (Skill Level,
-- Host Playing, etc.).
ALTER TABLE sessions
  ADD COLUMN price_model TEXT NOT NULL DEFAULT 'free' CHECK (price_model IN ('free', 'per_person', 'split_bill')),
  ADD COLUMN price_per_person INTEGER,
  ADD COLUMN total_price INTEGER;

ALTER TABLE recurring_schedules
  ADD COLUMN price_model TEXT NOT NULL DEFAULT 'free' CHECK (price_model IN ('free', 'per_person', 'split_bill')),
  ADD COLUMN price_per_person INTEGER,
  ADD COLUMN total_price INTEGER;
