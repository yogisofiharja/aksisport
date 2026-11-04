package models

// Venue (DP-031) is Aksi's own record of where Sessions are played.
type Venue struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	PlaceID *string `json:"placeId,omitempty"`
	// Sessions played there, for ranking suggestions.
	Uses int `json:"uses"`
}
