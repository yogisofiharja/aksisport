package ratelimit

import (
	"testing"
	"time"
)

func newTestLimiter(limit int, per time.Duration) (*Limiter, *time.Time) {
	clock := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)
	l := New(limit, per)
	l.now = func() time.Time { return clock }
	return l, &clock
}

func TestAllowsUpToTheLimitThenRefusesUntilTheWindowEnds(t *testing.T) {
	l, clock := newTestLimiter(3, time.Minute)
	for i := 0; i < 3; i++ {
		if ok, _ := l.Allow("1.2.3.4"); !ok {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}
	*clock = clock.Add(20 * time.Second)
	ok, retry := l.Allow("1.2.3.4")
	if ok {
		t.Fatal("4th request inside the window must be refused")
	}
	if retry != 40*time.Second {
		t.Errorf("retry after: got %v, want 40s", retry)
	}
	*clock = clock.Add(40 * time.Second)
	if ok, _ := l.Allow("1.2.3.4"); !ok {
		t.Fatal("a new window must allow again")
	}
}

func TestKeysAreCountedSeparately(t *testing.T) {
	l, _ := newTestLimiter(1, time.Minute)
	if ok, _ := l.Allow("a"); !ok {
		t.Fatal("first request for a should pass")
	}
	if ok, _ := l.Allow("b"); !ok {
		t.Fatal("b must not be affected by a")
	}
	if ok, _ := l.Allow("a"); ok {
		t.Fatal("second request for a should be refused")
	}
}

func TestFinishedWindowsArePruned(t *testing.T) {
	l, clock := newTestLimiter(5, time.Minute)
	l.Allow("a")
	l.Allow("b")
	*clock = clock.Add(2 * time.Minute)
	l.Allow("c")
	if len(l.windows) != 1 {
		t.Errorf("expected only the live window to remain, got %d", len(l.windows))
	}
}
