package transactions

import (
	"context"
	"fmt"
)

type stripeDepositor interface {
	AuthorizeDeposit(amountCents int64, currency, paymentMethodID string) (string, error)
	CaptureDeposit(paymentIntentID string) error
	ReleaseDeposit(paymentIntentID string, totalAmountCents int64) error
}

type listingStatusUpdater interface {
	UpdateStatus(ctx context.Context, id string, status string) error
}

type Service struct {
	repo       Repository
	stripe     stripeDepositor
	listingSvc listingStatusUpdater
}

func NewService(repo Repository, stripe stripeDepositor, listingSvc listingStatusUpdater) *Service {
	return &Service{repo: repo, stripe: stripe, listingSvc: listingSvc}
}

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

// isDevPaymentIntent returns true for fake payment intents used in local development.
func isDevPaymentIntent(id string) bool {
	return id == "" || id == "pi_test_fake_for_dev"
}

// Handover captures the authorized deposit, marks the transaction as handed_over
// and updates the listing status to pending_return.
func (s *Service) Handover(ctx context.Context, transactionID string) error {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil || t.Status != "agreed" {
		return fmt.Errorf("service: transaction %s must be in agreed status to hand over", transactionID)
	}

	if !isDevPaymentIntent(t.StripePaymentIntentID) {
		if err := s.stripe.CaptureDeposit(t.StripePaymentIntentID); err != nil {
			return fmt.Errorf("service: capture deposit: %w", err)
		}
	}

	if err := s.repo.UpdateStatus(ctx, transactionID, "handed_over"); err != nil {
		return fmt.Errorf("service: update status: %w", err)
	}

	if err := s.listingSvc.UpdateStatus(ctx, t.ListingID, "pending_return"); err != nil { // ← cambiado
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

	if !isDevPaymentIntent(t.StripePaymentIntentID) {
		if err := s.stripe.ReleaseDeposit(t.StripePaymentIntentID, depositAmountCents); err != nil {
			return fmt.Errorf("service: release deposit: %w", err)
		}
	}

	if err := s.repo.UpdateStatus(ctx, transactionID, "returned"); err != nil {
		return fmt.Errorf("service: update status: %w", err)
	}

	if err := s.listingSvc.UpdateStatus(ctx, t.ListingID, "available"); err != nil { // ← ya estaba bien
		return fmt.Errorf("service: update listing status: %w", err)
	}
	return nil
}
