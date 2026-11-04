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

func TestClubNameUpdate(t *testing.T) {
	if got, ok := clubNameUpdate(nil); !ok || got != nil {
		t.Errorf("nil name: got %v, %v", got, ok)
	}
	name := "  Sunday Smash  "
	if got, ok := clubNameUpdate(&name); !ok || *got != "Sunday Smash" {
		t.Errorf("trimmed name: got %v, %v", got, ok)
	}
	blank := "   "
	if _, ok := clubNameUpdate(&blank); ok {
		t.Error("a blank name should be refused")
	}
}
