package transactions

import (
	"context"
	"fmt"
)

// stripeDepositor is the subset of stripe.Client used by the service.
// Declared here so the service can be tested without a real Stripe key.
type stripeDepositor interface {
	AuthorizeDeposit(amountCents int64, currency, paymentMethodID string) (string, error)
	CaptureDeposit(paymentIntentID string) error
	ReleaseDeposit(paymentIntentID string, totalAmountCents int64) error
}

// listingStatusUpdater is a narrow interface to update a listing's status
// without coupling the transactions package to the listings package.
type listingStatusUpdater interface {
	UpdateStatus(ctx context.Context, id string, status string) error
}

// Service orchestrates the deposit lifecycle, combining the transaction
// repository with the Stripe client. Handlers must never call Stripe directly.
type Service struct {
	repo       Repository
	stripe     stripeDepositor
	listingSvc listingStatusUpdater
}

// NewService creates a Service with the given repository, Stripe client and listing updater.
func NewService(repo Repository, stripe stripeDepositor, listingSvc listingStatusUpdater) *Service {
	return &Service{repo: repo, stripe: stripe, listingSvc: listingSvc}
}

// Accept authorizes the deposit on Stripe for a pending transaction and marks it as agreed.
func (s *Service) Accept(ctx context.Context, transactionID string, depositAmountCents int64) error {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil || t.Status != "pending" {
		return fmt.Errorf("service: transaction %s must be in pending status to accept", transactionID)
	}

	totalCents := depositAmountCents + PlatformFeeCents
	paymentIntentID, err := s.stripe.AuthorizeDeposit(totalCents, "eur", t.PaymentMethodID)
	if err != nil {
		return fmt.Errorf("service: authorize deposit: %w", err)
	}

	if err := s.repo.UpdatePaymentIntent(ctx, transactionID, paymentIntentID, t.PaymentMethodID, totalCents); err != nil {
		return fmt.Errorf("service: update payment intent: %w", err)
	}
	return nil
}

// Reject cancels a pending transaction without any payment action.
func (s *Service) Reject(ctx context.Context, transactionID string) error {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil || t.Status != "pending" {
		return fmt.Errorf("service: transaction %s must be in pending status to reject", transactionID)
	}

	if err := s.repo.UpdateStatus(ctx, transactionID, "cancelled"); err != nil {
		return fmt.Errorf("service: update status: %w", err)
	}
	return nil
}

// Handover captures the authorized deposit, marks the transaction as handed_over
// and updates the listing status to borrowed.
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

	if err := s.listingSvc.UpdateStatus(ctx, t.ListingID, "borrowed"); err != nil {
		return fmt.Errorf("service: update listing status: %w", err)
	}
	return nil
}

// Return refunds 95% of the deposit to the borrower, marks the transaction as returned
// and updates the listing status back to available.
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

	if err := s.listingSvc.UpdateStatus(ctx, t.ListingID, "available"); err != nil {
		return fmt.Errorf("service: update listing status: %w", err)
	}
	return nil
}
