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
