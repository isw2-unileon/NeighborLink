// Package messages contains the domain logic for the messages module.
package messages

import "context"

// Repository defines what the domain needs from persistence.
type Repository interface {
	FindByTransaction(ctx context.Context, transactionID string) ([]Message, error)
	FindByID(ctx context.Context, id string) (*Message, error)
	Create(ctx context.Context, m Message) (*Message, error)
	FindActiveByParticipant(ctx context.Context, userID string) ([]Message, error)
	MarkAsRead(ctx context.Context, userID, transactionID string) error
	CountUnread(ctx context.Context, userID string) (int, error)
}
