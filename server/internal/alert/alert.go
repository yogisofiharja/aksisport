// Package alert tells the operator about server errors as they happen —
// a 500, a panic, a background job that failed. Every error is still
// logged; a Reporter only adds a push to a channel someone watches
// (Telegram today).
//
// The package keeps one process-wide reporter, like the log package
// keeps one logger: errors surface deep inside handlers and background
// jobs, and threading a reporter through each of them would add a
// parameter everywhere for something that is off in development anyway.
// Until SetReporter is called, Errorf only logs.
package alert

import (
	"fmt"
	"log"
	"sync"
)

// Reporter sends one alert. key groups repeats of the same error so a
// reporter can collapse them; text is the message, already formatted.
// Report must not block the caller.
type Reporter interface {
	Report(key, text string)
}

var (
	mu       sync.RWMutex
	reporter Reporter
)

// SetReporter installs the process-wide reporter; nil turns alerts off.
func SetReporter(r Reporter) {
	mu.Lock()
	reporter = r
	mu.Unlock()
}

// Report hands one alert to the reporter, if there is one. It does not
// log — callers that have already logged use this.
func Report(key, text string) {
	mu.RLock()
	r := reporter
	mu.RUnlock()
	if r != nil {
		r.Report(key, text)
	}
}

// Errorf logs the error like log.Printf and also alerts about it.
// Repeats are grouped by the format string, so the same failure with a
// different ID counts as one recurring error rather than a flood.
func Errorf(format string, args ...any) {
	text := fmt.Sprintf(format, args...)
	log.Print(text)
	Report(format, text)
}
