package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const sessionMessageSelect = `SELECT sm.id, sm.session_id, sm.user_id, u.username, u.display_name, sm.body, (sm.image_data IS NOT NULL), sm.created_at
	 FROM session_messages sm JOIN users u ON u.id = sm.user_id`

func scanSessionMessage(row pgx.CollectableRow) (models.SessionMessage, error) {
	var m models.SessionMessage
	err := row.(pgx.Rows).Scan(&m.ID, &m.SessionID, &m.UserID, &m.Username, &m.DisplayName, &m.Body, &m.HasImage, &m.CreatedAt)
	return m, err
}

// CreateSessionMessageParams — body and the image are each optional
// individually, but the caller (handler) guarantees at least one is set
// before reaching here; imageData/imageContentType are either both nil or
// both set, same guarantee.
type CreateSessionMessageParams struct {
	SessionID        string
	UserID           string
	Body             string
	ImageData        []byte
	ImageContentType *string
}

// CreateSessionMessage inserts a new Session Chat message. body/image are
// trimmed/validated by the caller (handler) before reaching here, same
// convention as every other free-text field in this package.
func CreateSessionMessage(ctx context.Context, pool *pgxpool.Pool, p CreateSessionMessageParams) (models.SessionMessage, error) {
	var imageSizeBytes *int
	if p.ImageData != nil {
		n := len(p.ImageData)
		imageSizeBytes = &n
	}
	rows, err := pool.Query(ctx,
		`WITH inserted AS (
			INSERT INTO session_messages (session_id, user_id, body, image_data, image_content_type, image_size_bytes)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, session_id, user_id, body, image_data, created_at
		 )
		 SELECT inserted.id, inserted.session_id, inserted.user_id, u.username, u.display_name, inserted.body,
			(inserted.image_data IS NOT NULL), inserted.created_at
		 FROM inserted JOIN users u ON u.id = inserted.user_id`,
		p.SessionID, p.UserID, p.Body, p.ImageData, p.ImageContentType, imageSizeBytes,
	)
	if err != nil {
		return models.SessionMessage{}, err
	}
	defer rows.Close()
	return pgx.CollectOneRow(rows, scanSessionMessage)
}

// ListSessionMessages returns every message for a Session, oldest first —
// no pagination yet (MVP scale; a Session's chat is bounded by its own
// lifetime, not expected to grow unbounded like a persistent channel).
// Never includes image bytes — see HasImage's own doc comment.
func ListSessionMessages(ctx context.Context, pool *pgxpool.Pool, sessionID string) ([]models.SessionMessage, error) {
	rows, err := pool.Query(ctx, sessionMessageSelect+" WHERE sm.session_id = $1 ORDER BY sm.created_at ASC", sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.SessionMessage{}
	for rows.Next() {
		m, err := scanSessionMessage(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

// GetSessionMessageImage fetches one message's image bytes, scoped to
// sessionID (defense in depth beyond the URL's own messageID — a message
// id from a different Session can never leak its image through this
// Session's route). ErrNotFound covers "no such message in this Session"
// and "message exists but has no image" alike — the caller doesn't need
// to distinguish them.
func GetSessionMessageImage(ctx context.Context, pool *pgxpool.Pool, sessionID, messageID string) (models.SessionMessageImage, error) {
	var img models.SessionMessageImage
	var contentType *string
	err := pool.QueryRow(ctx,
		`SELECT image_data, image_content_type FROM session_messages
		 WHERE id = $1 AND session_id = $2 AND image_data IS NOT NULL`,
		messageID, sessionID,
	).Scan(&img.Data, &contentType)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.SessionMessageImage{}, ErrNotFound
	}
	if err != nil {
		return models.SessionMessageImage{}, err
	}
	if contentType != nil {
		img.ContentType = *contentType
	}
	return img, nil
}
