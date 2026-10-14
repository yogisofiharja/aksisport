package models

// Province and City are reference data (DP-017): Indonesia's provinces
// and their cities/regencies, seeded by migration 0027. "City" means a
// kota or a kabupaten — Name says which ("Kota Bandung", "Kabupaten
// Bandung"). Codes are the official region codes.
type Province struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type City struct {
	Code         string `json:"code"`
	ProvinceCode string `json:"provinceCode"`
	Name         string `json:"name"`
}
