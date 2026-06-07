package transactions_test

import (
	"context"
	"testing"
	"time"

	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
	"github.com/stretchr/testify/assert"
)

func TestHandover_CapturesDeposit(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "agreed", StripePaymentIntentID: "pi_real", ListingID: "lst-1"},
		},
	}
	fs := &fakeStripe{}
	lsvc := &fakeListingSvc{}
	svc := transactions.NewService(repo, fs, lsvc, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

	err := svc.Handover(context.Background(), "tx-1")

	assert.NoError(t, err)
	assert.True(t, fs.captureCalled)
	assert.Equal(t, "handed_over", repo.transactions[0].Status)
	assert.Equal(t, "lst-1", lsvc.updatedListingID)
	assert.Equal(t, "pending_return", lsvc.updatedStatus)
}

func TestHandover_FailsIfNotAgreed(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "returned"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

	err := svc.Handover(context.Background(), "tx-1")

	assert.Error(t, err)
}

func TestHandover_SkipsStripeForDevPaymentIntent(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "agreed", StripePaymentIntentID: "", ListingID: "lst-1"},
		},
	}
	lsvc := &fakeListingSvc{}
	svc := transactions.NewService(repo, nil, lsvc, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

	err := svc.Handover(context.Background(), "tx-1")

	assert.NoError(t, err)
	assert.Equal(t, "handed_over", repo.transactions[0].Status)
	assert.Equal(t, "lst-1", lsvc.updatedListingID)
	assert.Equal(t, "pending_return", lsvc.updatedStatus)
}

// --- AcceptRequest ---

func TestAcceptRequest_SetsAwaitingPayment(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "pending", PaymentMethodID: "pm_test"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

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
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

	err := svc.AcceptRequest(context.Background(), "tx-1")

	assert.Error(t, err)
}

// --- ConfirmPayment ---

func TestConfirmPayment_ChargesDepositPlusPlatformFee(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "awaiting_payment", PaymentMethodID: "pm_test", ListingID: "lst-1"},
		},
	}
	fs := &fakeStripe{}
	lsvc := &fakeListingSvc{}
	svc := transactions.NewService(repo, fs, lsvc, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

	_, err := svc.ConfirmPayment(context.Background(), "tx-1", 500, "pm_new")

	assert.NoError(t, err)
	assert.Equal(t, int64(700), fs.capturedAmount) // 500 deposit + 200 platform fee
	assert.Equal(t, "lst-1", lsvc.updatedListingID)
	assert.Equal(t, "pending_handover", lsvc.updatedStatus)
}

func TestConfirmPayment_FailsIfNotAwaitingPayment(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "pending", PaymentMethodID: "pm_test"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

	cs, err := svc.ConfirmPayment(context.Background(), "tx-1", 500, "pm_new")

	assert.Error(t, err)
	assert.Empty(t, cs)
}

func TestConfirmPayment_ReturnsClientSecret(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "awaiting_payment", PaymentMethodID: "pm_test", ListingID: "lst-1"},
		},
	}
	fs := &fakeStripe{clientSecret: "pi_secret_xyz_secret"}
	svc := transactions.NewService(repo, fs, &fakeListingSvc{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

	cs, err := svc.ConfirmPayment(context.Background(), "tx-1", 500, "pm_new")

	assert.NoError(t, err)
	assert.Equal(t, "pi_secret_xyz_secret", cs)
}

// --- Reject ---

func TestReject_SetsCancelledStatus(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "pending"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

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
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

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
			handoverAt := time.Now().UTC()
			startDate := time.Now().UTC().AddDate(0, 0, -tc.days)
			endDate := time.Now().UTC()
			repo := &fakeRepository{
				transactions: []transactions.Transaction{
					{
						ID:                    "tx-1",
						Status:                "handed_over",
						StripePaymentIntentID: "pi_fake",
						ListingID:             "lst-1",
						HandoverAt:            &handoverAt,
						StartDate:             &startDate,
						EndDate:               &endDate,
					},
				},
			}
			fs := &fakeStripe{}
			lsvc := &fakeListingSvc{}
			svc := transactions.NewService(repo, fs, lsvc, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

			daysBorrowed, err := svc.Return(context.Background(), "tx-1", tc.deposit)

			assert.NoError(t, err)
			assert.Equal(t, tc.wantDayReturned, daysBorrowed)
			assert.Equal(t, tc.wantRefund, fs.releasedAmount)
			assert.Equal(t, "lst-1", lsvc.updatedListingID)
			assert.Equal(t, "available", lsvc.updatedStatus)
		})
	}
}

