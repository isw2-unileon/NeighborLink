package reviews

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

func (r *postgresRepository) FindByTransaction(ctx context.Context, transactionID string) ([]Review, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, transaction_id, reviewer_id, reviewed_id, rating, comment, created_at
		FROM reviews
		WHERE transaction_id = $1
	`, transactionID)
	if err != nil {
		return nil, fmt.Errorf("reviews: query failed: %w", err)
	}
	defer rows.Close()

	reviews := make([]Review, 0)
	for rows.Next() {
		var rv Review
		if err := rows.Scan(&rv.ID, &rv.TransactionID, &rv.ReviewerID, &rv.ReviewedID, &rv.Rating, &rv.Comment, &rv.CreatedAt); err != nil {
			return nil, fmt.Errorf("reviews: scan failed: %w", err)
		}
		reviews = append(reviews, rv)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reviews: iteration failed: %w", err)
	}

	return reviews, nil
}

func (r *postgresRepository) FindByReviewed(ctx context.Context, reviewedID string) ([]Review, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, transaction_id, reviewer_id, reviewed_id, rating, comment, created_at
		FROM reviews
		WHERE reviewed_id = $1
		ORDER BY created_at DESC
	`, reviewedID)
	if err != nil {
		return nil, fmt.Errorf("reviews: query failed: %w", err)
	}
	defer rows.Close()

	reviews := make([]Review, 0)
	for rows.Next() {
		var rv Review
		if err := rows.Scan(&rv.ID, &rv.TransactionID, &rv.ReviewerID, &rv.ReviewedID, &rv.Rating, &rv.Comment, &rv.CreatedAt); err != nil {
			return nil, fmt.Errorf("reviews: scan failed: %w", err)
		}
		reviews = append(reviews, rv)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reviews: iteration failed: %w", err)
	}

	return reviews, nil
}

func (r *postgresRepository) FindByID(ctx context.Context, id string) (*Review, error) {
	var rv Review
	err := r.pool.QueryRow(ctx, `
		SELECT id, transaction_id, reviewer_id, reviewed_id, rating, comment, created_at
		FROM reviews
		WHERE id = $1
	`, id).Scan(&rv.ID, &rv.TransactionID, &rv.ReviewerID, &rv.ReviewedID, &rv.Rating, &rv.Comment, &rv.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("reviews: query failed: %w", err)
	}

	return &rv, nil
}
