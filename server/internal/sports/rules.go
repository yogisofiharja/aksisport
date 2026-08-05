// Package sports mirrors src/sports/ on the client — DP-ARCH-002's Sport
// Module, the owner of sport-specific rules. Deliberately minimal: only
// what DP-001's Session Lifecycle derivation needs (Session asking the
// Sport Module for its minimum-participants rule is a dependency, not an
// ownership transfer). A small Tennis-only mirror for now, per DP-ARCH-004
// pragmatic architecture — evolve into a real backend registry
// (mirroring src/sports/registry.ts) once a second sport needs its own
// rules exposed the same way.
package sports

// MinParticipantsToStart mirrors src/sports/tennis/rules.ts's
// minParticipants('single') — DP-001's Session-level "Ready" threshold
// uses the sport's smallest match mode's minimum ("enough people to
// start playing something"), not the minimum for every possible match
// type. Same documented assumption as the client-side version this
// replaces.
func MinParticipantsToStart(sport string) int {
	if sport == "tennis" {
		return 2
	}
	return 1
}
