package httpapi

import "testing"

func TestValidClubVisibility(t *testing.T) {
	for _, v := range []string{"public", "private"} {
		if !validClubVisibility(v) {
			t.Errorf("%q should be valid", v)
		}
	}
	for _, v := range []string{"", "Public", "hidden"} {
		if validClubVisibility(v) {
			t.Errorf("%q should be invalid", v)
		}
	}
}
