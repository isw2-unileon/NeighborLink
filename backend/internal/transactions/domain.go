// Package transactions contains the domain logic for the transactions module.
package transactions

import (
	"time"
)

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
	StartDate             *time.Time `json:"start_date"`
	EndDate               *time.Time `json:"end_date"`
	AgreedAt              *time.Time `json:"agreed_at"`
	HandoverAt            *time.Time `json:"handover_at"`
	ReturnAt              *time.Time `json:"return_at"`
}

// ReserveInput is the body for POST /api/listings/:id/reserve.
type ReserveInput struct {
	StartDate       string `json:"start_date"        binding:"required"`
	EndDate         string `json:"end_date"          binding:"required"`
	PaymentMethodID string `json:"payment_method_id" binding:"required"`
}

// DateRange represents a blocked date range for availability checks.
type DateRange struct {
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

// NewDateRange creates a DateRange from two *time.Time pointers, formatting as "YYYY-MM-DD".
func NewDateRange(start, end *time.Time) DateRange {
	format := func(t *time.Time) string {
		if t == nil {
			return ""
		}
		return t.Format("2006-01-02")
	}
	return DateRange{
		StartDate: format(start),
		EndDate:   format(end),
	}
}

// BorrowerTransaction enriches a Transaction with listing display data
// for the borrower's "My Reservations" view.
type BorrowerTransaction struct {
	Transaction
	ListingTitle string `json:"listing_title"`
	ListingPhoto string `json:"listing_photo"`
}
