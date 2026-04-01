package listings

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

func (r *postgresRepository) FindAll(ctx context.Context) ([]Listing, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, owner_id, title, description, photos, deposit_amount, status, created_at
		FROM listings
	`)
	if err != nil {
		return nil, fmt.Errorf("listings: query failed: %w", err)
	}
	defer rows.Close()

	listings := make([]Listing, 0)
	for rows.Next() {
		var l Listing
		if err := rows.Scan(&l.ID, &l.OwnerID, &l.Title, &l.Description, &l.Photos, &l.DepositAmount, &l.Status, &l.CreatedAt); err != nil {
			return nil, fmt.Errorf("listings: scan failed: %w", err)
		}
		listings = append(listings, l)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("listings: iteration failed: %w", err)
	}

	return listings, nil
}

func (r *postgresRepository) FindByID(ctx context.Context, id string) (*Listing, error) {
	var l Listing
	err := r.pool.QueryRow(ctx, `
		SELECT id, owner_id, title, description, photos, deposit_amount, status, created_at
		FROM listings
		WHERE id = $1
	`, id).Scan(&l.ID, &l.OwnerID, &l.Title, &l.Description, &l.Photos, &l.DepositAmount, &l.Status, &l.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("listings: query failed: %w", err)
	}

	return &l, nil
}

func (r *postgresRepository) FindByOwner(ctx context.Context, ownerID string) ([]Listing, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, owner_id, title, description, photos, deposit_amount, status, created_at
		FROM listings
		WHERE owner_id = $1
	`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("listings: query failed: %w", err)
	}
	defer rows.Close()

	listings := make([]Listing, 0)
	for rows.Next() {
		var l Listing
		if err := rows.Scan(&l.ID, &l.OwnerID, &l.Title, &l.Description, &l.Photos, &l.DepositAmount, &l.Status, &l.CreatedAt); err != nil {
			return nil, fmt.Errorf("listings: scan failed: %w", err)
		}
		listings = append(listings, l)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("listings: iteration failed: %w", err)
	}

	return listings, nil
}
