package transactions

import (
	"context"
	"fmt"

	stripeclient "github.com/isw2-unileon/neighborlink/backend/internal/platform/stripe"
)

// Service orchestrates the deposit lifecycle, combining the transaction
// repository with the Stripe client. Handlers must never call Stripe directly.
type Service struct {
	repo   Repository
	stripe *stripeclient.Client
}

// NewService creates a Service with the given repository and Stripe client.
func NewService(repo Repository, stripe *stripeclient.Client) *Service {
	return &Service{repo: repo, stripe: stripe}
}

// TODO: borrower_id is currently passed by the handler from a temporary header.
// When JWT is implemented it must be extracted from the token instead.

// AgreeDeal creates a pending transaction, authorizes the deposit on Stripe,
// and marks the transaction as agreed.
func (s *Service) AgreeDeal(ctx context.Context, listingID, borrowerID, paymentMethodID string, depositAmountCents int64) (*Transaction, error) {
	t, err := s.repo.Create(ctx, Transaction{
		ListingID:  listingID,
		BorrowerID: borrowerID,
	})
	if err != nil {
		return nil, fmt.Errorf("service: create transaction: %w", err)
	}

	paymentIntentID, err := s.stripe.AuthorizeDeposit(depositAmountCents, "eur", paymentMethodID)
	if err != nil {
		return nil, fmt.Errorf("service: authorize deposit: %w", err)
	}

	if err := s.repo.UpdatePaymentIntent(ctx, t.ID, paymentIntentID, paymentMethodID); err != nil {
		return nil, fmt.Errorf("service: update payment intent: %w", err)
	}

	t.StripePaymentIntentID = paymentIntentID
	t.PaymentMethodID = paymentMethodID
	t.Status = "agreed"
	return t, nil
}

// Handover captures the authorized deposit and marks the transaction as handed_over.
// The transaction must be in agreed status.
func (s *Service) Handover(ctx context.Context, transactionID string) error {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil || t.Status != "agreed" {
		return fmt.Errorf("service: transaction %s must be in agreed status to hand over", transactionID)
	}

	if err := s.stripe.CaptureDeposit(t.StripePaymentIntentID); err != nil {
		return fmt.Errorf("service: capture deposit: %w", err)
	}

	if err := s.repo.UpdateStatus(ctx, transactionID, "handed_over"); err != nil {
		return fmt.Errorf("service: update status: %w", err)
	}
	return nil
}

// Return refunds 95% of the deposit to the borrower and marks the transaction as returned.
// The transaction must be in handed_over status.
// depositAmountCents is the original deposit amount obtained externally from the listing.
func (s *Service) Return(ctx context.Context, transactionID string, depositAmountCents int64) error {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil || t.Status != "handed_over" {
		return fmt.Errorf("service: transaction %s must be in handed_over status to return", transactionID)
	}

	if err := s.stripe.ReleaseDeposit(t.StripePaymentIntentID, depositAmountCents); err != nil {
		return fmt.Errorf("service: release deposit: %w", err)
	}

	if err := s.repo.UpdateStatus(ctx, transactionID, "returned"); err != nil {
		return fmt.Errorf("service: update status: %w", err)
	}
	return nil
}
