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

// NewPostgresRepository creates a new PostgreSQL-backed listings repository.
func NewPostgresRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{pool: pool}
}

// selectListingFields — campos comunes para todos los SELECT de listings (DRY).
const selectListingFields = `
	SELECT l.id, l.owner_id, l.title, l.description, COALESCE(l.photos, '[]'::jsonb),
	       l.deposit_amount, l.status, l.category, l.created_at,
	       ST_Y(u.location::geometry) AS owner_lat,
	       ST_X(u.location::geometry) AS owner_lon
`

// scanListing — helper DRY: centraliza el Scan de todos los campos de Listing.
func scanListing(row pgx.Row, l *Listing) error {
	return row.Scan(
		&l.ID, &l.OwnerID, &l.Title, &l.Description,
		&l.Photos, &l.DepositAmount, &l.Status,
		&l.Category, &l.CreatedAt,
		&l.OwnerLat, &l.OwnerLon,
	)
}

func (r *postgresRepository) FindAll(ctx context.Context, f FilterParams) ([]Listing, error) {
	args := []any{}
	argN := 1

	q := selectListingFields + `FROM listings l JOIN users u ON u.id = l.owner_id WHERE 1=1`

	if f.ExcludeOwnerID != "" {
		q += fmt.Sprintf(" AND l.owner_id != $%d", argN)
		args = append(args, f.ExcludeOwnerID)
		argN++
	}
	if f.Category != "" {
		q += fmt.Sprintf(" AND l.category = $%d", argN)
		args = append(args, f.Category)
		argN++
	}
	if f.Status != "" {
		if f.Status == StatusBorrowed {
			q += fmt.Sprintf(
				" AND l.status IN ($%d, $%d, $%d)",
				argN, argN+1, argN+2,
			)
			args = append(args, StatusPendingHandover, StatusPendingReturn, StatusBorrowed)
			argN += 3
		} else {
			q += fmt.Sprintf(" AND l.status = $%d", argN)
			args = append(args, f.Status)
			argN++
		}
	}
	if f.MinDeposit > 0 {
		q += fmt.Sprintf(" AND l.deposit_amount >= $%d", argN)
		args = append(args, f.MinDeposit)
		argN++
	}
	if f.MaxDeposit > 0 {
		q += fmt.Sprintf(" AND l.deposit_amount <= $%d", argN)
		args = append(args, f.MaxDeposit)
	}

	q += " ORDER BY l.created_at DESC"

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("listings: query failed: %w", err)
	}
	defer rows.Close()

	listings := make([]Listing, 0)
	for rows.Next() {
		var l Listing
		if err := scanListing(rows, &l); err != nil {
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
	err := scanListing(r.pool.QueryRow(ctx,
		selectListingFields+`FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.id = $1`,
		id,
	), &l)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("listings: query failed: %w", err)
	}
	return &l, nil
}

func (r *postgresRepository) FindByOwner(ctx context.Context, ownerID string) ([]Listing, error) {
	rows, err := r.pool.Query(ctx,
		selectListingFields+`FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.owner_id = $1 ORDER BY l.created_at DESC`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("listings: query failed: %w", err)
	}
	defer rows.Close()

	listings := make([]Listing, 0)
	for rows.Next() {
		var l Listing
		if err := scanListing(rows, &l); err != nil {
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
	err := scanListing(r.pool.QueryRow(ctx, `
		INSERT INTO listings (owner_id, title, description, photos, deposit_amount, status, category)
		VALUES ($1, $2, $3, $4, $5, 'available', $6)
		RETURNING id, owner_id, title, description, COALESCE(photos, '[]'::jsonb),
		          deposit_amount, status, category, created_at,
		          ST_Y((SELECT location FROM users WHERE id = $1)::geometry),
		          ST_X((SELECT location FROM users WHERE id = $1)::geometry)
	`, ownerID, input.Title, input.Description, input.Photos, input.DepositAmount, input.Category,
	), &l)
	if err != nil {
		return nil, fmt.Errorf("listings: insert failed: %w", err)
	}
	return &l, nil
}

func (r *postgresRepository) Update(ctx context.Context, id string, input ListingInput) (*Listing, error) {
	var l Listing
	err := scanListing(r.pool.QueryRow(ctx, `
		UPDATE listings l
		SET title = $1, description = $2, photos = $3,
		    deposit_amount = $4, category = $5, status = $6
		FROM users u
		WHERE l.id = $7 AND u.id = l.owner_id
		RETURNING l.id, l.owner_id, l.title, l.description, COALESCE(l.photos, '[]'::jsonb),
		          l.deposit_amount, l.status, l.category, l.created_at,
		          ST_Y(u.location::geometry), ST_X(u.location::geometry)
	`, input.Title, input.Description, input.Photos, input.DepositAmount, input.Category, input.Status, id,
	), &l)

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
	err := scanListing(r.pool.QueryRow(ctx, `
		UPDATE listings l
		SET photos = l.photos || to_jsonb($1::text)
		FROM users u
		WHERE l.id = $2 AND u.id = l.owner_id
		RETURNING l.id, l.owner_id, l.title, l.description, COALESCE(l.photos, '[]'::jsonb),
		          l.deposit_amount, l.status, l.category, l.created_at,
		          ST_Y(u.location::geometry), ST_X(u.location::geometry)
	`, photoURL, id), &l)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("listings: add photo failed: %w", err)
	}
	return &l, nil
}

func (r *postgresRepository) UpdateStatus(ctx context.Context, id string, status string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE listings SET status = $1 WHERE id = $2`,
		status, id,
	)
	if err != nil {
		return fmt.Errorf("listings: update status failed: %w", err)
	}
	return nil
}
