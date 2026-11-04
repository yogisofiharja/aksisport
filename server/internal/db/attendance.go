package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-029 Attendance.
const (
	// LateCancelWindow: leaving a confirmed spot this close to the start,
	// or after it, is a late cancellation.
	LateCancelWindow = 3 * time.Hour
	// AttendanceCorrectionWindow: how long after a Session ends its
	// organizers may correct attended / no-show.
	AttendanceCorrectionWindow = 7 * 24 * time.Hour
)

// attendanceOutcome turns a participant row of a completed Session into
// attended / no_show / late_cancel, or NULL for rows that don't count
// (requests, waitlist, early leaves). Only completed Sessions count.
const attendanceOutcome = `CASE
	WHEN sp.status IN ('checked_in', 'checked_out') THEN 'attended'
	WHEN sp.status IN ('registered', 'no_show') THEN 'no_show'
	WHEN sp.status = 'cancelled' AND sp.late_cancel THEN 'late_cancel'
END`

// GetAttendance returns userID's counts across every Community and, with
// clubID set, the counts and Sessions of that Community alone; with
// clubID empty, Sessions from every Community. Newest first, at most
// limit Sessions.
func GetAttendance(ctx context.Context, pool *pgxpool.Pool, userID, clubID string, limit int) (models.Attendance, error) {
	var a models.Attendance
	err := pool.QueryRow(ctx, `
		SELECT
			count(*) FILTER (WHERE outcome = 'attended'),
			count(*) FILTER (WHERE outcome = 'no_show'),
			count(*) FILTER (WHERE outcome = 'late_cancel'),
			count(*) FILTER (WHERE outcome = 'attended' AND club_id::text = $2),
			count(*) FILTER (WHERE outcome = 'no_show' AND club_id::text = $2),
			count(*) FILTER (WHERE outcome = 'late_cancel' AND club_id::text = $2)
		FROM (
			SELECT `+attendanceOutcome+` AS outcome, s.club_id
			FROM session_participants sp
			JOIN sessions s ON s.id = sp.session_id AND s.status = 'completed'
			WHERE sp.user_id = $1
		) t`, userID, clubID,
	).Scan(&a.All.Attended, &a.All.NoShows, &a.All.LateCancels,
		&a.Here.Attended, &a.Here.NoShows, &a.Here.LateCancels)
	if err != nil {
		return a, err
	}
	if clubID == "" {
		a.Here = models.AttendanceCounts{}
	}

	rows, err := pool.Query(ctx, `
		SELECT s.id, s.name, s.starts_at, c.id, c.name, `+attendanceOutcome+`,
			sp.attendance_corrected_at IS NOT NULL
		FROM session_participants sp
		JOIN sessions s ON s.id = sp.session_id AND s.status = 'completed'
		JOIN clubs c ON c.id = s.club_id
		WHERE sp.user_id = $1 AND ($2 = '' OR s.club_id::text = $2)
			AND `+attendanceOutcome+` IS NOT NULL
		ORDER BY s.starts_at DESC
		LIMIT $3`, userID, clubID, limit)
	if err != nil {
		return a, err
	}
	a.Sessions, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (models.AttendanceEntry, error) {
		var e models.AttendanceEntry
		err := row.Scan(&e.SessionID, &e.SessionName, &e.StartsAt, &e.ClubID, &e.ClubName, &e.Outcome, &e.Corrected)
		return e, err
	})
	if a.Sessions == nil {
		a.Sessions = []models.AttendanceEntry{}
	}
	return a, err
}

// CanSeeAttendance: an organizer of clubID may see the attendance of
// someone connected to that Community: a member, someone with a join
// request, or a participant in one of its Sessions (which covers
// Session-only visitors, DP-028).
func CanSeeAttendance(ctx context.Context, pool *pgxpool.Pool, clubID, targetUserID string) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM club_members WHERE club_id = $1 AND user_id = $2)
			OR EXISTS (SELECT 1 FROM club_join_requests WHERE club_id = $1 AND user_id = $2)
			OR EXISTS (SELECT 1 FROM session_participants sp JOIN sessions s ON s.id = sp.session_id
				WHERE s.club_id = $1 AND sp.user_id = $2)`,
		clubID, targetUserID,
	).Scan(&ok)
	return ok, err
}

// CorrectAttendance marks a participant of a completed Session attended
// or a no-show, within AttendanceCorrectionWindow of its end. Only an
// attended or no-show row can be switched; anything else (a request, a
// late cancellation) is ErrConflict, as is a Session that isn't completed
// or whose window has closed. ErrNotFound if there is no such row.
func CorrectAttendance(ctx context.Context, pool *pgxpool.Pool, sessionID, participantID string, attended bool, byUserID string) (models.SessionParticipant, error) {
	from, to := "'registered', 'no_show'", "'checked_in'"
	if !attended {
		from, to = "'checked_in', 'checked_out'", "'no_show'"
	}
	tag, err := pool.Exec(ctx, `
		UPDATE session_participants sp SET status = `+to+`,
			checked_in_at = CASE WHEN `+to+` = 'checked_in' THEN COALESCE(sp.checked_in_at, s.starts_at) ELSE sp.checked_in_at END,
			attendance_corrected_at = now(), attendance_corrected_by = $3
		FROM sessions s
		WHERE s.id = sp.session_id AND sp.session_id = $1 AND sp.id::text = $2
			AND s.status = 'completed'
			AND now() < COALESCE(s.starts_at + make_interval(mins => COALESCE(s.duration_minutes, 0)), s.updated_at) + make_interval(secs => $4)
			AND sp.status IN (`+from+`)`,
		sessionID, participantID, byUserID, AttendanceCorrectionWindow.Seconds())
	if err != nil {
		return models.SessionParticipant{}, err
	}
	if tag.RowsAffected() == 0 {
		if _, gerr := getParticipantByID(ctx, pool, sessionID, participantID); gerr != nil {
			return models.SessionParticipant{}, gerr
		}
		return models.SessionParticipant{}, ErrConflict
	}
	return getParticipantByID(ctx, pool, sessionID, participantID)
}
