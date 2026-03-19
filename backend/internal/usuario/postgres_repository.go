package usuario

import (
	"context"
	"fmt"

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

func (r *postgresRepository) FindAll(ctx context.Context) ([]Usuario, error) {
	rows, err := r.pool.Query(ctx, "SELECT id, nombre, apellidos, edad, correo, created_at FROM usuarios")
	if err != nil {
		return nil, fmt.Errorf("usuario: query failed: %w", err)
	}
	defer rows.Close()

	var usuarios []Usuario
	for rows.Next() {
		var u Usuario
		if err := rows.Scan(&u.ID, &u.Nombre, &u.Apellidos, &u.Edad, &u.Correo, &u.CreatedAt); err != nil {
			return nil, fmt.Errorf("usuario: scan failed: %w", err)
		}
		usuarios = append(usuarios, u)
	}
	return usuarios, nil
}
