package db

import "testing"

func TestJoinGroupNames(t *testing.T) {
	cases := []struct {
		names []string
		total int
		want  string
	}{
		{[]string{"Ana", "Budi"}, 2, "Ana, Budi"},
		{[]string{"Ana", "Budi", "Citra"}, 3, "Ana, Budi, Citra"},
		{[]string{"Ana", "Budi", "Citra"}, 5, "Ana, Budi, Citra +2"},
	}
	for _, c := range cases {
		if got := JoinGroupNames(c.names, c.total); got != c.want {
			t.Errorf("JoinGroupNames(%v, %d) = %q, want %q", c.names, c.total, got, c.want)
		}
	}
}
