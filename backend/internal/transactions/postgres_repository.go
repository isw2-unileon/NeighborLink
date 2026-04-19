package transactions

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

func (r *postgresRepository) FindAll(ctx context.Context) ([]Transaction, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, listing_id, borrower_id, status, agreed_at, handover_at, return_at
		FROM transactions
	`)
	if err != nil {
		return nil, fmt.Errorf("transactions: query failed: %w", err)
	}
	defer rows.Close()

	transactions := make([]Transaction, 0)
	for rows.Next() {
		var t Transaction
		if err := rows.Scan(&t.ID, &t.ListingID, &t.BorrowerID, &t.Status, &t.AgreedAt, &t.HandoverAt, &t.ReturnAt); err != nil {
			return nil, fmt.Errorf("transactions: scan failed: %w", err)
		}
		transactions = append(transactions, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("transactions: iteration failed: %w", err)
	}

	return transactions, nil
}

func (r *postgresRepository) FindByID(ctx context.Context, id string) (*Transaction, error) {
	var t Transaction
	err := r.pool.QueryRow(ctx, `
		SELECT id, listing_id, borrower_id, status, agreed_at, handover_at, return_at
		FROM transactions
		WHERE id = $1
	`, id).Scan(&t.ID, &t.ListingID, &t.BorrowerID, &t.Status, &t.AgreedAt, &t.HandoverAt, &t.ReturnAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("transactions: query failed: %w", err)
	}

	return &t, nil
}

// scanRows encapsulates the repetitive scan loop, following DRY.
func (r *postgresRepository) scanRows(rows pgx.Rows) ([]Transaction, error) {
	transactions := make([]Transaction, 0)
	for rows.Next() {
		var t Transaction
		if err := rows.Scan(&t.ID, &t.ListingID, &t.BorrowerID, &t.Status, &t.AgreedAt, &t.HandoverAt, &t.ReturnAt); err != nil {
			return nil, fmt.Errorf("transactions: scan failed: %w", err)
		}
		transactions = append(transactions, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("transactions: iteration failed: %w", err)
	}
	return transactions, nil
}

func (r *postgresRepository) FindByListing(ctx context.Context, listingID string) ([]Transaction, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT id, listing_id, borrower_id, status, agreed_at, handover_at, return_at
        FROM transactions WHERE listing_id = $1
    `, listingID)
	if err != nil {
		return nil, fmt.Errorf("transactions: query failed: %w", err)
	}
	defer rows.Close()
	return r.scanRows(rows)
}

func (r *postgresRepository) FindByBorrower(ctx context.Context, borrowerID string) ([]Transaction, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT id, listing_id, borrower_id, status, agreed_at, handover_at, return_at
        FROM transactions WHERE borrower_id = $1
    `, borrowerID)
	if err != nil {
		return nil, fmt.Errorf("transactions: query failed: %w", err)
	}
	defer rows.Close()
	return r.scanRows(rows)
}

func (r *postgresRepository) Create(ctx context.Context, t Transaction) (*Transaction, error) {
	var created Transaction
	err := r.pool.QueryRow(ctx, `
		INSERT INTO transactions (listing_id, borrower_id, status)
		VALUES ($1, $2, 'pending')
		RETURNING id, listing_id, borrower_id, status, agreed_at, handover_at, return_at
	`, t.ListingID, t.BorrowerID).Scan(
		&created.ID, &created.ListingID, &created.BorrowerID, &created.Status,
		&created.AgreedAt, &created.HandoverAt, &created.ReturnAt,
	)
	if err != nil {
		return nil, fmt.Errorf("transactions: insert failed: %w", err)
	}
	return &created, nil
}

func (r *postgresRepository) UpdatePaymentIntent(ctx context.Context, id string, paymentIntentID string, paymentMethodID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE transactions
		SET stripe_payment_intent_id = $1,
		    payment_method_id        = $2,
		    status                   = 'agreed',
		    agreed_at                = NOW()
		WHERE id = $3
	`, paymentIntentID, paymentMethodID, id)
	if err != nil {
		return fmt.Errorf("transactions: update payment intent failed: %w", err)
	}
	return nil
}

func (r *postgresRepository) UpdateStatus(ctx context.Context, id string, status string) error {
	var err error
	switch status {
	case "handed_over":
		_, err = r.pool.Exec(ctx, `
			UPDATE transactions
			SET status = 'handed_over', handover_at = NOW()
			WHERE id = $1
		`, id)
	case "returned":
		_, err = r.pool.Exec(ctx, `
			UPDATE transactions
			SET status = 'returned', return_at = NOW()
			WHERE id = $1
		`, id)
	default:
		_, err = r.pool.Exec(ctx, `
			UPDATE transactions SET status = $1 WHERE id = $2
		`, status, id)
	}
	if err != nil {
		return fmt.Errorf("transactions: update status failed: %w", err)
	}
	return nil
}
