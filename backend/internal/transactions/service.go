package transactions

import (
	"context"
	"fmt"
	"time"
)

type stripeDepositor interface {
	AuthorizeDeposit(amountCents int64, currency, paymentMethodID string) (string, error)
	CaptureDeposit(paymentIntentID string) error
	ReleaseDeposit(paymentIntentID string, refundAmountCents int64) error
}

type listingStatusUpdater interface {
	UpdateStatus(ctx context.Context, id string, status string) error
}

// Service holds the business logic for the transactions domain.
type Service struct {
	repo       Repository
	stripe     stripeDepositor
	listingSvc listingStatusUpdater
}

// NewService creates a new Service instance with the required dependencies.
func NewService(repo Repository, stripe stripeDepositor, listingSvc listingStatusUpdater) *Service {
	return &Service{repo: repo, stripe: stripe, listingSvc: listingSvc}
}

// AcceptRequest marca la transacción como awaiting_payment.
// El owner acepta la solicitud pero el borrower aún no ha pagado.
func (s *Service) AcceptRequest(ctx context.Context, transactionID string) error {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil || t.Status != "pending" {
		return fmt.Errorf("service: transaction %s must be in pending status to accept", transactionID)
	}
	return s.repo.UpdateStatus(ctx, transactionID, "awaiting_payment")
}

// ConfirmPayment autoriza el depósito en Stripe y mueve la transacción a agreed.
// Solo puede llamarlo el borrower cuando status = awaiting_payment.
func (s *Service) ConfirmPayment(ctx context.Context, transactionID string, depositAmountCents int64, paymentMethodID string) error {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil || t.Status != "awaiting_payment" {
		return fmt.Errorf("service: transaction %s must be in awaiting_payment status to pay", transactionID)
	}

	totalCents := depositAmountCents + PlatformFeeCents
	actualPaymentMethodID := paymentMethodID
	if actualPaymentMethodID == "" {
		actualPaymentMethodID = t.PaymentMethodID
	}

	if actualPaymentMethodID == "" {
		return fmt.Errorf("service: payment method ID is required")
	}

	stripePIID, err := s.stripe.AuthorizeDeposit(totalCents, "eur", actualPaymentMethodID)
	if err != nil {
		return fmt.Errorf("service: authorize deposit: %w", err)
	}

	if err := s.repo.UpdatePaymentIntent(ctx, transactionID, stripePIID, actualPaymentMethodID, totalCents); err != nil {
		return fmt.Errorf("service: update payment intent: %w", err)
	}

	if err := s.listingSvc.UpdateStatus(ctx, t.ListingID, "pending_handover"); err != nil {
		return fmt.Errorf("service: update listing status: %w", err)
	}

	return nil
}

// Reject cancels a pending transaction and updates its status to cancelled.
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

// calcDaysBorrowed returns the number of calendar days between handoverAt and returnAt,
// clamped to [1, 7] as per the loan policy.
func calcDaysBorrowed(handoverAt, returnAt time.Time) int {
	handoverDay := handoverAt.UTC().Truncate(24 * time.Hour)
	returnDay := returnAt.UTC().Truncate(24 * time.Hour)
	days := int(returnDay.Sub(handoverDay).Hours() / 24)
	if days < 1 {
		return 1
	}
	if days > 7 {
		return 7
	}
	return days
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

	if err := s.listingSvc.UpdateStatus(ctx, t.ListingID, "pending_return"); err != nil {
		return fmt.Errorf("service: update listing status: %w", err)
	}
	return nil
}

// Return refunds a variable percentage of the deposit to the borrower based on days borrowed,
// marks the transaction as returned, and updates the listing status back to available.
// Returns the number of days borrowed so the caller can compute the lender's points.
func (s *Service) Return(ctx context.Context, transactionID string, depositAmountCents int64) (int, error) {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return 0, fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil || t.Status != "handed_over" {
		return 0, fmt.Errorf("service: transaction %s must be in handed_over status to return", transactionID)
	}

	daysBorrowed := calcDaysBorrowed(*t.HandoverAt, time.Now())
	refundAmountCents := depositAmountCents * int64(96-daysBorrowed) / 100

	// Stripe requires at least 1 cent for refunds.
	if refundAmountCents < 1 {
		refundAmountCents = 1
	}

	if !isDevPaymentIntent(t.StripePaymentIntentID) {
		if err := s.stripe.ReleaseDeposit(t.StripePaymentIntentID, refundAmountCents); err != nil {
			return 0, fmt.Errorf("service: release deposit: %w", err)
		}
	}

	if err := s.repo.UpdateStatus(ctx, transactionID, "returned"); err != nil {
		return 0, fmt.Errorf("service: update status: %w", err)
	}

	if err := s.listingSvc.UpdateStatus(ctx, t.ListingID, "available"); err != nil {
		return 0, fmt.Errorf("service: update listing status: %w", err)
	}
	return daysBorrowed, nil
}
