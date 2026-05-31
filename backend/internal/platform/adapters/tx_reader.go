package adapters

import (
	"context"

	"github.com/isw2-unileon/neighborlink/backend/internal/messages"
	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
)

// TxReaderAdapter adapts the transactions.Repository to the messages.TransactionReader interface, allowing the messages module to read transaction summaries without depending directly on the transactions module.
type TxReaderAdapter struct {
	repo transactions.Repository
}

// NewTxReaderAdapter creates a new TxReaderAdapter that implements the messages.TransactionReader interface using a transactions.Repository.
func NewTxReaderAdapter(repo transactions.Repository) messages.TransactionReader {
	return &TxReaderAdapter{repo: repo}
}

// FindByID retrieves a transaction by its ID using the underlying transactions.Repository and converts it to a messages.TransactionSummary. It returns nil if the transaction is not found.
func (a *TxReaderAdapter) FindByID(ctx context.Context, id string) (*messages.TransactionSummary, error) {
	tx, err := a.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if tx == nil {
		return nil, nil
	}
	OwnerID, _ := a.repo.FindListingOwnerByTransactionID(ctx, id)
	return &messages.TransactionSummary{
		ID:         tx.ID,
		BorrowerID: tx.BorrowerID,
		OwnerID:    OwnerID,
		Status:     tx.Status,
		ListingID:  tx.ListingID,
	}, nil
}

// UpdateStatus updates the status of a transaction using the underlying transactions.Repository. It returns an error if the update operation fails.
func (a *TxReaderAdapter) UpdateStatus(ctx context.Context, id string, status string) error {
	return a.repo.UpdateStatus(ctx, id, status)
}
