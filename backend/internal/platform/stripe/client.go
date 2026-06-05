// Package stripe provides a wrapper around the Stripe SDK for deposit management.
package stripe

import (
	"fmt"

	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/paymentintent"
	"github.com/stripe/stripe-go/v76/payout"
	"github.com/stripe/stripe-go/v76/refund"
	"github.com/stripe/stripe-go/v76/transfer"
	"github.com/stripe/stripe-go/v76/webhook"
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
// Returns the PaymentIntent ID (pi_...) and client_secret needed by the frontend for 3DS.
func (c *Client) AuthorizeDeposit(amountCents int64, currency string, paymentMethodID string) (piID string, clientSecret string, err error) {
	params := &stripe.PaymentIntentParams{
		Amount:        stripe.Int64(amountCents),
		Currency:      stripe.String(currency),
		PaymentMethod: stripe.String(paymentMethodID),
		CaptureMethod: stripe.String(string(stripe.PaymentIntentCaptureMethodManual)),
		Confirm:       stripe.Bool(true),
		AutomaticPaymentMethods: &stripe.PaymentIntentAutomaticPaymentMethodsParams{
			Enabled:        stripe.Bool(true),
			AllowRedirects: stripe.String("never"),
		},
	}

	pi, err := paymentintent.New(params)
	if err != nil {
		return "", "", fmt.Errorf("stripe: failed to authorize deposit: %w", err)
	}

	return pi.ID, pi.ClientSecret, nil
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

// ConstructEvent validates the Stripe-Signature header and parses the event payload.
// Returns an error if the signature is invalid or the secret is wrong.
func (c *Client) ConstructEvent(payload []byte, sigHeader, secret string) (stripe.Event, error) {
	event, err := webhook.ConstructEvent(payload, sigHeader, secret)
	if err != nil {
		return stripe.Event{}, fmt.Errorf("stripe: invalid webhook signature: %w", err)
	}
	return event, nil
}

// PayoutToConnectedAccount transfers amountCents from the platform Stripe account to
// the given Stripe Connect account, then initiates a payout to that account's bank.
// When accountID is "acct_mock_demo" the call is a no-op so the redemption flow works
// in demo environments before real Stripe Connect onboarding is in place.
func (c *Client) PayoutToConnectedAccount(accountID string, amountCents int64, currency string) error {
	if accountID == "acct_mock_demo" {
		return nil
	}

	_, err := transfer.New(&stripe.TransferParams{
		Amount:      stripe.Int64(amountCents),
		Currency:    stripe.String(currency),
		Destination: stripe.String(accountID),
	})
	if err != nil {
		return fmt.Errorf("stripe: transfer failed: %w", err)
	}

	params := &stripe.PayoutParams{
		Amount:   stripe.Int64(amountCents),
		Currency: stripe.String(currency),
	}
	params.SetStripeAccount(accountID)
	_, err = payout.New(params)
	if err != nil {
		return fmt.Errorf("stripe: payout failed: %w", err)
	}
	return nil
}

// ReleaseDeposit issues a partial refund of refundAmountCents to the borrower.
// The platform keeps the €2 management fee and the lender's share is credited as wallet points.
// Call this when the return QR is scanned successfully.
// paymentIntentID is the pi_... value stored in the transactions table.
// refundAmountCents is the pre-computed refund amount (calculated by the service).
func (c *Client) ReleaseDeposit(paymentIntentID string, refundAmountCents int64) error {
	refundAmount := refundAmountCents

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
