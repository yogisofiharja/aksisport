package db

import (
	"testing"
	"time"
)

func TestSessionUpdateTouchesTemplate(t *testing.T) {
	str := "x"
	n := 4
	yes := true
	now := time.Now()

	notTemplate := map[string]SessionUpdate{
		"empty":           {},
		"status only":     {Status: &str},
		"reschedule only": {StartsAt: &now, DurationMinutes: &n},
	}
	for name, u := range notTemplate {
		if u.TouchesTemplate() {
			t.Errorf("%s: expected not to count as a Template edit", name)
		}
	}

	template := map[string]SessionUpdate{
		"name":             {Name: &str},
		"location":         {Location: &str},
		"description":      {Description: &str},
		"max participants": {MaxParticipants: &n},
		"match format":     {DefaultMatchFormat: []byte(`{"type":"open"}`)},
		"single deuce":     {DefaultSingleDeuce: &yes},
		"activity type":    {ActivityType: &str},
		"skill min":        {SkillLevelMinID: &str},
		"skill max":        {SkillLevelMaxID: &str},
		"skill enforce":    {SkillLevelEnforcement: &str},
		"host playing":     {HostPlaying: &yes},
		"price model":      {PriceModel: &str},
		"price per person": {PricePerPerson: &n},
		"total price":      {TotalPrice: &n},
		"status + name":    {Status: &str, Name: &str},
	}
	for name, u := range template {
		if !u.TouchesTemplate() {
			t.Errorf("%s: expected to count as a Template edit", name)
		}
	}
}
