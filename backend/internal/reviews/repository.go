// Package reviews contains the domain logic for the reviews module.
package reviews

import "context"

// Repository defines what the domain needs from persistence.
type Repository interface {
	FindByTransaction(ctx context.Context, transactionID string) ([]Review, error)
	FindByReviewed(ctx context.Context, reviewedID string) ([]Review, error)
	FindByID(ctx context.Context, id string) (*Review, error)
}
