package users

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/isw2-unileon/neighborlink/backend/internal/platform/geocoder"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const selectUserFields = `
	SELECT id, email, name, avatar_url, address, reputation_score, points, role, created_at,
	       ST_Y(location::geometry) AS lat,
	       ST_X(location::geometry) AS lon
`

type postgresRepository struct {
	pool       *pgxpool.Pool
	httpClient *http.Client
}

// NewPostgresRepository creates a new PostgreSQL-backed users repository.
func NewPostgresRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{
		pool:       pool,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

// scanUser — helper DRY: centraliza el Scan de todos los campos de User.
func scanUser(row pgx.Row, u *User) error {
	var avatarURL sql.NullString
	if err := row.Scan(
		&u.ID, &u.Email, &u.Name, &avatarURL, &u.Address,
		&u.ReputationScore, &u.Points, &u.Role, &u.CreatedAt,
		&u.Lat, &u.Lon,
	); err != nil {
		return err
	}
	if avatarURL.Valid {
		u.AvatarURL = avatarURL.String
	}
	return nil
}

func (r *postgresRepository) FindAll(ctx context.Context) ([]User, error) {
	rows, err := r.pool.Query(ctx, selectUserFields+` FROM users`)
	if err != nil {
		return nil, fmt.Errorf("users: query failed: %w", err)
	}
	defer rows.Close()

	users := make([]User, 0)
	for rows.Next() {
		var u User
		if err := scanUser(rows, &u); err != nil {
			return nil, fmt.Errorf("users: scan failed: %w", err)
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("users: iteration failed: %w", err)
	}
	return users, nil
}

func (r *postgresRepository) FindByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := scanUser(r.pool.QueryRow(ctx,
		selectUserFields+` FROM users WHERE id = $1`, id,
	), &u)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("users: query failed: %w", err)
	}
	return &u, nil
}

func (r *postgresRepository) FindFirstAdmin(ctx context.Context) (*User, error) {
	var u User
	err := scanUser(r.pool.QueryRow(ctx,
		selectUserFields+` FROM users WHERE role = 'admin' LIMIT 1`,
	), &u)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("users: find admin failed: %w", err)
	}
	return &u, nil
}

func (r *postgresRepository) Update(ctx context.Context, id string, input UpdateUserInput) (*User, error) {
	coords, err := geocoder.Geocode(ctx, r.httpClient, input.Address)
	if err != nil {
		slog.Warn("geocoding failed on update, saving without location", "address", input.Address, "error", err)
	}

	returning := ` RETURNING id, email, name, avatar_url, address, reputation_score, points, role, created_at,
	                          ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon`

	var u User
	if coords != nil {
		err = scanUser(r.pool.QueryRow(ctx, `
			UPDATE users
			SET name = $1, avatar_url = $2, address = $3,
			    location = ST_SetSRID(ST_MakePoint($4, $5), 4326)
			WHERE id = $6
		`+returning, input.Name, input.AvatarURL, input.Address, coords.Lng, coords.Lat, id), &u)
	} else {
		err = scanUser(r.pool.QueryRow(ctx, `
			UPDATE users
			SET name = $1, avatar_url = $2, address = $3
			WHERE id = $4
		`+returning, input.Name, input.AvatarURL, input.Address, id), &u)
	}

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("users: update failed: %w", err)
	}
	return &u, nil
}
