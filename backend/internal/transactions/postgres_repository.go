package transactions

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"time"

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
		SELECT id, listing_id, borrower_id, status, total_charged_cents, start_date, end_date, agreed_at, handover_at, return_at, dispute_refund_points
		FROM transactions
	`)
	if err != nil {
		return nil, fmt.Errorf("transactions: query failed: %w", err)
	}
	defer rows.Close()

	transactions := make([]Transaction, 0)
	for rows.Next() {
		var t Transaction
		if err := rows.Scan(&t.ID, &t.ListingID, &t.BorrowerID, &t.Status, &t.TotalChargedCents, &t.StartDate, &t.EndDate, &t.AgreedAt, &t.HandoverAt, &t.ReturnAt, &t.DisputeRefundPoints); err != nil {
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
		SELECT id, listing_id, borrower_id, status,
			COALESCE(stripe_payment_intent_id, '') AS stripe_payment_intent_id,
			COALESCE(payment_method_id, '')        AS payment_method_id,
			total_charged_cents, start_date, end_date, agreed_at, handover_at, return_at,
			dispute_refund_points
		FROM transactions
		WHERE id = $1
	`, id).Scan(&t.ID, &t.ListingID, &t.BorrowerID, &t.Status,
		&t.StripePaymentIntentID, &t.PaymentMethodID,
		&t.TotalChargedCents, &t.StartDate, &t.EndDate, &t.AgreedAt, &t.HandoverAt, &t.ReturnAt,
		&t.DisputeRefundPoints)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("transactions: query failed: %w", err)
	}

	return &t, nil
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
            UPDATE transactions
            SET status = $1
            WHERE id = $2
        `, status, id)
	}
	if err != nil {
		return fmt.Errorf("transactions: update status failed: %w", err)
	}
	return nil
}

// scanRows encapsulates the repetitive scan loop, following DRY.
func (r *postgresRepository) scanRows(rows pgx.Rows) ([]Transaction, error) {
	transactions := make([]Transaction, 0)
	for rows.Next() {
		var t Transaction
		if err := rows.Scan(&t.ID, &t.ListingID, &t.BorrowerID, &t.Status, &t.TotalChargedCents, &t.StartDate, &t.EndDate, &t.AgreedAt, &t.HandoverAt, &t.ReturnAt, &t.DisputeRefundPoints); err != nil {
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
        SELECT id, listing_id, borrower_id, status, total_charged_cents, start_date, end_date, agreed_at, handover_at, return_at, dispute_refund_points
        FROM transactions WHERE listing_id = $1
    `, listingID)
	if err != nil {
		return nil, fmt.Errorf("transactions: query failed: %w", err)
	}
	defer rows.Close()
	return r.scanRows(rows)
}

func (r *postgresRepository) FindByBorrower(ctx context.Context, borrowerID string) ([]BorrowerTransaction, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.listing_id, t.borrower_id, t.status,
		       t.total_charged_cents, t.start_date, t.end_date, t.agreed_at, t.handover_at, t.return_at,
		       t.dispute_refund_points, l.title, l.photos
		FROM transactions t
		JOIN listings l ON t.listing_id = l.id
		WHERE t.borrower_id = $1
		  AND t.status IN ('pending', 'agreed', 'awaiting_payment', 'handed_over', 'returned', 'cancelled', 'pending_review')
		ORDER BY t.agreed_at DESC NULLS LAST
	`, borrowerID)
	if err != nil {
		return nil, fmt.Errorf("transactions: query failed: %w", err)
	}
	defer rows.Close()

	result := make([]BorrowerTransaction, 0)
	for rows.Next() {
		var bt BorrowerTransaction
		var photos []string
		if err := rows.Scan(
			&bt.ID, &bt.ListingID, &bt.BorrowerID, &bt.Status,
			&bt.TotalChargedCents, &bt.StartDate, &bt.EndDate, &bt.AgreedAt, &bt.HandoverAt, &bt.ReturnAt,
			&bt.DisputeRefundPoints, &bt.ListingTitle, &photos,
		); err != nil {
			return nil, fmt.Errorf("transactions: scan failed: %w", err)
		}
		if len(photos) > 0 {
			bt.ListingPhoto = photos[0]
		}
		result = append(result, bt)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("transactions: iteration failed: %w", err)
	}
	return result, nil
}

func (r *postgresRepository) Create(ctx context.Context, t Transaction) (*Transaction, error) {
	var created Transaction
	err := r.pool.QueryRow(ctx, `
		INSERT INTO transactions (listing_id, borrower_id, payment_method_id, status)
		VALUES ($1, $2, $3, 'pending')
		RETURNING id, listing_id, borrower_id, status, payment_method_id, total_charged_cents, agreed_at, handover_at, return_at, dispute_refund_points
	`, t.ListingID, t.BorrowerID, t.PaymentMethodID).Scan(
		&created.ID, &created.ListingID, &created.BorrowerID, &created.Status,
		&created.PaymentMethodID, &created.TotalChargedCents, &created.AgreedAt, &created.HandoverAt, &created.ReturnAt, &created.DisputeRefundPoints,
	)
	if err != nil {
		return nil, fmt.Errorf("transactions: insert failed: %w", err)
	}
	return &created, nil
}

func (r *postgresRepository) UpdatePaymentIntent(ctx context.Context, id string, paymentIntentID string, paymentMethodID string, totalChargedCents int64) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE transactions
		SET stripe_payment_intent_id = $1,
		    payment_method_id        = $2,
		    total_charged_cents      = $3,
		    status                   = 'agreed',
		    agreed_at                = NOW()
		WHERE id = $4
	`, paymentIntentID, paymentMethodID, totalChargedCents, id)
	if err != nil {
		return fmt.Errorf("transactions: update payment intent failed: %w", err)
	}
	return nil
}

