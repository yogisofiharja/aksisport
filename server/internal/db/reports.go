package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-021 reporting. A report goes to the owner/admins of the Communities
// it concerns, chosen by the caller (httpapi).

type CreateReportParams struct {
	ReporterID       string
	ReportedUserID   string
	MessageID        *string
	MessageBody      *string
	MessageHasImage  bool
	ConversationKind *string
	Reason           string
	ClubIDs          []string
}

func CreateReport(ctx context.Context, pool *pgxpool.Pool, p CreateReportParams) (string, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var id string
	err = tx.QueryRow(ctx,
		`INSERT INTO reports (reporter_id, reported_user_id, message_id, message_body, message_has_image, conversation_kind, reason)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		p.ReporterID, p.ReportedUserID, p.MessageID, p.MessageBody, p.MessageHasImage, p.ConversationKind, p.Reason,
	).Scan(&id)
	if err != nil {
		return "", err
	}
	for _, clubID := range p.ClubIDs {
		if _, err := tx.Exec(ctx, "INSERT INTO report_clubs (report_id, club_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", id, clubID); err != nil {
			return "", err
		}
	}
	return id, tx.Commit(ctx)
}

// SharedClubIDs is every Community both users belong to.
func SharedClubIDs(ctx context.Context, pool *pgxpool.Pool, userA, userB string) ([]string, error) {
	return collectIDs(ctx, pool,
		`SELECT a.club_id FROM club_members a JOIN club_members b ON b.club_id = a.club_id
		 WHERE a.user_id = $1 AND b.user_id = $2`, userA, userB)
}

// SessionClubID is the Community a Session belongs to.
func SessionClubID(ctx context.Context, pool *pgxpool.Pool, sessionID string) (string, error) {
	var id string
	err := pool.QueryRow(ctx, "SELECT club_id FROM sessions WHERE id = $1", sessionID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return id, err
}

// GetMessageForReport loads one message with its conversation.
func GetMessageForReport(ctx context.Context, pool *pgxpool.Pool, messageID string) (models.ConversationMessage, error) {
	return GetConversationMessage(ctx, pool, messageID)
}

const clubReportSelect = `SELECT r.id, r.reporter_id, ru.username, ru.display_name, r.reported_user_id, tu.username, tu.display_name,
	r.reason, r.created_at, r.message_id, r.message_body, r.message_has_image, r.conversation_kind,
	c.session_id::text, s.name, (cm.removed_at IS NOT NULL), (cm.id IS NOT NULL AND (s.club_id = rc.club_id OR c.club_id = rc.club_id))
	FROM report_clubs rc
	JOIN reports r ON r.id = rc.report_id
	JOIN users ru ON ru.id = r.reporter_id
	JOIN users tu ON tu.id = r.reported_user_id
	LEFT JOIN conversation_messages cm ON cm.id = r.message_id
	LEFT JOIN conversations c ON c.id = cm.conversation_id
	LEFT JOIN sessions s ON s.id = c.session_id`

func scanClubReport(row pgx.Row) (models.ClubReport, error) {
	var r models.ClubReport
	var messageID, body, kind, sessionID, sessionName *string
	var hasImage, removed, inClub bool
	err := row.Scan(&r.ID, &r.ReporterID, &r.ReporterUsername, &r.ReporterDisplayName, &r.ReportedUserID, &r.ReportedUsername, &r.ReportedDisplayName,
		&r.Reason, &r.CreatedAt, &messageID, &body, &hasImage, &kind, &sessionID, &sessionName, &removed, &inClub)
	if err != nil {
		return r, err
	}
	if kind != nil {
		m := &models.ReportMessage{ID: messageID, HasImage: hasImage, ConversationKind: *kind, SessionID: sessionID, SessionName: sessionName, Removed: removed}
		if body != nil {
			m.Body = *body
		}
		m.CanRemove = inClub && !removed && *kind != "direct" && *kind != "group"
		r.Message = m
	}
	return r, nil
}

// ListOpenClubReports is the reports a Community's owner/admins have not
// dealt with yet, newest first.
func ListOpenClubReports(ctx context.Context, pool *pgxpool.Pool, clubID string) ([]models.ClubReport, error) {
	rows, err := pool.Query(ctx, clubReportSelect+" WHERE rc.club_id = $1 AND rc.resolved_at IS NULL ORDER BY r.created_at DESC", clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.ClubReport{}
	for rows.Next() {
		r, err := scanClubReport(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

func GetOpenClubReport(ctx context.Context, pool *pgxpool.Pool, clubID, reportID string) (models.ClubReport, error) {
	if !IsUUID(reportID) {
		return models.ClubReport{}, ErrNotFound
	}
	r, err := scanClubReport(pool.QueryRow(ctx, clubReportSelect+" WHERE rc.club_id = $1 AND r.id = $2 AND rc.resolved_at IS NULL", clubID, reportID))
	if errors.Is(err, pgx.ErrNoRows) {
		return r, ErrNotFound
	}
	return r, err
}

func CountOpenClubReports(ctx context.Context, pool *pgxpool.Pool, clubID string) (int, error) {
	var n int
	err := pool.QueryRow(ctx, "SELECT count(*) FROM report_clubs WHERE club_id = $1 AND resolved_at IS NULL", clubID).Scan(&n)
	return n, err
}

// ResolveClubReport marks a report dealt with for one Community.
func ResolveClubReport(ctx context.Context, pool *pgxpool.Pool, clubID, reportID, userID string) error {
	_, err := pool.Exec(ctx,
		"UPDATE report_clubs SET resolved_at = now(), resolved_by = $3 WHERE club_id = $1 AND report_id = $2 AND resolved_at IS NULL",
		clubID, reportID, userID)
	return err
}

// RemoveMessage blanks a message (text and image) and marks it removed.
func RemoveMessage(ctx context.Context, pool *pgxpool.Pool, messageID, removedBy string) error {
	_, err := pool.Exec(ctx,
		`UPDATE conversation_messages
		 SET body = '', image_data = NULL, image_content_type = NULL, image_size_bytes = NULL, removed_at = now(), removed_by = $2
		 WHERE id = $1 AND removed_at IS NULL`,
		messageID, removedBy)
	return err
}
