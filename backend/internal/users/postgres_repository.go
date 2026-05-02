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

type postgresRepository struct {
	pool       *pgxpool.Pool
	httpClient *http.Client
}

func NewPostgresRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{
		pool:       pool,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (r *postgresRepository) FindAll(ctx context.Context) ([]User, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, email, name, avatar_url, address, reputation_score, created_at
		FROM users
	`)
	if err != nil {
		return nil, fmt.Errorf("users: query failed: %w", err)
	}
	defer rows.Close()

	users := make([]User, 0)
	for rows.Next() {
		var u User
		var avatarURL sql.NullString
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &avatarURL, &u.Address, &u.ReputationScore, &u.CreatedAt); err != nil {
			return nil, fmt.Errorf("users: scan failed: %w", err)
		}
		if avatarURL.Valid {
			u.AvatarURL = avatarURL.String
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
	var avatarURL sql.NullString
	err := r.pool.QueryRow(ctx, `
		SELECT id, email, name, avatar_url, address, reputation_score, created_at
		FROM users
		WHERE id = $1
	`, id).Scan(&u.ID, &u.Email, &u.Name, &avatarURL, &u.Address, &u.ReputationScore, &u.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("users: query failed: %w", err)
	}

	if avatarURL.Valid {
		u.AvatarURL = avatarURL.String
	}
	return &u, nil
}

func (r *postgresRepository) Update(ctx context.Context, id string, input UpdateUserInput) (*User, error) {
	coords, err := geocoder.Geocode(ctx, r.httpClient, input.Address)
	if err != nil {
		slog.Warn("geocoding failed on update, saving without location", "address", input.Address, "error", err)
	}

	var u User
	var avatarURL sql.NullString
	if coords != nil {
		err = r.pool.QueryRow(ctx, `
			UPDATE users
			SET name = $1, avatar_url = $2, address = $3,
			    location = ST_SetSRID(ST_MakePoint($4, $5), 4326)
			WHERE id = $6
			RETURNING id, email, name, avatar_url, address, reputation_score, created_at
		`, input.Name, input.AvatarURL, input.Address, coords.Lng, coords.Lat, id,
		).Scan(&u.ID, &u.Email, &u.Name, &avatarURL, &u.Address, &u.ReputationScore, &u.CreatedAt)
	} else {
		err = r.pool.QueryRow(ctx, `
			UPDATE users
			SET name = $1, avatar_url = $2, address = $3
			WHERE id = $4
			RETURNING id, email, name, avatar_url, address, reputation_score, created_at
		`, input.Name, input.AvatarURL, input.Address, id,
		).Scan(&u.ID, &u.Email, &u.Name, &avatarURL, &u.Address, &u.ReputationScore, &u.CreatedAt)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("users: update failed: %w", err)
	}
	if avatarURL.Valid {
		u.AvatarURL = avatarURL.String
	}
	return &u, nil
}
