package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// cityNameExpr is the display form of the city a row points at —
// "Kota Bandung, Jawa Barat" — for the table (or alias) given, whose
// city_code column it reads. NULL when that row has no city. Used inside
// the shared column lists so every Club and User comes back with its
// city already named.
func cityNameExpr(table string) string {
	return `(SELECT ci.name || ', ' || pr.name FROM cities ci JOIN provinces pr ON pr.code = ci.province_code WHERE ci.code = ` + table + `.city_code)`
}

func ListProvinces(ctx context.Context, pool *pgxpool.Pool) ([]models.Province, error) {
	rows, err := pool.Query(ctx, "SELECT code, name FROM provinces ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.Province{}
	for rows.Next() {
		var p models.Province
		if err := rows.Scan(&p.Code, &p.Name); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

// ListCities returns every city/regency, grouped by province then by
// name with the "Kota"/"Kabupaten" prefix ignored, so "Kota Bandung" sits
// next to "Kabupaten Bandung" rather than after every kabupaten.
func ListCities(ctx context.Context, pool *pgxpool.Pool) ([]models.City, error) {
	rows, err := pool.Query(ctx,
		`SELECT code, province_code, name FROM cities
		 ORDER BY province_code ASC, regexp_replace(name, '^(Kota|Kabupaten)( Administrasi)? ', '') ASC, name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.City{}
	for rows.Next() {
		var c models.City
		if err := rows.Scan(&c.Code, &c.ProvinceCode, &c.Name); err != nil {
			return nil, err
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

func CityExists(ctx context.Context, pool *pgxpool.Pool, code string) (bool, error) {
	var exists bool
	err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM cities WHERE code = $1)", code).Scan(&exists)
	return exists, err
}
