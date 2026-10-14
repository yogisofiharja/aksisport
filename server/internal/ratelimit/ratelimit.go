// Package ratelimit caps how often one caller (in practice, one client IP)
// may hit an endpoint: at most Limit requests per Window, counted in
// fixed windows. It guards the routes anyone can call without signing in
// (login lookup, password reset, username check) against guessing and
// enumeration.
//
// State is in memory, so limits are per server process — right for this
// deployment (one API process per environment); several processes behind
// a load balancer would each count separately.
package ratelimit

import (
	"sync"
	"time"
)

type window struct {
	start time.Time
	count int
}

type Limiter struct {
	limit  int
	window time.Duration
	now    func() time.Time

	mu        sync.Mutex
	windows   map[string]*window
	lastPrune time.Time
}

func New(limit int, per time.Duration) *Limiter {
	return &Limiter{limit: limit, window: per, now: time.Now, windows: map[string]*window{}}
}

// Allow records one request for key. When the key is over its limit it
// returns false and how long until its window resets.
func (l *Limiter) Allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	l.pruneLocked(now)

	w, ok := l.windows[key]
	if !ok || now.Sub(w.start) >= l.window {
		l.windows[key] = &window{start: now, count: 1}
		return true, 0
	}
	if w.count >= l.limit {
		return false, w.start.Add(l.window).Sub(now)
	}
	w.count++
	return true, 0
}

// pruneLocked drops finished windows, at most once per window length, so
// memory tracks recent callers rather than every caller ever seen.
func (l *Limiter) pruneLocked(now time.Time) {
	if now.Sub(l.lastPrune) < l.window {
		return
	}
	for key, w := range l.windows {
		if now.Sub(w.start) >= l.window {
			delete(l.windows, key)
		}
	}
	l.lastPrune = now
}
