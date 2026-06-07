package messages

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type postgresRepository struct {
	pool *pgxpool.Pool
}

// NewPostgresRepository creates a PostgreSQL-backed implementation of Repository.
// Returns the interface, not the concrete struct — information hiding.
func NewPostgresRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{pool: pool}
}

func (r *postgresRepository) FindByTransaction(ctx context.Context, transactionID string) ([]Message, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, transaction_id, sender_id, content, created_at
		FROM messages
		WHERE transaction_id = $1
		ORDER BY created_at ASC
	`, transactionID)
	if err != nil {
		return nil, fmt.Errorf("messages: query failed: %w", err)
	}
	defer rows.Close()

	messages := make([]Message, 0)
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.TransactionID, &m.SenderID, &m.Content, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("messages: scan failed: %w", err)
		}
		messages = append(messages, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("messages: iteration failed: %w", err)
	}

	return messages, nil
}

func (r *postgresRepository) FindByID(ctx context.Context, id string) (*Message, error) {
	var m Message
	err := r.pool.QueryRow(ctx, `
		SELECT id, transaction_id, sender_id, content, created_at
		FROM messages
		WHERE id = $1
	`, id).Scan(&m.ID, &m.TransactionID, &m.SenderID, &m.Content, &m.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("messages: query failed: %w", err)
	}

	return &m, nil
}

func (r *postgresRepository) Create(ctx context.Context, m Message) (*Message, error) {
	var created Message
	err := r.pool.QueryRow(ctx, `
		INSERT INTO messages (transaction_id, sender_id, content)
		VALUES ($1, $2, $3)
		RETURNING id, transaction_id, sender_id, content, created_at
	`, m.TransactionID, m.SenderID, m.Content).
		Scan(&created.ID, &created.TransactionID, &created.SenderID, &created.Content, &created.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("messages: insert failed: %w", err)
	}
	return &created, nil
}

func (r *postgresRepository) FindActiveByParticipant(ctx context.Context, userID string) ([]Message, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT id, transaction_id, sender_id, content, created_at, title, photo, status, borrower_id, owner_id, has_unread
        FROM (
            SELECT DISTINCT ON (m.transaction_id)
                m.id,
                m.transaction_id,
                m.sender_id,
                m.content,
                m.created_at,
                l.title,
                COALESCE(l.photos->>0, '') AS photo,
                t.status,
                t.borrower_id,
                l.owner_id,
                EXISTS (
                    SELECT 1 FROM messages m2
                    WHERE m2.transaction_id = m.transaction_id
                      AND m2.sender_id != $1
                      AND m2.created_at > COALESCE(
                          (SELECT cr.last_read_at FROM chat_reads cr
                           WHERE cr.user_id = $1 AND cr.transaction_id = m.transaction_id),
                          '1970-01-01'::timestamptz
                      )
                ) AS has_unread
            FROM messages m
            JOIN transactions t ON t.id = m.transaction_id
            JOIN listings l     ON l.id = t.listing_id
            JOIN users u        ON u.id = $1
            WHERE (t.borrower_id = $1 OR l.owner_id = $1 OR u.role = 'admin')
              AND t.status IN ('pending', 'awaiting_payment', 'agreed', 'handed_over', 'cancelled', 'pending_review')
            ORDER BY m.transaction_id, m.created_at DESC
        ) AS with_messages

        UNION ALL

        SELECT
            t.id,
            t.id,
            '00000000-0000-0000-0000-000000000000'::uuid,
            '',
            COALESCE(t.agreed_at, t.start_date::timestamptz),
            l.title,
            COALESCE(l.photos->>0, '') AS photo,
            t.status,
            t.borrower_id,
            l.owner_id,
            false AS has_unread
        FROM transactions t
        JOIN listings l ON l.id = t.listing_id
        JOIN users u    ON u.id = $1
        WHERE (t.borrower_id = $1 OR l.owner_id = $1 OR u.role = 'admin')
          AND t.status IN ('pending', 'awaiting_payment', 'agreed', 'handed_over', 'cancelled', 'pending_review')
          AND NOT EXISTS (
              SELECT 1 FROM messages m WHERE m.transaction_id = t.id
          )
    `, userID)
	if err != nil {
		return nil, fmt.Errorf("messages: query active chats failed: %w", err)
	}
	defer rows.Close()

	messages := make([]Message, 0)
	for rows.Next() {
		var m Message
		if err := rows.Scan(
			&m.ID, &m.TransactionID, &m.SenderID, &m.Content, &m.CreatedAt,
			&m.ListingTitle, &m.ListingPhoto, &m.Status,
			&m.BorrowerID, &m.OwnerID, &m.HasUnread,
		); err != nil {
			return nil, fmt.Errorf("messages: scan failed: %w", err)
		}
		messages = append(messages, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("messages: iteration failed: %w", err)
	}
	return messages, nil
}

func (r *postgresRepository) MarkAsRead(ctx context.Context, userID, transactionID string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO chat_reads (user_id, transaction_id, last_read_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (user_id, transaction_id) DO UPDATE SET last_read_at = NOW()
	`, userID, transactionID)
	if err != nil {
		return fmt.Errorf("messages: mark as read failed: %w", err)
	}
	return nil
}

func (r *postgresRepository) CountUnread(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT t.id)
		FROM messages m
		JOIN transactions t ON t.id = m.transaction_id
		JOIN listings l     ON l.id = t.listing_id
		WHERE (t.borrower_id = $1 OR l.owner_id = $1)
		  AND m.sender_id != $1
		  AND t.status IN ('pending', 'awaiting_payment', 'agreed', 'handed_over', 'cancelled', 'pending_review')
		  AND m.created_at > COALESCE(
		      (SELECT cr.last_read_at FROM chat_reads cr
		       WHERE cr.user_id = $1 AND cr.transaction_id = t.id),
		      '1970-01-01'::timestamptz
		  )
	`, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("messages: count unread failed: %w", err)
	}
	return count, nil
}
