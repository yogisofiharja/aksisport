package db

import "testing"

func TestMatchWon(t *testing.T) {
	cases := []struct {
		result string
		team   string
		want   *bool
	}{
		{`{"winner":"A","sets":{"A":2,"B":1}}`, "A", ptr(true)},
		{`{"winner":"A"}`, "B", ptr(false)},
		{`{"winner":null}`, "A", nil},
		{`{}`, "A", nil},
		{`not json`, "A", nil},
		{``, "A", nil},
		{`{"winner":"B"}`, "", nil},
	}
	for _, c := range cases {
		got := matchWon([]byte(c.result), c.team)
		if (got == nil) != (c.want == nil) || (got != nil && *got != *c.want) {
			t.Errorf("matchWon(%q, %q) = %v, want %v", c.result, c.team, deref(got), deref(c.want))
		}
	}
}

func ptr(b bool) *bool { return &b }

func deref(b *bool) any {
	if b == nil {
		return nil
	}
	return *b
}
