package authjwt

import (
	"testing"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

func TestEmailGateBlocks(t *testing.T) {
	email := "a@b.co"
	unconfirmedNew := models.User{EmailRequired: true}
	confirmedNew := models.User{EmailRequired: true, Email: &email}
	older := models.User{EmailRequired: false}

	if !EmailGateBlocks(unconfirmedNew, "/v1/clubs") {
		t.Error("an unconfirmed new account must be blocked from ordinary routes")
	}
	for _, path := range []string{"/v1/me/email", "/v1/me/email/verify"} {
		if EmailGateBlocks(unconfirmedNew, path) {
			t.Errorf("%s must stay open so the email can be confirmed", path)
		}
	}
	if EmailGateBlocks(confirmedNew, "/v1/clubs") {
		t.Error("a confirmed account must not be blocked")
	}
	if EmailGateBlocks(older, "/v1/clubs") {
		t.Error("accounts from before the gate must never be blocked")
	}
}
