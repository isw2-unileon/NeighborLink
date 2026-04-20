// Package transactions contains the domain logic for the transactions module.
package transactions

import "context"

// Repository defines what the domain needs from persistence.
type Repository interface {
	FindAll(ctx context.Context) ([]Transaction, error)
	FindByID(ctx context.Context, id string) (*Transaction, error)
	FindByListing(ctx context.Context, listingID string) ([]Transaction, error)
	FindByBorrower(ctx context.Context, borrowerID string) ([]Transaction, error)

	// Create inserts a new transaction and returns it with the generated ID.
	Create(ctx context.Context, t Transaction) (*Transaction, error)

	// UpdatePaymentIntent stores the Stripe PaymentIntent ID and payment method ID
	// on the transaction and sets its status to agreed.
	UpdatePaymentIntent(ctx context.Context, id string, paymentIntentID string, paymentMethodID string) error

	// UpdateStatus updates only the status field and the corresponding timestamp.
	// validStatuses: handed_over (sets handover_at), returned (sets return_at), cancelled.
	UpdateStatus(ctx context.Context, id string, status string) error
}
