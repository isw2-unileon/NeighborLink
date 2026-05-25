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

type fakeListingSvc struct{}

func (f *fakeListingSvc) UpdateStatus(_ context.Context, _ string, _ string) error { return nil }

// --- AcceptRequest ---

func TestAcceptRequest_SetsAwaitingPayment(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "pending", PaymentMethodID: "pm_test"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{})

	err := svc.AcceptRequest(context.Background(), "tx-1")

	assert.NoError(t, err)
	assert.Equal(t, "awaiting_payment", repo.transactions[0].Status)
}

func TestAcceptRequest_FailsIfNotPending(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "agreed", PaymentMethodID: "pm_test"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{})

	err := svc.AcceptRequest(context.Background(), "tx-1")

	assert.Error(t, err)
}

// --- ConfirmPayment ---

func TestConfirmPayment_ChargesDepositPlusPlatformFee(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "awaiting_payment", PaymentMethodID: "pm_test"},
		},
	}
	fs := &fakeStripe{}
	svc := transactions.NewService(repo, fs, &fakeListingSvc{})

	err := svc.ConfirmPayment(context.Background(), "tx-1", 500)

	assert.NoError(t, err)
	assert.Equal(t, int64(700), fs.capturedAmount) // 500 deposit + 200 platform fee
}

func TestConfirmPayment_FailsIfNotAwaitingPayment(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "pending", PaymentMethodID: "pm_test"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{})

	err := svc.ConfirmPayment(context.Background(), "tx-1", 500)

	assert.Error(t, err)
}

// --- Reject ---

func TestReject_SetsCancelledStatus(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "pending"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{})

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
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{})

	err := svc.Reject(context.Background(), "tx-1")

	assert.Error(t, err)
}
