package wallet

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type postgresRepository struct {
	pool *pgxpool.Pool
}

// NewPostgresRepository creates a new PostgreSQL-backed wallet repository.
func NewPostgresRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{pool: pool}
}

func (r *postgresRepository) GetPoints(ctx context.Context, userID string) (int, error) {
	var points int
	err := r.pool.QueryRow(ctx, `SELECT points FROM users WHERE id = $1`, userID).Scan(&points)
	if err != nil {
		return 0, fmt.Errorf("wallet: get points failed: %w", err)
	}
	return points, nil
}

func (r *postgresRepository) AddPoints(ctx context.Context, userID string, delta int) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET points = points + $1 WHERE id = $2`, delta, userID)
	if err != nil {
		return fmt.Errorf("wallet: add points failed: %w", err)
	}
	return nil
}

func (r *postgresRepository) CreateRedemption(ctx context.Context, userID string, points int) (*Redemption, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("wallet: begin tx failed: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	_, err = tx.Exec(ctx, `UPDATE users SET points = 0 WHERE id = $1`, userID)
	if err != nil {
		return nil, fmt.Errorf("wallet: deduct points failed: %w", err)
	}

	amountEuros := float64(points) / 100.0
	var r2 Redemption
	err = tx.QueryRow(ctx, `
		INSERT INTO redemptions (user_id, points_redeemed, amount_euros, status)
		VALUES ($1, $2, $3, 'pending')
		RETURNING id, user_id, points_redeemed, amount_euros, status, created_at
	`, userID, points, amountEuros).Scan(
		&r2.ID, &r2.UserID, &r2.PointsRedeemed, &r2.AmountEuros, &r2.Status, &r2.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("wallet: insert redemption failed: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("wallet: commit failed: %w", err)
	}

	return &r2, nil
}

func (r *postgresRepository) GetPointsHistory(ctx context.Context, userID string) ([]PointsHistoryEntry, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, l.title, t.return_at,
		       (t.total_charged_cents - 200) * 5 / 100 AS points_earned
		FROM transactions t
		JOIN listings l ON t.listing_id = l.id
		WHERE l.owner_id = $1 AND t.status = 'returned'
		ORDER BY t.return_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("wallet: query history failed: %w", err)
	}
	defer rows.Close()

	entries := make([]PointsHistoryEntry, 0)
	for rows.Next() {
		var e PointsHistoryEntry
		if err := rows.Scan(&e.TransactionID, &e.ListingTitle, &e.CompletedAt, &e.PointsEarned); err != nil {
			return nil, fmt.Errorf("wallet: scan history failed: %w", err)
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("wallet: history iteration failed: %w", err)
	}

	return entries, nil
}