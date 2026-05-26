// Package transactions contains the domain logic for the transactions module.
package transactions

import "context"

// Repository defines what the domain needs from persistence.
type Repository interface {
	FindAll(ctx context.Context) ([]Transaction, error)
	FindByID(ctx context.Context, id string) (*Transaction, error)
	FindByListing(ctx context.Context, listingID string) ([]Transaction, error)
	FindByBorrower(ctx context.Context, borrowerID string) ([]BorrowerTransaction, error)

	// Create inserts a new transaction and returns it with the generated ID.
	Create(ctx context.Context, t Transaction) (*Transaction, error)

	// UpdatePaymentIntent stores the Stripe PaymentIntent ID, payment method ID, and total
	// charged amount on the transaction and sets its status to agreed.
	UpdatePaymentIntent(ctx context.Context, id string, paymentIntentID string, paymentMethodID string, totalChargedCents int64) error

	// UpdateStatus updates only the status field and the corresponding timestamp.
	// validStatuses: handed_over (sets handover_at), returned (sets return_at), cancelled.
	UpdateStatus(ctx context.Context, id string, status string) error

	// FindListingOwnerByTransactionID returns the owner_id of the listing associated
	// with the given transaction. Returns an error if the transaction does not exist.
	FindListingOwnerByTransactionID(ctx context.Context, transactionID string) (string, error)

	// Reserve creates a transaction with start/end dates after validating no overlap.
	Reserve(ctx context.Context, t Transaction) (*Transaction, error)
	// FindBlockedDates returns all date ranges blocked by pending/active transactions.
	FindBlockedDates(ctx context.Context, listingID string) ([]DateRange, error)

	// GenerateCode generates a random 6-digit code, stores it in the given column
	// ("delivery_code" or "return_code") and returns it.
	GenerateCode(ctx context.Context, transactionID string, field string) (string, error)

	// ValidateCode checks if the given code matches the stored value in the given column.
	ValidateCode(ctx context.Context, transactionID string, field string, code string) (bool, error)
}
