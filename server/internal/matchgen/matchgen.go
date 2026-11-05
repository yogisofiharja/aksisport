// Package matchgen is DP-005's fair match generation on the server: the
// same rules as the app's src/core/sessions/matchGenerator.ts, so the
// server can regenerate a Session's queue on its own when players check
// in or leave (DP-005, 2026-11-05). Pure: no database, no clock.
package matchgen

import (
	"encoding/json"
	"math/rand"
	"sort"
	"time"
)

// Player is someone who may be put in a match: a Session participant. ID
// is the participant row id; exactly one of UserID/GuestName is set.
type Player struct {
	ID        string
	UserID    *string
	GuestName *string
	Label     string
}

// Ref is one player of an existing match.
type Ref struct {
	UserID    *string
	GuestName *string
}

// Match is an existing match: who played it and when it was made.
type Match struct {
	CreatedAt time.Time
	Players   []Ref
}

func (p Player) in(m Match) bool {
	for _, r := range m.Players {
		if p.UserID != nil && r.UserID != nil && *p.UserID == *r.UserID {
			return true
		}
		if p.UserID == nil && p.GuestName != nil && r.GuestName != nil && *p.GuestName == *r.GuestName {
			return true
		}
	}
	return false
}

// Available is eligible minus anyone already in one of busy (live
// matches, or queued ones being kept).
func Available(eligible []Player, busy []Match) []Player {
	out := []Player{}
	for _, p := range eligible {
		taken := false
		for _, m := range busy {
			if p.in(m) {
				taken = true
				break
			}
		}
		if !taken {
			out = append(out, p)
		}
	}
	return out
}

// FairRound makes up to count matches of needed players each from the
// available players: fewest matches played this Session first, then the
// longest wait since their last match, other ties at random. Picks within
// the round count too, so a round bigger than the player pool cycles
// through everyone. history is every match so far (any status); returns
// nil when there aren't enough players for one match.
func FairRound(eligible []Player, busy []Match, history []Match, needed, count int, rng *rand.Rand) [][]Player {
	available := Available(eligible, busy)
	if len(available) < needed || count <= 0 || needed <= 0 {
		return nil
	}
	ordered := append([]Match(nil), history...)
	sort.SliceStable(ordered, func(i, j int) bool { return ordered[i].CreatedAt.Before(ordered[j].CreatedAt) })

	played := map[string]int{}
	last := map[string]int{}
	for _, p := range available {
		last[p.ID] = -1
		for i, m := range ordered {
			if p.in(m) {
				played[p.ID]++
				last[p.ID] = i
			}
		}
	}
	next := len(ordered)

	var round [][]Player
	for i := 0; i < count; i++ {
		order := append([]Player(nil), available...)
		rng.Shuffle(len(order), func(a, b int) { order[a], order[b] = order[b], order[a] })
		sort.SliceStable(order, func(a, b int) bool {
			pa, pb := order[a], order[b]
			if played[pa.ID] != played[pb.ID] {
				return played[pa.ID] < played[pb.ID]
			}
			return last[pa.ID] < last[pb.ID]
		})
		picked := order[:needed]
		round = append(round, append([]Player(nil), picked...))
		for _, p := range picked {
			played[p.ID]++
			last[p.ID] = next
		}
		next++
	}
	return round
}

type configPlayer struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Team string `json:"team"`
}

type config struct {
	Mode                  string          `json:"mode"`
	DeuceMode             string          `json:"deuceMode"`
	Players               []configPlayer  `json:"players"`
	ServiceOrderPlayerIDs []string        `json:"serviceOrderPlayerIds"`
	MatchFormat           json.RawMessage `json:"matchFormat"`
}

// Team is the team of the i-th picked player: the first half A, the rest
// B.
func Team(i, needed int) string {
	if i < needed/2 {
		return "A"
	}
	return "B"
}

// Config is the match's scoring config, the same shape the app builds
// (buildGeneratedMatchPayload): players by participant id, the first
// picked player serving, teams alternating in the service order.
func Config(picked []Player, mode string, singleDeuce bool, matchFormat json.RawMessage) (json.RawMessage, error) {
	needed := len(picked)
	c := config{Mode: mode, DeuceMode: "standard", MatchFormat: matchFormat}
	if singleDeuce {
		c.DeuceMode = "singleDeuceSuddenDeath"
	}
	if len(c.MatchFormat) == 0 {
		c.MatchFormat = json.RawMessage(`{"type":"open"}`)
	}
	var teamA, teamB []string
	for i, p := range picked {
		team := Team(i, needed)
		c.Players = append(c.Players, configPlayer{ID: p.ID, Name: p.Label, Team: team})
		if team == "A" {
			teamA = append(teamA, p.ID)
		} else {
			teamB = append(teamB, p.ID)
		}
	}
	for i := 0; i < len(teamA) || i < len(teamB); i++ {
		if i < len(teamA) {
			c.ServiceOrderPlayerIDs = append(c.ServiceOrderPlayerIDs, teamA[i])
		}
		if i < len(teamB) {
			c.ServiceOrderPlayerIDs = append(c.ServiceOrderPlayerIDs, teamB[i])
		}
	}
	return json.Marshal(c)
}
