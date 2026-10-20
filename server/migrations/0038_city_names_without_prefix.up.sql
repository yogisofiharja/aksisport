-- City names without their administrative prefix: "Jakarta Selatan"
-- instead of "Kota Administrasi Jakarta Selatan", "Bukittinggi" instead of
-- "Kota Bukittinggi", "Badung" instead of "Kabupaten Badung". The prefix
-- makes names long on cards and chips and says nothing people need.
--
-- Longer prefixes are removed first, so "Kota Administrasi" goes before
-- "Kota" and "Kabupaten Administrasi" before "Kabupaten".
--
-- Where a kota and a kabupaten in the same province share a name ("Kota
-- Bandung" and "Kabupaten Bandung", 25 pairs), both keep their prefix:
-- without it the picker would list two identical places.
WITH stripped AS (
  SELECT
    code,
    province_code,
    name,
    CASE
      WHEN name LIKE 'Kota Administrasi %' THEN substr(name, 19)
      WHEN name LIKE 'Kabupaten Administrasi %' THEN substr(name, 24)
      WHEN name LIKE 'Kabupaten %' THEN substr(name, 11)
      WHEN name LIKE 'Kota %' THEN substr(name, 6)
      ELSE name
    END AS short_name
  FROM cities
)
UPDATE cities
SET name = s.short_name
FROM stripped s
WHERE cities.code = s.code
  AND s.short_name <> s.name
  AND NOT EXISTS (
    SELECT 1
    FROM stripped other
    WHERE other.province_code = s.province_code
      AND other.short_name = s.short_name
      AND other.code <> s.code
  );
