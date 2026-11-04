package db

import (
	"context"
	"testing"
	"time"
)

func TestAttendance(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	host := testUser(t, pool, "host")
	came := testUser(t, pool, "came")
	absent := testUser(t, pool, "absent")
	late := testUser(t, pool, "late")
	early := testUser(t, pool, "early")
	asked := testUser(t, pool, "asked")

	sid := endTestSession(t, pool, host)
	start := time.Now().Add(-2 * time.Hour)
	if _, err := pool.Exec(ctx, "UPDATE sessions SET starts_at = $2, duration_minutes = 60 WHERE id = $1", sid, start); err != nil {
		t.Fatal(err)
	}
	for _, u := range []string{came, absent, late, early} {
		if _, err := AddRegisteredParticipant(ctx, pool, sid, u); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := RegisterParticipant(ctx, pool, sid, asked); err != nil {
		t.Fatal(err)
	}
	if _, err := SelfCheckIn(ctx, pool, sid, came); err != nil {
		t.Fatal(err)
	}
	// Leaving now is after the start: late. Leaving 5 hours before: not.
	if _, err := CancelParticipant(ctx, pool, sid, late); err != nil {
		t.Fatal(err)
	}
	if p, _ := getParticipantByUser(ctx, pool, sid, late); !p.LateCancel {
		t.Fatal("leaving after the start should be late")
	}
	if _, err := pool.Exec(ctx, "UPDATE sessions SET starts_at = now() + interval '5 hours' WHERE id = $1", sid); err != nil {
		t.Fatal(err)
	}
	if p, err := CancelParticipant(ctx, pool, sid, early); err != nil || p.LateCancel {
		t.Fatalf("leaving 5 hours ahead: late=%v err=%v", p.LateCancel, err)
	}
	if _, err := pool.Exec(ctx, "UPDATE sessions SET starts_at = $2 WHERE id = $1", sid, start); err != nil {
		t.Fatal(err)
	}
	// A request that is withdrawn is never late.
	if p, _ := CancelParticipant(ctx, pool, sid, asked); p.LateCancel {
		t.Fatal("withdrawing a request counted as late")
	}

	// Nothing counts before the Session is completed.
	a, err := GetAttendance(ctx, pool, absent, "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if a.All.NoShows != 0 || len(a.Sessions) != 0 {
		t.Fatalf("in progress counted: %+v", a)
	}
	if err := SetSessionStatus(ctx, pool, sid, "completed"); err != nil {
		t.Fatal(err)
	}

	want := map[string][3]int{came: {1, 0, 0}, absent: {0, 1, 0}, late: {0, 0, 1}, early: {0, 0, 0}, asked: {0, 0, 0}}
	for u, w := range want {
		a, err := GetAttendance(ctx, pool, u, "", 10)
		if err != nil {
			t.Fatal(err)
		}
		got := [3]int{a.All.Attended, a.All.NoShows, a.All.LateCancels}
		if got != w {
			t.Errorf("user %s: got %v, want %v", u[:8], got, w)
		}
	}

	// Organizer's view of this Community.
	var clubID string
	_ = pool.QueryRow(ctx, "SELECT club_id FROM sessions WHERE id = $1", sid).Scan(&clubID)
	a, _ = GetAttendance(ctx, pool, absent, clubID, 10)
	if a.Here.NoShows != 1 || len(a.Sessions) != 1 || a.Sessions[0].Outcome != "no_show" {
		t.Fatalf("club view %+v", a)
	}
	if ok, _ := CanSeeAttendance(ctx, pool, clubID, absent); !ok {
		t.Fatal("a participant should be visible to the club's organizers")
	}
	stranger := testUser(t, pool, "stranger")
	if ok, _ := CanSeeAttendance(ctx, pool, clubID, stranger); ok {
		t.Fatal("a stranger should not be visible")
	}

	// Correction: the absent player actually came.
	absentRow, _ := getParticipantByUser(ctx, pool, sid, absent)
	fixed, err := CorrectAttendance(ctx, pool, sid, absentRow.ID, true, host)
	if err != nil {
		t.Fatal(err)
	}
	if fixed.Status != "checked_in" || !fixed.AttendanceCorrected {
		t.Fatalf("after correction %+v", fixed)
	}
	a, _ = GetAttendance(ctx, pool, absent, "", 10)
	if a.All.Attended != 1 || a.All.NoShows != 0 || !a.Sessions[0].Corrected {
		t.Fatalf("after correction %+v", a)
	}
	// And back.
	if _, err := CorrectAttendance(ctx, pool, sid, absentRow.ID, false, host); err != nil {
		t.Fatal(err)
	}
	// A late cancellation can't be corrected.
	lateRow, _ := getParticipantByUser(ctx, pool, sid, late)
	if _, err := CorrectAttendance(ctx, pool, sid, lateRow.ID, true, host); err != ErrConflict {
		t.Fatalf("correcting a late cancel: %v", err)
	}
	// Past the 7 days, nothing can be corrected.
	if _, err := pool.Exec(ctx, "UPDATE sessions SET starts_at = now() - interval '9 days' WHERE id = $1", sid); err != nil {
		t.Fatal(err)
	}
	if _, err := CorrectAttendance(ctx, pool, sid, absentRow.ID, true, host); err != ErrConflict {
		t.Fatalf("correcting after 7 days: %v", err)
	}
}
