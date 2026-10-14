package httpapi

import (
	"testing"

	"github.com/yogisofiharja/aksi-server/internal/mail"
)

// Route registration panics at startup, not at compile time, when two
// patterns conflict (e.g. a static segment added beside a ":param" one).
// Building the router here turns that into a test failure.
func TestRouterRegistersWithoutConflicts(t *testing.T) {
	router := NewRouter(nil, nil, "*", mail.LogMailer{}, nil)
	if len(router.Routes()) == 0 {
		t.Fatal("expected routes to be registered")
	}
}
