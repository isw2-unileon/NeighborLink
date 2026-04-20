// Package stripe provides a wrapper around the Stripe SDK for deposit management.
package stripe

import (
	"fmt"

	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/paymentintent"
	"github.com/stripe/stripe-go/v76/refund"
)

// Client wraps the Stripe SDK and exposes only the operations needed
// for the deposit lifecycle: authorize, capture and release.
type Client struct{}

// NewClient initialises the Stripe SDK with the provided secret key
// and returns a ready-to-use Client.
// Call this once at application startup (in main.go).
func NewClient(secretKey string) *Client {
	stripe.Key = secretKey
	return &Client{}
}

// AuthorizeDeposit creates a PaymentIntent with manual capture.
// This reserves the deposit amount on the borrower's card without charging it yet.
// amountCents is the deposit amount in the smallest currency unit (e.g. cents for EUR).
// paymentMethodID is the Stripe payment method ID (pm_...) provided by the borrower.
// Returns the PaymentIntent ID (pi_...) that must be stored in the transactions table.
func (c *Client) AuthorizeDeposit(amountCents int64, currency string, paymentMethodID string) (string, error) {
	params := &stripe.PaymentIntentParams{
		Amount:        stripe.Int64(amountCents),
		Currency:      stripe.String(currency),
		PaymentMethod: stripe.String(paymentMethodID),
		CaptureMethod: stripe.String(string(stripe.PaymentIntentCaptureMethodManual)),
		ConfirmationMethod: stripe.String(string(stripe.PaymentIntentConfirmationMethodAutomatic)),
		Confirm: stripe.Bool(true),
	}

	pi, err := paymentintent.New(params)
	if err != nil {
		return "", fmt.Errorf("stripe: failed to authorize deposit: %w", err)
	}

	return pi.ID, nil
}

// CaptureDeposit captures a previously authorized PaymentIntent in full.
// Call this when the handover QR is scanned successfully.
// paymentIntentID is the pi_... value stored in the transactions table.
func (c *Client) CaptureDeposit(paymentIntentID string) error {
	_, err := paymentintent.Capture(paymentIntentID, nil)
	if err != nil {
		return fmt.Errorf("stripe: failed to capture deposit: %w", err)
	}
	return nil
}

// ReleaseDeposit refunds 95% of the captured amount to the borrower.
// The remaining 5% stays as platform income (to be distributed to the lender separately).
// Call this when the return QR is scanned successfully.
// paymentIntentID is the pi_... value stored in the transactions table.
// totalAmountCents is the original deposit amount in the smallest currency unit.
func (c *Client) ReleaseDeposit(paymentIntentID string, totalAmountCents int64) error {
	refundAmount := totalAmountCents * 95 / 100

	params := &stripe.RefundParams{
		PaymentIntent: stripe.String(paymentIntentID),
		Amount:        stripe.Int64(refundAmount),
	}

	_, err := refund.New(params)
	if err != nil {
		return fmt.Errorf("stripe: failed to release deposit: %w", err)
	}

	return nil
}
