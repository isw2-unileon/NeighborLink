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

func NewPostgresRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{pool: pool}
}

// scanListing — helper privado (DRY): evita repetir los mismos 10 campos en cada Scan
func scanListing(row pgx.Row, l *Listing) error {
	return row.Scan(
		&l.ID, &l.OwnerID, &l.Title, &l.Description,
		&l.Photos, &l.DepositAmount, &l.Status,
		&l.Category, &l.CreatedAt,
	)
}

func (r *postgresRepository) FindAll(ctx context.Context, f FilterParams) ([]Listing, error) {
	args := []any{}
	argN := 1

	q := `
		SELECT id, owner_id, title, description, COALESCE(photos, '[]'::jsonb),
		       deposit_amount, status, category, created_at
		FROM listings
		WHERE 1=1`

	if f.ExcludeOwnerID != "" {
		q += fmt.Sprintf(" AND owner_id != $%d", argN)
		args = append(args, f.ExcludeOwnerID)
		argN++
	}
	if f.Category != "" {
		q += fmt.Sprintf(" AND category = $%d", argN)
		args = append(args, f.Category)
		argN++
	}
	if f.Status != "" {
		if f.Status == StatusBorrowed {
			q += fmt.Sprintf(
				" AND status IN ($%d, $%d, $%d)",
				argN, argN+1, argN+2,
			)
			args = append(args,
				StatusPendingHandover,
				StatusPendingReturn,
				StatusBorrowed,
			)
			argN += 3
		} else {
			q += fmt.Sprintf(" AND status = $%d", argN)
			args = append(args, f.Status)
			argN++
		}
	}
	if f.Deposit > 0 {
		q += fmt.Sprintf(" AND deposit_amount <= $%d", argN)
		args = append(args, f.Deposit)
		argN++
	}

	q += " ORDER BY created_at DESC"

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("listings: query failed: %w", err)
	}
	defer rows.Close()

	listings := make([]Listing, 0)
	for rows.Next() {
		var l Listing
		if err := rows.Scan(
			&l.ID, &l.OwnerID, &l.Title, &l.Description,
			&l.Photos, &l.DepositAmount, &l.Status,
			&l.Category, &l.CreatedAt,
		); err != nil {
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
		SELECT id, owner_id, title, description, COALESCE(photos, '[]'::jsonb),
		       deposit_amount, status, category, created_at
		FROM listings
		WHERE id = $1
	`, id).Scan(
		&l.ID, &l.OwnerID, &l.Title, &l.Description,
		&l.Photos, &l.DepositAmount, &l.Status,
		&l.Category, &l.CreatedAt,
	)

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
		SELECT id, owner_id, title, description, COALESCE(photos, '[]'::jsonb),
		       deposit_amount, status, category, created_at
		FROM listings
		WHERE owner_id = $1
		ORDER BY created_at DESC
	`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("listings: query failed: %w", err)
	}
	defer rows.Close()

	listings := make([]Listing, 0)
	for rows.Next() {
		var l Listing
		if err := rows.Scan(
			&l.ID, &l.OwnerID, &l.Title, &l.Description,
			&l.Photos, &l.DepositAmount, &l.Status,
			&l.Category, &l.CreatedAt,
		); err != nil {
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
		INSERT INTO listings (owner_id, title, description, photos, deposit_amount, status, category)
		VALUES ($1, $2, $3, $4, $5, 'available', $6)
		RETURNING id, owner_id, title, description, COALESCE(photos, '[]'::jsonb),
		          deposit_amount, status, category, created_at
	`, ownerID, input.Title, input.Description, input.Photos, input.DepositAmount, input.Category,
	).Scan(
		&l.ID, &l.OwnerID, &l.Title, &l.Description,
		&l.Photos, &l.DepositAmount, &l.Status,
		&l.Category, &l.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("listings: insert failed: %w", err)
	}
	return &l, nil
}

func (r *postgresRepository) Update(ctx context.Context, id string, input ListingInput) (*Listing, error) {
	var l Listing
	err := r.pool.QueryRow(ctx, `
        UPDATE listings
        SET title = $1,
            description = $2,
            photos = $3,
            deposit_amount = $4,
            category = $5,
            status = $6
        WHERE id = $7
        RETURNING id, owner_id, title, description, COALESCE(photos, '[]'::jsonb),
                  deposit_amount, status, category, created_at
    `, input.Title, input.Description, input.Photos, input.DepositAmount, input.Category, input.Status, id,
	).Scan(
		&l.ID, &l.OwnerID, &l.Title, &l.Description,
		&l.Photos, &l.DepositAmount, &l.Status,
		&l.Category, &l.CreatedAt,
	)

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

func (r *postgresRepository) AddPhoto(ctx context.Context, id string, photoURL string) (*Listing, error) {
	var l Listing
	err := r.pool.QueryRow(ctx, `
		UPDATE listings
		SET photos = photos || to_jsonb($1::text)
		WHERE id = $2
		RETURNING id, owner_id, title, description, COALESCE(photos, '[]'::jsonb),
		          deposit_amount, status, category, created_at
	`, photoURL, id).Scan(
		&l.ID, &l.OwnerID, &l.Title, &l.Description,
		&l.Photos, &l.DepositAmount, &l.Status,
		&l.Category, &l.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("listings: add photo failed: %w", err)
	}
	return &l, nil
}
