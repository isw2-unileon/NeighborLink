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

func (f *fakeStripe) CaptureDeposit(_ string) error  { return nil }
func (f *fakeStripe) ReleaseDeposit(_ string, _ int64) error { return nil }

func TestAgreeDeal_ChargesDepositPlusPlatformFee(t *testing.T) {
	fs := &fakeStripe{}
	svc := transactions.NewService(&fakeRepository{}, fs)

	_, err := svc.AgreeDeal(context.Background(), "listing-1", "user-1", "pm_test", 500)

	assert.NoError(t, err)
	assert.Equal(t, int64(700), fs.capturedAmount) // 500 deposit + 200 platform fee
}