-- DP-017: the town a User is in — free text, set by the User, used only
-- to list Communities whose location matches it in Explore. Private to
-- the User, like email.
ALTER TABLE users
  ADD COLUMN town TEXT;