func TestReturn_PlatformFeeNotRefunded(t *testing.T) {
	deposit := int64(10000)
	handoverAt := time.Now().UTC()
	startDate := time.Now().UTC().AddDate(0, 0, -1)
	endDate := time.Now().UTC()
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{
				ID:                    "tx-1",
				Status:                "handed_over",
				StripePaymentIntentID: "pi_fake",
				ListingID:             "lst-1",
				HandoverAt:            &handoverAt,
				StartDate:             &startDate,
				EndDate:               &endDate,
			},
		},
	}
	fs := &fakeStripe{}
	lsvc := &fakeListingSvc{}
	svc := transactions.NewService(repo, fs, lsvc, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

	_, err := svc.Return(context.Background(), "tx-1", deposit)

	assert.NoError(t, err)
	assert.Less(t, fs.releasedAmount, deposit)
	assert.Equal(t, "lst-1", lsvc.updatedListingID)
	assert.Equal(t, "available", lsvc.updatedStatus)
}

func TestReturn_DaysClamped(t *testing.T) {
	t.Run("same-day return clamps to 1", func(t *testing.T) {
		handoverAt := time.Now().UTC()
		startDate := time.Now().UTC()
		endDate := time.Now().UTC()
		repo := &fakeRepository{
			transactions: []transactions.Transaction{
				{
					ID:                    "tx-1",
					Status:                "handed_over",
					StripePaymentIntentID: "pi_fake",
					ListingID:             "lst-1",
					HandoverAt:            &handoverAt,
					StartDate:             &startDate,
					EndDate:               &endDate,
				},
			},
		}
		fs := &fakeStripe{}
		lsvc := &fakeListingSvc{}
		svc := transactions.NewService(repo, fs, lsvc, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

		daysBorrowed, err := svc.Return(context.Background(), "tx-1", 10000)

		assert.NoError(t, err)
		assert.Equal(t, 1, daysBorrowed)
		assert.Equal(t, "lst-1", lsvc.updatedListingID)
		assert.Equal(t, "available", lsvc.updatedStatus)
	})

	t.Run("over-7-day return clamps to 7", func(t *testing.T) {
		handoverAt := time.Now().UTC()
		startDate := time.Now().UTC().AddDate(0, 0, -10)
		endDate := time.Now().UTC()
		repo := &fakeRepository{
			transactions: []transactions.Transaction{
				{
					ID:                    "tx-1",
					Status:                "handed_over",
					StripePaymentIntentID: "pi_fake",
					ListingID:             "lst-1",
					HandoverAt:            &handoverAt,
					StartDate:             &startDate,
					EndDate:               &endDate,
				},
			},
		}
		fs := &fakeStripe{}
		lsvc := &fakeListingSvc{}
		svc := transactions.NewService(repo, fs, lsvc, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

		daysBorrowed, err := svc.Return(context.Background(), "tx-1", 10000)

		assert.NoError(t, err)
		assert.Equal(t, 7, daysBorrowed)
		assert.Equal(t, "lst-1", lsvc.updatedListingID)
		assert.Equal(t, "available", lsvc.updatedStatus)
	})
}

func TestReturn_FailsIfNotHandedOver(t *testing.T) {
	repo := &fakeRepository{
		transactions: []transactions.Transaction{
			{ID: "tx-1", Status: "agreed"},
		},
	}
	svc := transactions.NewService(repo, &fakeStripe{}, &fakeListingSvc{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})

	_, err := svc.Return(context.Background(), "tx-1", 10000)

	assert.Error(t, err)
}
