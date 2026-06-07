package messages

import "context"

// TransactionSummary represents a simplified view of a transaction, used for enriching messages with transaction details.
type TransactionSummary struct {
	ID         string
	BorrowerID string
	OwnerID    string
	Status     string
	ListingID  string
}

// TransactionReader defines the interface for reading transaction summaries, used by the messages module to enrich messages with transaction details.
type TransactionReader interface {
	FindByID(ctx context.Context, id string) (*TransactionSummary, error)
	UpdateStatus(ctx context.Context, id string, status string) error
	FindListingOwnerAndTitle(ctx context.Context, listingID string) (string, string, error)
}
