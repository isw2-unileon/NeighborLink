package adapters

import (
	"context"

	"github.com/isw2-unileon/neighborlink/backend/internal/messages"
	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
)

// TxReaderAdapter adapts the transactions.Repository to satisfy the messages.TransactionReader interface.
type TxReaderAdapter struct {
	repo transactions.Repository
}

// NewTxReaderAdapter creates a new TxReaderAdapter.
func NewTxReaderAdapter(repo transactions.Repository) messages.TransactionReader {
	return &TxReaderAdapter{repo: repo}
}

// FindByID retrieves a TransactionSummary by its ID, including the owner and borrower IDs.
func (a *TxReaderAdapter) FindByID(ctx context.Context, id string) (*messages.TransactionSummary, error) {
	t, err := a.repo.FindByID(ctx, id)
	if err != nil || t == nil {
		return nil, err
	}
	ownerID, err := a.repo.FindListingOwnerByTransactionID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &messages.TransactionSummary{
		BorrowerID: t.BorrowerID,
		OwnerID:    ownerID,
		Status:     t.Status,
	}, nil
}
