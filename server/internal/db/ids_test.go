package db

import "testing"

func TestIsUUID(t *testing.T) {
	for s, want := range map[string]bool{
		"3f2b8c1e-9a4d-4e2f-8b1a-0c9d8e7f6a5b":  true,
		"3F2B8C1E-9A4D-4E2F-8B1A-0C9D8E7F6A5B":  true,
		"":                                      false,
		"not-a-uuid":                            false,
		"3f2b8c1e9a4d4e2f8b1a0c9d8e7f6a5b":      false,
		"3f2b8c1e-9a4d-4e2f-8b1a-0c9d8e7f6a5b'": false,
	} {
		if got := IsUUID(s); got != want {
			t.Errorf("IsUUID(%q) = %v, want %v", s, got, want)
		}
	}
}
