package account

import (
	"regexp"
	"testing"
)

func TestNormalizeAndValidEmail(t *testing.T) {
	if got := NormalizeEmail("  Yogi@Example.COM "); got != "yogi@example.com" {
		t.Fatalf("normalize: got %q", got)
	}
	valid := []string{"a@b.co", "first.last+tag@sub.example.com"}
	for _, e := range valid {
		if !ValidEmail(e) {
			t.Errorf("expected %q to be valid", e)
		}
	}
	invalid := []string{"", "plain", "a@b", "@b.co", "a@.co ", "a b@c.co", "a@@b.co"}
	for _, e := range invalid {
		if ValidEmail(e) {
			t.Errorf("expected %q to be invalid", e)
		}
	}
}

func TestGenerateCodeShape(t *testing.T) {
	sixDigits := regexp.MustCompile(`^\d{6}$`)
	for i := 0; i < 200; i++ {
		code, err := GenerateCode()
		if err != nil {
			t.Fatal(err)
		}
		if !sixDigits.MatchString(code) {
			t.Fatalf("code %q is not 6 digits", code)
		}
	}
}

func TestHashCodeIsBoundToUserAndPurpose(t *testing.T) {
	base := HashCode("user-1", PurposeVerifyEmail, "123456")
	if base != HashCode("user-1", PurposeVerifyEmail, " 123456 ") {
		t.Error("surrounding whitespace should not change the hash")
	}
	if base == HashCode("user-2", PurposeVerifyEmail, "123456") {
		t.Error("same code for another user must hash differently")
	}
	if base == HashCode("user-1", PurposeResetPassword, "123456") {
		t.Error("same code for another purpose must hash differently")
	}
	if base == HashCode("user-1", PurposeVerifyEmail, "123457") {
		t.Error("different codes must hash differently")
	}
}

func TestDecoyLoginEmailCannotBeARealAccount(t *testing.T) {
	decoy := DecoyLoginEmail("nobody@example.com")
	if decoy != DecoyLoginEmail("nobody@example.com") {
		t.Error("decoy must be stable for the same input")
	}
	if decoy == DecoyLoginEmail("someone@example.com") {
		t.Error("different inputs should get different decoys")
	}
	local := decoy[:len(decoy)-len("@"+SyntheticEmailDomain)]
	if len(local) <= 20 {
		t.Errorf("decoy local part %q could collide with a real username (max 20 chars)", local)
	}
	if got := LoginEmailForUsername("Yogi"); got != "yogi@"+SyntheticEmailDomain {
		t.Errorf("login email: got %q", got)
	}
}
