// Package messages contains the domain logic for the messages module.
package messages

import "context"

// Repository defines what the domain needs from persistence.
type Repository interface {
	FindByTransaction(ctx context.Context, transactionID string) ([]Message, error)
	FindByID(ctx context.Context, id string) (*Message, error)
}
