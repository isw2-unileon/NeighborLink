package transactions_test

import (
	"context"
	"testing"
	"time"

	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
	"github.com/stretchr/testify/assert"
)

type fakeStripe struct {
	capturedAmount int64
	releasedAmount int64
	releasedDays   int
}

func (f *fakeStripe) AuthorizeDeposit(amountCents int64, currency, paymentMethodID string) (string, error) {
	f.capturedAmount = amountCents
	return "pi_fake", nil
}

func (f *fakeStripe) CaptureDeposit(_ string) error { return nil }
func (f *fakeStripe) ReleaseDeposit(_ string, amount int64, days int) error {
	f.releasedAmount = amount
	f.releasedDays = days
	return nil
}

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

// --- Return ---

func TestReturn_VariableRefundByDays(t *testing.T) {
	cases := []struct {
		days            int
		deposit         int64
		wantRefund      int64
		wantDayReturned int
	}{
		{days: 1, deposit: 10000, wantRefund: 9500, wantDayReturned: 1}, // 95%
		{days: 2, deposit: 10000, wantRefund: 9400, wantDayReturned: 2}, // 94%
		{days: 3, deposit: 10000, wantRefund: 9300, wantDayReturned: 3}, // 93%
		{days: 4, deposit: 10000, wantRefund: 9200, wantDayReturned: 4}, // 92%
		{days: 5, deposit: 10000, wantRefund: 9100, wantDayReturned: 5}, // 91%
		{days: 6, deposit: 10000, wantRefund: 9000, wantDayReturned: 6}, // 90%
		{days: 7, deposit: 10000, wantRefund: 8900, wantDayReturned: 7}, // 89%
	}

	for _, tc := range cases {
		t.Run("", func(t *testing.T) {
			handoverAt := time.Now().UTC().AddDate(0, 0, -tc.days)
			repo := &fakeRepository{
				transactions: []transactions.Transaction{
					{
						ID:                    "tx-1",
						Status:                "handed_over",
						StripePaymentIntentID: "pi_fake",
						ListingID:             "lst-1",
						HandoverAt:            &handoverAt,
					},
				},
			}
			fs := &fakeStripe{}
			svc := transactions.NewService(repo, fs, &fakeListingSvc{})

			daysBorrowed, err := svc.Return(context.Background(), "tx-1", tc.deposit)

			assert.NoError(t, err)
			assert.Equal(t, tc.wantDayReturned, daysBorrowed)
			assert.Equal(t, tc.wantRefund, fs.releasedAmount)
			assert.Equal(t, tc.days, fs.releasedDays)
		})
	}
}

func TestReturn_PlatformFeeNotRefunded(t *testing.T) {
	// deposit is 10000; total charged would be 10200 (deposit + €2 fee).
	// Only the deposit (not the fee) should be passed to ReleaseDeposit.
	deposit := int64(10000)
	handoverAt := time.Now().UTC().AddDate(0, 0, -1)
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{
				ID:                    "tx-1",
				Status:                "handed_over",
				StripePaymentIntentID: "pi_fake",
				ListingID:             "lst-1",
				HandoverAt:            &handoverAt,
			},
		},
	}
	fs := &fakeStripe{}
	svc := transactions.NewService(repo, fs, &fakeListingSvc{})

	_, err := svc.Return(context.Background(), "tx-1", deposit)

	assert.NoError(t, err)
	// refundAmount must be strictly less than the deposit (fee not refunded, and lender keeps a share)
	assert.Less(t, fs.releasedAmount, deposit)
}

func TestReturn_DaysClamped(t *testing.T) {
	t.Run("same-day return clamps to 1", func(t *testing.T) {
		handoverAt := time.Now().UTC() // same day
		repo := &fakeRepository{
			transactions: []transactions.Transaction{
				{
					ID:                    "tx-1",
					Status:                "handed_over",
					StripePaymentIntentID: "pi_fake",
					ListingID:             "lst-1",
					HandoverAt:            &handoverAt,
				},
			},
		}
		fs := &fakeStripe{}
		svc := transactions.NewService(repo, fs, &fakeListingSvc{})

		daysBorrowed, err := svc.Return(context.Background(), "tx-1", 10000)

		assert.NoError(t, err)
		assert.Equal(t, 1, daysBorrowed)
	})

	t.Run("over-7-day return clamps to 7", func(t *testing.T) {
		handoverAt := time.Now().UTC().AddDate(0, 0, -10)
		repo := &fakeRepository{
			transactions: []transactions.Transaction{
				{
					ID:                    "tx-1",
					Status:                "handed_over",
					StripePaymentIntentID: "pi_fake",
					ListingID:             "lst-1",
					HandoverAt:            &handoverAt,
				},
			},
		}
		fs := &fakeStripe{}
		svc := transactions.NewService(repo, fs, &fakeListingSvc{})

		daysBorrowed, err := svc.Return(context.Background(), "tx-1", 10000)

		assert.NoError(t, err)
		assert.Equal(t, 7, daysBorrowed)
	})
}

func TestReturn_FailsIfNotHandedOver(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "agreed"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{})

	_, err := svc.Return(context.Background(), "tx-1", 10000)

	assert.Error(t, err)
}
