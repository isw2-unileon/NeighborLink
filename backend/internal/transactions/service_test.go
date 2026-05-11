package transactions_test

import (
	"context"
	"testing"

	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
	"github.com/stretchr/testify/assert"
)

type fakeStripe struct {
	capturedAmount int64
}

func (f *fakeStripe) AuthorizeDeposit(amountCents int64, currency, paymentMethodID string) (string, error) {
	f.capturedAmount = amountCents
	return "pi_fake", nil
}

func (f *fakeStripe) CaptureDeposit(_ string) error          { return nil }
func (f *fakeStripe) ReleaseDeposit(_ string, _ int64) error { return nil }

func TestAccept_ChargesDepositPlusPlatformFee(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "pending", PaymentMethodID: "pm_test"},
		},
	}
	fs := &fakeStripe{}
	svc := transactions.NewService(repo, fs)

	err := svc.Accept(context.Background(), "tx-1", 500)

	assert.NoError(t, err)
	assert.Equal(t, int64(700), fs.capturedAmount) // 500 deposit + 200 platform fee
}

func TestAccept_FailsIfNotPending(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "agreed", PaymentMethodID: "pm_test"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{})

	err := svc.Accept(context.Background(), "tx-1", 500)

	assert.Error(t, err)
}

func TestReject_SetsCancelledStatus(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "pending"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{})

	err := svc.Reject(context.Background(), "tx-1")

	assert.NoError(t, err)
	assert.Equal(t, "cancelled", repo.transactions[0].Status)
}

func TestReject_FailsIfNotPending(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "agreed"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{})

	err := svc.Reject(context.Background(), "tx-1")

	assert.Error(t, err)
}
