package messages

import "context"

type TransactionSummary struct {
	ID         string
	BorrowerID string
	Status     string
	ListingID  string
}

type TransactionReader interface {
	FindByID(ctx context.Context, id string) (*TransactionSummary, error)
	UpdateStatus(ctx context.Context, id string, status string) error
}
