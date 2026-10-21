package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const playerHistoryLimit = 50

// GetPlayerSportActivity assembles a player's history in one sport across
// every Community (DP-019): summary counts over all time, and the most
// recent Sessions and completed matches. A match counts as won when the
// sport's stored result names the player's team as winner, lost when it
// names the other team; a draw (no winner) is neither. Only completed
// matches count — never Unfinished or Not played ones.
func GetPlayerSportActivity(ctx context.Context, pool *pgxpool.Pool, userID, sport string) (models.PlayerSportActivity, error) {
	a := models.PlayerSportActivity{Sport: sport, Sessions: []models.PlayerSessionHistory{}, Matches: []models.PlayerMatchHistory{}}

	if err := pool.QueryRow(ctx,
		`SELECT
			(SELECT count(*) FROM session_participants sp JOIN sessions s ON s.id = sp.session_id
			 WHERE sp.user_id = $1 AND s.sport = $2 AND sp.status IN ('checked_in', 'checked_out')),
			(SELECT count(*) FROM session_participants sp JOIN sessions s ON s.id = sp.session_id
			 WHERE sp.user_id = $1 AND s.sport = $2 AND sp.status = 'no_show'),
			(SELECT count(*) FROM activity_participants ap JOIN activities ac ON ac.id = ap.activity_id
			 WHERE ap.user_id = $1 AND ac.sport = $2 AND ac.status = 'completed'),
			(SELECT count(*) FROM activity_participants ap JOIN activities ac ON ac.id = ap.activity_id
			 WHERE ap.user_id = $1 AND ac.sport = $2 AND ac.status = 'completed' AND ac.result->>'winner' = ap.team),
			(SELECT count(*) FROM activity_participants ap JOIN activities ac ON ac.id = ap.activity_id
			 WHERE ap.user_id = $1 AND ac.sport = $2 AND ac.status = 'completed'
			   AND coalesce(ac.result->>'winner', '') <> '' AND ac.result->>'winner' <> ap.team)`,
		userID, sport,
	).Scan(&a.Summary.SessionsAttended, &a.Summary.NoShows, &a.Summary.MatchesPlayed, &a.Summary.Wins, &a.Summary.Losses); err != nil {
		return a, err
	}

	rows, err := pool.Query(ctx,
		`SELECT s.id, s.name, c.name, s.starts_at, CASE WHEN sp.status = 'no_show' THEN 'no_show' ELSE 'attended' END
		 FROM session_participants sp
		 JOIN sessions s ON s.id = sp.session_id
		 JOIN clubs c ON c.id = s.club_id
		 WHERE sp.user_id = $1 AND s.sport = $2 AND sp.status IN ('checked_in', 'checked_out', 'no_show')
		 ORDER BY s.starts_at DESC NULLS LAST
		 LIMIT $3`,
		userID, sport, playerHistoryLimit,
	)
	if err != nil {
		return a, err
	}
	for rows.Next() {
		var h models.PlayerSessionHistory
		if err := rows.Scan(&h.SessionID, &h.SessionName, &h.ClubName, &h.StartsAt, &h.Outcome); err != nil {
			rows.Close()
			return a, err
		}
		a.Sessions = append(a.Sessions, h)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return a, err
	}

	rows, err = pool.Query(ctx,
		`SELECT ac.id, s.name, c.name, ac.completed_at, ap.team, ac.result,
		        (SELECT coalesce(json_agg(json_build_object('name', coalesce(u.display_name, u.username, other.guest_name), 'team', other.team) ORDER BY other.team, other.slot_order), '[]'::json)
		         FROM activity_participants other LEFT JOIN users u ON u.id = other.user_id
		         WHERE other.activity_id = ac.id)
		 FROM activity_participants ap
		 JOIN activities ac ON ac.id = ap.activity_id
		 JOIN sessions s ON s.id = ac.session_id
		 JOIN clubs c ON c.id = s.club_id
		 WHERE ap.user_id = $1 AND ac.sport = $2 AND ac.status = 'completed'
		 ORDER BY ac.completed_at DESC NULLS LAST
		 LIMIT $3`,
		userID, sport, playerHistoryLimit,
	)
	if err != nil {
		return a, err
	}
	defer rows.Close()
	for rows.Next() {
		var m models.PlayerMatchHistory
		var team *string
		var result []byte
		if err := rows.Scan(&m.ActivityID, &m.SessionName, &m.ClubName, &m.CompletedAt, &team, &result, &m.Players); err != nil {
			return a, err
		}
		if team != nil {
			m.Team = *team
		}
		m.Result = result
		m.Won = matchWon(result, m.Team)
		a.Matches = append(a.Matches, m)
	}
	return a, rows.Err()
}