func (r *postgresRepository) FindListingOwnerByTransactionID(ctx context.Context, transactionID string) (string, error) {
	const q = `SELECT l.owner_id FROM transactions t JOIN listings l ON t.listing_id = l.id WHERE t.id = $1`
	var ownerID string
	err := r.pool.QueryRow(ctx, q, transactionID).Scan(&ownerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("transaction %s not found", transactionID)
	}
	if err != nil {
		return "", fmt.Errorf("transactions: find listing owner failed: %w", err)
	}
	return ownerID, nil
}

func (r *postgresRepository) Reserve(ctx context.Context, t Transaction) (*Transaction, error) {
	var created Transaction
	err := r.pool.QueryRow(ctx, `
        INSERT INTO transactions (listing_id, borrower_id, payment_method_id, status, start_date, end_date)
        VALUES ($1, $2, $3, 'pending', $4, $5)
        RETURNING id, listing_id, borrower_id, status, payment_method_id,
                  total_charged_cents, start_date, end_date, agreed_at, handover_at, return_at, dispute_refund_points
    `, t.ListingID, t.BorrowerID, t.PaymentMethodID, t.StartDate, t.EndDate,
	).Scan(
		&created.ID, &created.ListingID, &created.BorrowerID, &created.Status,
		&created.PaymentMethodID, &created.TotalChargedCents,
		&created.StartDate, &created.EndDate,
		&created.AgreedAt, &created.HandoverAt, &created.ReturnAt,
		&created.DisputeRefundPoints,
	)
	if err != nil {
		return nil, fmt.Errorf("transactions: reserve failed: %w", err)
	}
	return &created, nil
}

func (r *postgresRepository) UpdateDisputeRefund(ctx context.Context, id string, points int) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE transactions
		SET dispute_refund_points = $1
		WHERE id = $2
	`, points, id)
	if err != nil {
		return fmt.Errorf("transactions: update dispute refund failed: %w", err)
	}
	return nil
}


func (r *postgresRepository) FindBlockedDates(ctx context.Context, listingID string) ([]DateRange, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT start_date, end_date
        FROM transactions
        WHERE listing_id = $1
          AND status IN ('pending', 'agreed', 'awaiting_payment')
          AND start_date IS NOT NULL
          AND end_date   IS NOT NULL
    `, listingID)
	if err != nil {
		return nil, fmt.Errorf("transactions: query blocked dates failed: %w", err)
	}
	defer rows.Close()

	ranges := make([]DateRange, 0)
	for rows.Next() {
		var startDate, endDate time.Time
		if err := rows.Scan(&startDate, &endDate); err != nil {
			return nil, fmt.Errorf("transactions: scan blocked dates failed: %w", err)
		}
		ranges = append(ranges, NewDateRange(&startDate, &endDate))
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("transactions: iteration failed: %w", err)
	}
	return ranges, nil
}

func (r *postgresRepository) GenerateCode(ctx context.Context, transactionID string, field string) (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", fmt.Errorf("failed to generate secure code: %w", err)
	}
	code := fmt.Sprintf("%06d", n.Int64())
	query := fmt.Sprintf("UPDATE transactions SET %s = $1 WHERE id = $2", field)
	_, err = r.pool.Exec(ctx, query, code, transactionID) // = en vez de :=
	if err != nil {
		return "", fmt.Errorf("transactions: generate code failed: %w", err)
	}
	return code, nil
}

func (r *postgresRepository) CancelByPaymentIntentID(ctx context.Context, paymentIntentID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE transactions SET status = 'cancelled'
		WHERE stripe_payment_intent_id = $1
	`, paymentIntentID)
	if err != nil {
		return fmt.Errorf("transactions: cancel by payment intent failed: %w", err)
	}
	return nil
}

func (r *postgresRepository) ValidateCode(ctx context.Context, transactionID string, field string, code string) (bool, error) {
	var stored string
	query := fmt.Sprintf("SELECT %s FROM transactions WHERE id = $1", field)
	err := r.pool.QueryRow(ctx, query, transactionID).Scan(&stored)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, fmt.Errorf("transaction %s not found", transactionID)
	}
	if err != nil {
		return false, fmt.Errorf("transactions: validate code failed: %w", err)
	}
	return stored == code, nil
}

func (r *postgresRepository) FindListingOwnerAndTitle(ctx context.Context, listingID string) (string, string, error) {
	var ownerID, title string
	err := r.pool.QueryRow(ctx,
		`SELECT owner_id, title FROM listings WHERE id = $1`,
		listingID,
	).Scan(&ownerID, &title)
	if err != nil {
		return "", "", fmt.Errorf("transactions: find listing owner and title failed: %w", err)
	}
	return ownerID, title, nil
}

func (r *postgresRepository) FindListingInfoForRefund(ctx context.Context, listingID string) (string, string, int, error) {
	var ownerID, title string
	var deposit int
	err := r.pool.QueryRow(ctx,
		`SELECT owner_id, title, deposit_amount FROM listings WHERE id = $1`,
		listingID,
	).Scan(&ownerID, &title, &deposit)
	if err != nil {
		return "", "", 0, fmt.Errorf("transactions: find listing info for refund failed: %w", err)
	}
	return ownerID, title, deposit, nil
}
