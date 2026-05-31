package notifications

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRepository implements the Repository interface using PostgreSQL as the data store.
type PostgresRepository struct {
	db *pgxpool.Pool
}

// NewRepository creates a new instance of PostgresRepository with the given database connection pool.
func NewRepository(db *pgxpool.Pool) Repository {
	return &PostgresRepository{db: db}
}

// Create inserts a new notification into the database and returns the created notification with its generated ID and timestamp.
func (r *PostgresRepository) Create(ctx context.Context, n Notification) (*Notification, error) {
	query := `
		INSERT INTO notifications (user_id, type, payload, read)
		VALUES ($1, $2, $3, $4)
		RETURNING id, user_id, type, payload, read, created_at
	`

	var created Notification
	err := r.db.QueryRow(ctx, query, n.UserID, n.Type, n.Payload, n.Read).
		Scan(&created.ID, &created.UserID, &created.Type, &created.Payload, &created.Read, &created.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("notifications: insert failed: %w", err)
	}

	return &created, nil
}

// ListByUser retrieves a list of notifications for a specific user, ordered by creation time in descending order.
func (r *PostgresRepository) ListByUser(ctx context.Context, userID string, limit int) ([]Notification, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, type, payload, read, created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("notifications: list failed: %w", err)
	}
	defer rows.Close()

	var items []Notification
	for rows.Next() {
		var n Notification
		err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Payload, &n.Read, &n.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("notifications: scan failed: %w", err)
		}
		items = append(items, n)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("notifications: rows error: %w", err)
	}

	return items, nil
}

// CountUnreadByUser returns the number of unread notifications for a specific user.
func (r *PostgresRepository) CountUnreadByUser(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM notifications
		WHERE user_id = $1 AND read = false
	`, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("notifications: unread count failed: %w", err)
	}

	return count, nil
}

// MarkAsRead marks a single notification as read for a specific user. It returns an error if the notification does not exist or does not belong to the user.
func (r *PostgresRepository) MarkAsRead(ctx context.Context, userID, notificationID string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE notifications
		SET read = true
		WHERE id = $1 AND user_id = $2
	`, notificationID, userID)
	if err != nil {
		return fmt.Errorf("notifications: mark as read failed: %w", err)
	}

	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	return nil
}

// MarkAllAsRead marks all notifications as read for a specific user. It returns an error if the update operation fails.
func (r *PostgresRepository) MarkAllAsRead(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE notifications
		SET read = true
		WHERE user_id = $1 AND read = false
	`, userID)
	if err != nil {
		return fmt.Errorf("notifications: mark all as read failed: %w", err)
	}

	return nil
}
