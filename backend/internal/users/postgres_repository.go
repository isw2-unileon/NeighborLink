package users

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
// Note the return type is the interface, not the concrete struct — callers
// never depend on the implementation detail.
func NewPostgresRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{pool: pool}
}

func (r *postgresRepository) FindAll(ctx context.Context) ([]User, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, email, name, avatar_url, reputation_score, created_at
		FROM users
	`)
	if err != nil {
		return nil, fmt.Errorf("users: query failed: %w", err)
	}
	defer rows.Close()

	users := make([]User, 0)
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.ReputationScore, &u.CreatedAt); err != nil {
			return nil, fmt.Errorf("users: scan failed: %w", err)
		}
		users = append(users, u)
	}

	// rows.Err() catches any error that occurred during iteration
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("users: iteration failed: %w", err)
	}

	return users, nil
}

func (r *postgresRepository) FindByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := r.pool.QueryRow(ctx, `
		SELECT id, email, name, avatar_url, reputation_score, created_at
		FROM users
		WHERE id = $1
	`, id).Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.ReputationScore, &u.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("users: query failed: %w", err)
	}

	return &u, nil
}
