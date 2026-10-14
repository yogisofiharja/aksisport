package db

import "encoding/json"

// matchWon reads a completed match's stored result (sport-defined JSON;
// every sport so far records {"winner": "A"|"B"|null}) for one team.
// nil when the result names no winner (a match ended without one) or
// can't be read.
func matchWon(result []byte, team string) *bool {
	if len(result) == 0 || team == "" {
		return nil
	}
	var parsed struct {
		Winner *string `json:"winner"`
	}
	if err := json.Unmarshal(result, &parsed); err != nil || parsed.Winner == nil || *parsed.Winner == "" {
		return nil
	}
	won := *parsed.Winner == team
	return &won
}
