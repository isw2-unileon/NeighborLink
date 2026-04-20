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

func (r *postgresRepository) Create(ctx context.Context, ownerID string, input ListingInput) (*Listing, error) {
	var l Listing
	err := r.pool.QueryRow(ctx, `
		INSERT INTO listings (owner_id, title, description, photos, deposit_amount, status)
		VALUES ($1, $2, $3, $4, $5, 'active')
		RETURNING id, owner_id, title, description, photos, deposit_amount, status, created_at
	`, ownerID, input.Title, input.Description, input.Photos, input.DepositAmount,
	).Scan(&l.ID, &l.OwnerID, &l.Title, &l.Description, &l.Photos, &l.DepositAmount, &l.Status, &l.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("listings: insert failed: %w", err)
	}
	return &l, nil
}

func (r *postgresRepository) Update(ctx context.Context, id string, input ListingInput) (*Listing, error) {
	var l Listing
	err := r.pool.QueryRow(ctx, `
		UPDATE listings
		SET title = $1, description = $2, photos = $3, deposit_amount = $4
		WHERE id = $5
		RETURNING id, owner_id, title, description, photos, deposit_amount, status, created_at
	`, input.Title, input.Description, input.Photos, input.DepositAmount, id,
	).Scan(&l.ID, &l.OwnerID, &l.Title, &l.Description, &l.Photos, &l.DepositAmount, &l.Status, &l.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("listings: update failed: %w", err)
	}
	return &l, nil
}

func (r *postgresRepository) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM listings WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("listings: delete failed: %w", err)
	}
	return nil
}
