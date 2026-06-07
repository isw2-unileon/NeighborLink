package transactions

import (
	"context"
	"fmt"
	"time"
)

type stripeDepositor interface {
	AuthorizeDeposit(amountCents int64, currency, paymentMethodID string) (piID string, clientSecret string, err error)
	CaptureDeposit(paymentIntentID string) error
	ReleaseDeposit(paymentIntentID string, refundAmountCents int64) error
}

type listingStatusUpdater interface {
	UpdateStatus(ctx context.Context, id string, status string) error
}

type adminFinder interface {
	FindFirstAdmin(ctx context.Context) (string, error)
}

type messageCreator interface {
	CreateSystemMessage(ctx context.Context, transactionID, content string) error
}

type pointsAdder interface {
	AddPoints(ctx context.Context, userID string, points int) error
}

type notificationCreator interface {
	Create(ctx context.Context, userID, notifType string, payload map[string]any) error
}

// Service holds the business logic for the transactions domain.
type Service struct {
	repo       Repository
	stripe     stripeDepositor
	listingSvc listingStatusUpdater
	adminRepo  adminFinder
	msgRepo    messageCreator
	walletSvc  pointsAdder
	notifSvc   notificationCreator
}

// NewService creates a new Service instance with the required dependencies.
func NewService(repo Repository, stripe stripeDepositor, listingSvc listingStatusUpdater, adminRepo adminFinder, msgRepo messageCreator, walletSvc pointsAdder, notifSvc notificationCreator) *Service {
	return &Service{repo: repo, stripe: stripe, listingSvc: listingSvc, adminRepo: adminRepo, msgRepo: msgRepo, walletSvc: walletSvc, notifSvc: notifSvc}
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
func (s *Service) ConfirmPayment(ctx context.Context, transactionID string, depositAmountCents int64, paymentMethodID string) (string, error) {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return "", fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil || t.Status != "awaiting_payment" {
		return "", fmt.Errorf("service: transaction %s must be in awaiting_payment status to pay", transactionID)
	}

	totalCents := depositAmountCents + PlatformFeeCents
	actualPaymentMethodID := paymentMethodID
	if actualPaymentMethodID == "" {
		actualPaymentMethodID = t.PaymentMethodID
	}

	if actualPaymentMethodID == "" {
		return "", fmt.Errorf("service: payment method ID is required")
	}

	stripePIID, clientSecret, err := s.stripe.AuthorizeDeposit(totalCents, "eur", actualPaymentMethodID)
	if err != nil {
		return "", fmt.Errorf("service: authorize deposit: %w", err)
	}

	if err := s.repo.UpdatePaymentIntent(ctx, transactionID, stripePIID, actualPaymentMethodID, totalCents); err != nil {
		return "", fmt.Errorf("service: update payment intent: %w", err)
	}

	if err := s.listingSvc.UpdateStatus(ctx, t.ListingID, "pending_handover"); err != nil {
		return "", fmt.Errorf("service: update listing status: %w", err)
	}

	return clientSecret, nil
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

	effectiveStart := *t.StartDate
	if t.HandoverAt != nil && t.HandoverAt.After(effectiveStart) {
		effectiveStart = *t.HandoverAt
	}
	effectiveEnd := *t.EndDate
	if now := time.Now(); now.After(effectiveEnd) {
		effectiveEnd = now
	}
	daysBorrowed := calcDaysBorrowed(effectiveStart, effectiveEnd)
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

// ReportIssue transitions a transaction to pending_review and opens a chat with an admin.
func (s *Service) ReportIssue(ctx context.Context, transactionID string) error {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil {
		return fmt.Errorf("service: transaction %s not found", transactionID)
	}

	// We allow reporting issues only when the item has been handed over or just returned (e.g. damages found)
	if t.Status != "handed_over" && t.Status != "returned" {
		return fmt.Errorf("service: issues can only be reported for handed_over or returned transactions")
	}

	_, listingTitle, err := s.repo.FindListingOwnerAndTitle(ctx, t.ListingID)
	if err != nil {
		return fmt.Errorf("service: get listing info: %w", err)
	}

	adminID, err := s.adminRepo.FindFirstAdmin(ctx)
	if err != nil {
		return fmt.Errorf("service: find admin: %w", err)
	}
	if adminID == "" {
		return fmt.Errorf("service: no administrator found to handle the dispute")
	}

	// 1. Update status to pending_review
	if err := s.repo.UpdateStatus(ctx, transactionID, "pending_review"); err != nil {
		return fmt.Errorf("service: update status: %w", err)
	}

	// 2. Open chat with admin by sending a system message.
	// In this system, chats are implicit if a message exists.
	content := fmt.Sprintf("DISPUTA ABIERTA: El propietario de '%s' ha reportado una incidencia. Un administrador (%s) revisará el caso pronto.", listingTitle, adminID)
	if err := s.msgRepo.CreateSystemMessage(ctx, transactionID, content); err != nil {
		return fmt.Errorf("service: create dispute message: %w", err)
	}

	if s.notifSvc != nil {
		_ = s.notifSvc.Create(ctx, adminID, "dispute_created", map[string]any{
			"listing_title":  listingTitle,
			"transaction_id": transactionID,
		})
	}

	return nil
}

// ResolveDispute marks the transaction as returned and closes the case.
func (s *Service) ResolveDispute(ctx context.Context, transactionID string) error {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil {
		return fmt.Errorf("service: transaction %s not found", transactionID)
	}
	if t.Status != "pending_review" {
		return fmt.Errorf("service: transaction %s is not in pending_review status", transactionID)
	}

	if err := s.repo.UpdateStatus(ctx, transactionID, "returned"); err != nil {
		return fmt.Errorf("service: update status: %w", err)
	}

	if err := s.listingSvc.UpdateStatus(ctx, t.ListingID, "available"); err != nil {
		return fmt.Errorf("service: update listing status: %w", err)
	}

	content := "INCIDENCIA RESUELTA: Un administrador ha cerrado este caso. La transacción se marca como finalizada."
	if err := s.msgRepo.CreateSystemMessage(ctx, transactionID, content); err != nil {
		return fmt.Errorf("service: create resolution message: %w", err)
	}

	return nil
}

// RefundDisputePoints allows an admin to refund a percentage of the listing's value in points.
func (s *Service) RefundDisputePoints(ctx context.Context, transactionID string, percentage int) (int, error) {
	if percentage < 0 || percentage > 100 {
		return 0, fmt.Errorf("service: percentage must be between 0 and 100")
	}

	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return 0, fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil {
		return 0, fmt.Errorf("service: transaction %s not found", transactionID)
	}

	if t.DisputeRefundPoints != nil {
		return 0, fmt.Errorf("service: a refund has already been issued for this transaction")
	}

	// Allowed statuses for refund: pending_review or returned (if it was just resolved)
	if t.Status != "pending_review" && t.Status != "returned" {
		return 0, fmt.Errorf("service: points can only be refunded for transactions in dispute or finalized")
	}

	_, listingTitle, deposit, err := s.repo.FindListingInfoForRefund(ctx, t.ListingID)
	if err != nil {
		return 0, fmt.Errorf("service: get listing info: %w", err)
	}

	// Obtener el owner para asignarle los puntos
	ownerID, _, _, err := s.repo.FindListingInfoForRefund(ctx, t.ListingID)
	if err != nil {
		return 0, fmt.Errorf("service: get listing owner: %w", err)
	}

	points := (deposit * percentage) / 100
	if points > 0 {
		if err := s.walletSvc.AddPoints(ctx, ownerID, points); err != nil {
			return 0, fmt.Errorf("service: add points failed: %w", err)
		}
	}

	if err := s.repo.UpdateDisputeRefund(ctx, transactionID, points); err != nil {
		return 0, fmt.Errorf("service: record refund failed: %w", err)
	}

	content := fmt.Sprintf("REEMBOLSO DE PUNTOS: Un administrador ha concedido un reembolso de %d puntos (equivalente al %d%% del valor de '%s') al propietario.", points, percentage, listingTitle)
	if err := s.msgRepo.CreateSystemMessage(ctx, transactionID, content); err != nil {
		return 0, fmt.Errorf("service: create refund message: %w", err)
	}

	if s.notifSvc != nil {
		_ = s.notifSvc.Create(ctx, ownerID, "points_refunded", map[string]any{
			"points":        points,
			"listing_title": listingTitle,
		})
	}

	return points, nil
}
