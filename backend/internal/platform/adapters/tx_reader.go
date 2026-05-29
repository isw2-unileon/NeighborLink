package adapters

import (
	"context"

	"github.com/isw2-unileon/neighborlink/backend/internal/messages"
	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
)

type TxReaderAdapter struct {
	repo transactions.Repository
}

func NewTxReaderAdapter(repo transactions.Repository) messages.TransactionReader {
	return &TxReaderAdapter{repo: repo}
}

func (a *TxReaderAdapter) FindByID(ctx context.Context, id string) (*messages.TransactionSummary, error) {
	tx, err := a.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if tx == nil {
		return nil, nil
	}

	return &messages.TransactionSummary{
		ID:         tx.ID,
		BorrowerID: tx.BorrowerID,
		Status:     tx.Status,
		ListingID:  tx.ListingID,
	}, nil
}

func (a *TxReaderAdapter) UpdateStatus(ctx context.Context, id string, status string) error {
	return a.repo.UpdateStatus(ctx, id, status)
}
