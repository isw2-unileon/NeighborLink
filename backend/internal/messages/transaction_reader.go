package messages

import "context"

// TransactionReader is the minimal interface the messages handler needs
// to verify that a sender is a participant of a transaction.
type TransactionReader interface {
	FindByID(ctx context.Context, id string) (*TransactionSummary, error)
}

// TransactionSummary contains only the fields messages needs from a transaction.
type TransactionSummary struct {
	BorrowerID string
	OwnerID    string
	Status     string
}
