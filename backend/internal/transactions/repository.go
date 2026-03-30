// Package transactions contains the domain logic for the transactions module.
package transactions

import "context"

// Repository defines what the domain needs from persistence.
type Repository interface {
	FindAll(ctx context.Context) ([]Transaction, error)
	FindByID(ctx context.Context, id string) (*Transaction, error)
	FindByListing(ctx context.Context, listingID string) ([]Transaction, error)
	FindByBorrower(ctx context.Context, borrowerID string) ([]Transaction, error)
}
