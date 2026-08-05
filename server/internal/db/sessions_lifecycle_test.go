package db

import (
	"testing"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

func TestResolveLifecycleStatus_PassthroughStatuses(t *testing.T) {
	for _, status := range []string{"draft", "in_progress", "completed", "cancelled"} {
		s := models.Session{Sport: "tennis", Status: status, JoinedCount: 0}
		if got := resolveLifecycleStatus(s); got != status {
			t.Fatalf("status %q: expected passthrough, got %q", status, got)
		}
	}
}

func TestResolveLifecycleStatus_OpenRecruiting(t *testing.T) {
	// Tennis minimum is 2 (singles) — below that, still recruiting.
	s := models.Session{Sport: "tennis", Status: "open", JoinedCount: 1}
	if got := resolveLifecycleStatus(s); got != "recruiting" {
		t.Fatalf("expected recruiting, got %q", got)
	}
}

func TestResolveLifecycleStatus_OpenReady(t *testing.T) {
	s := models.Session{Sport: "tennis", Status: "open", JoinedCount: 2}
	if got := resolveLifecycleStatus(s); got != "ready" {
		t.Fatalf("expected ready, got %q", got)
	}
}

func TestResolveLifecycleStatus_OpenFull(t *testing.T) {
	max := 4
	s := models.Session{Sport: "tennis", Status: "open", JoinedCount: 4, MaxParticipants: &max}
	if got := resolveLifecycleStatus(s); got != "full" {
		t.Fatalf("expected full, got %q", got)
	}
}

func TestResolveLifecycleStatus_OpenReadyNoMaxParticipants(t *testing.T) {
	// No cap set — can never be "full", stays "ready" once past the minimum.
	s := models.Session{Sport: "tennis", Status: "open", JoinedCount: 10, MaxParticipants: nil}
	if got := resolveLifecycleStatus(s); got != "ready" {
		t.Fatalf("expected ready (uncapped), got %q", got)
	}
}
