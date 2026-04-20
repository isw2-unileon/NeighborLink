// Package transactions contains the domain logic for the transactions module.
package transactions

import "time"

// Transaction represents a loan agreement between an owner and a borrower.
// Pure business data — zero external dependencies.
type Transaction struct {
	ID                    string     `json:"id"`
	ListingID             string     `json:"listing_id"`
	BorrowerID            string     `json:"borrower_id"`
	Status                string     `json:"status"`
	StripePaymentIntentID string     `json:"stripe_payment_intent_id,omitempty"`
	PaymentMethodID       string     `json:"payment_method_id,omitempty"`
	AgreedAt              *time.Time `json:"agreed_at"`
	HandoverAt            *time.Time `json:"handover_at"`
	ReturnAt              *time.Time `json:"return_at"`
}
