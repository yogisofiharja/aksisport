-- DP-017: a User can keep several towns (where they live, their hometown,
-- …) and has exactly one *active* town at a time — users.city_code. The
-- active town is always one of these rows; switching town is choosing a
-- different one, not retyping it.
CREATE TABLE user_cities (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city_code   TEXT NOT NULL REFERENCES cities(code),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, city_code)
);

-- Whoever already picked a town keeps it, as their first saved town.
INSERT INTO user_cities (user_id, city_code)
SELECT id, city_code FROM users WHERE city_code IS NOT NULL;
