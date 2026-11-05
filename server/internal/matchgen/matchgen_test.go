package matchgen

import (
	"encoding/json"
	"math/rand"
	"testing"
	"time"
)

func user(id string) Player { return Player{ID: "p-" + id, UserID: &id, Label: id} }
func ref(id string) Ref     { return Ref{UserID: &id} }

func TestFairRoundPicksFewestPlayedThenLongestWaiting(t *testing.T) {
	a, b, c, d := user("a"), user("b"), user("c"), user("d")
	t0 := time.Now()
	history := []Match{
		{CreatedAt: t0, Players: []Ref{ref("a"), ref("b")}},
		{CreatedAt: t0.Add(time.Minute), Players: []Ref{ref("c"), ref("a")}},
	}
	rng := rand.New(rand.NewSource(1))
	round := FairRound([]Player{a, b, c, d}, nil, history, 2, 1, rng)
	if len(round) != 1 {
		t.Fatalf("got %d matches, want 1", len(round))
	}
	// d never played; b and c played once, b longer ago.
	if round[0][0].ID != d.ID || round[0][1].ID != b.ID {
		t.Errorf("picked %s, %s; want d, b", round[0][0].Label, round[0][1].Label)
	}
}

func TestFairRoundSkipsBusyAndCyclesThroughEveryone(t *testing.T) {
	players := []Player{user("a"), user("b"), user("c"), user("d"), user("e")}
	busy := []Match{{Players: []Ref{ref("e")}}}
	round := FairRound(players, busy, busy, 2, 4, rand.New(rand.NewSource(2)))
	if len(round) != 4 {
		t.Fatalf("got %d matches, want 4", len(round))
	}
	count := map[string]int{}
	for _, m := range round {
		for _, p := range m {
			count[p.Label]++
		}
	}
	if count["e"] != 0 {
		t.Errorf("e is in a live match but was picked")
	}
	for _, id := range []string{"a", "b", "c", "d"} {
		if count[id] != 2 {
			t.Errorf("%s played %d, want 2 (fair cycle)", id, count[id])
		}
	}
	if FairRound(players[:1], nil, nil, 2, 3, rand.New(rand.NewSource(3))) != nil {
		t.Error("one player made a match")
	}
}

func TestConfigShapeMatchesTheApp(t *testing.T) {
	raw, err := Config([]Player{user("a"), user("b"), user("c"), user("d")}, "double", true, nil)
	if err != nil {
		t.Fatal(err)
	}
	var c struct {
		Mode, DeuceMode       string
		Players               []struct{ ID, Name, Team string }
		ServiceOrderPlayerIDs []string `json:"serviceOrderPlayerIds"`
		MatchFormat           map[string]any
	}
	if err := json.Unmarshal(raw, &c); err != nil {
		t.Fatal(err)
	}
	if c.Mode != "double" || c.DeuceMode != "singleDeuceSuddenDeath" || c.MatchFormat["type"] != "open" {
		t.Errorf("config = %s", raw)
	}
	teams := ""
	for _, p := range c.Players {
		teams += p.Team
	}
	if teams != "AABB" {
		t.Errorf("teams = %s, want AABB", teams)
	}
	want := []string{"p-a", "p-c", "p-b", "p-d"}
	for i := range want {
		if c.ServiceOrderPlayerIDs[i] != want[i] {
			t.Fatalf("service order = %v, want %v", c.ServiceOrderPlayerIDs, want)
		}
	}
}
