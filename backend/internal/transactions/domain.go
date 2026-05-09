// Package transactions contains the domain logic for the transactions module.
package transactions

import "time"

// PlatformFeeCents is the fixed management + insurance fee charged to the borrower on top of the deposit.
const PlatformFeeCents int64 = 200

// Transaction represents a loan agreement between an owner and a borrower.
// Pure business data — zero external dependencies.
type Transaction struct {
	ID                    string     `json:"id"`
	ListingID             string     `json:"listing_id"`
	BorrowerID            string     `json:"borrower_id"`
	Status                string     `json:"status"`
	StripePaymentIntentID string     `json:"stripe_payment_intent_id,omitempty"`
	PaymentMethodID       string     `json:"payment_method_id,omitempty"`
	TotalChargedCents     int64      `json:"total_charged_cents,omitempty"`
	AgreedAt              *time.Time `json:"agreed_at"`
	HandoverAt            *time.Time `json:"handover_at"`
	ReturnAt              *time.Time `json:"return_at"`
}
