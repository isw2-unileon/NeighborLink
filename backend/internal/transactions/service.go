package transactions

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

// ErrInsufficientPoints is returned when the borrower does not have enough points to pay.
var ErrInsufficientPoints = errors.New("insufficient points to cover the deposit")

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

type pointsWallet interface {
	AddPoints(ctx context.Context, userID string, points int) error
	DeductPoints(ctx context.Context, userID string, points int) (bool, error)
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
	walletSvc  pointsWallet
	notifSvc   notificationCreator
}

// NewService creates a new Service instance with the required dependencies.
func NewService(repo Repository, stripe stripeDepositor, listingSvc listingStatusUpdater, adminRepo adminFinder, msgRepo messageCreator, walletSvc pointsWallet, notifSvc notificationCreator) *Service {
	return &Service{repo: repo, stripe: stripe, listingSvc: listingSvc, adminRepo: adminRepo, msgRepo: msgRepo, walletSvc: walletSvc, notifSvc: notifSvc}
}

// decideRequest is a helper method to handle the common flow of accepting or rejecting a request, reducing code duplication between AcceptRequest and RejectRequest.
func (s *Service) decideRequest(
	ctx context.Context,
	transactionID string,
	repoAction func(context.Context, string) error,
	notifType string,
	logMsg string,
) error {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil {
		return fmt.Errorf("service: transaction %s not found", transactionID)
	}
	if t.Status != "pending" {
		return fmt.Errorf("service: transaction %s is not pending", transactionID)
	}
	if err := repoAction(ctx, transactionID); err != nil {
		return fmt.Errorf("service: %s: %w", logMsg, err)
	}

	switch notifType {
	case "transaction_accepted":
		t.Status = "awaiting_payment"
	case "transaction_rejected":
		t.Status = "cancelled"
	}

	if s.notifSvc != nil {
		_, listingTitle, _, err := s.repo.FindListingInfoForRefund(ctx, t.ListingID)
		if err != nil {
			return fmt.Errorf("service: get listing info: %w", err)
		}

		if err := s.notifSvc.Create(ctx, t.BorrowerID, notifType, map[string]any{
			"listing_title": listingTitle,
		}); err != nil {
			slog.Error("failed to create decision notification", "transaction_id", transactionID, "error", err)
		}
	}

	return nil
}

// AcceptRequest accepts a pending transaction.
func (s *Service) AcceptRequest(ctx context.Context, transactionID string) error {
	return s.decideRequest(
		ctx,
		transactionID,
		s.repo.AcceptRequest,
		"transaction_accepted",
		"accept transaction",
	)
}

// RejectRequest cancels a pending transaction and updates its status to cancelled.
func (s *Service) RejectRequest(ctx context.Context, transactionID string) error {
	return s.decideRequest(
		ctx,
		transactionID,
		s.repo.RejectRequest,
		"transaction_rejected",
		"reject transaction",
	)
}

// ConfirmPayment authorises the deposit and moves the transaction to agreed.
// paymentMethod must be "card" or "points". Only the borrower can call this when status = awaiting_payment.
func (s *Service) ConfirmPayment(ctx context.Context, transactionID string, depositAmountCents int64, paymentMethodID string, paymentMethod string) (string, error) {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return "", fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil || t.Status != "awaiting_payment" {
		return "", fmt.Errorf("service: transaction %s must be in awaiting_payment status to pay", transactionID)
	}

	totalCents := depositAmountCents + PlatformFeeCents

	if paymentMethod == "points" {
		ok, err := s.walletSvc.DeductPoints(ctx, t.BorrowerID, int(totalCents))
		if err != nil {
			return "", fmt.Errorf("service: deduct points: %w", err)
		}
		if !ok {
			return "", ErrInsufficientPoints
		}
		if err := s.repo.SetAgreedWithPoints(ctx, transactionID, totalCents); err != nil {
			return "", fmt.Errorf("service: set agreed with points: %w", err)
		}
		if err := s.listingSvc.UpdateStatus(ctx, t.ListingID, "pending_handover"); err != nil {
			return "", fmt.Errorf("service: update listing status: %w", err)
		}
		return "", nil
	}

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

	if t.PaymentMethod != "points" && !isDevPaymentIntent(t.StripePaymentIntentID) {
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

// ReturnResult holds the outcome of a Return call so the handler can apply post-return actions.
type ReturnResult struct {
	DaysBorrowed      int
	RefundAmountCents int64
	PaymentMethod     string
	BorrowerID        string
}

// Return refunds a variable percentage of the deposit to the borrower based on days borrowed,
// marks the transaction as returned, and updates the listing status back to available.
// Returns a ReturnResult so the caller can apply wallet credits or Stripe release.
func (s *Service) Return(ctx context.Context, transactionID string, depositAmountCents int64) (*ReturnResult, error) {
	t, err := s.repo.FindByID(ctx, transactionID)
	if err != nil {
		return nil, fmt.Errorf("service: find transaction: %w", err)
	}
	if t == nil || t.Status != "handed_over" {
		return nil, fmt.Errorf("service: transaction %s must be in handed_over status to return", transactionID)
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

	if t.PaymentMethod != "points" {
		// Stripe requires at least 1 cent for refunds.
		if refundAmountCents < 1 {
			refundAmountCents = 1
		}
		if !isDevPaymentIntent(t.StripePaymentIntentID) {
			if err := s.stripe.ReleaseDeposit(t.StripePaymentIntentID, refundAmountCents); err != nil {
				return nil, fmt.Errorf("service: release deposit: %w", err)
			}
		}
	}

	if err := s.repo.UpdateStatus(ctx, transactionID, "returned"); err != nil {
		return nil, fmt.Errorf("service: update status: %w", err)
	}

	if err := s.listingSvc.UpdateStatus(ctx, t.ListingID, "available"); err != nil {
		return nil, fmt.Errorf("service: update listing status: %w", err)
	}
	return &ReturnResult{
		DaysBorrowed:      daysBorrowed,
		RefundAmountCents: refundAmountCents,
		PaymentMethod:     t.PaymentMethod,
		BorrowerID:        t.BorrowerID,
	}, nil
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

	// Calculate and award points to the owner (reward for the loan)
	ownerID, err := s.repo.FindListingOwnerByTransactionID(ctx, transactionID)
	if err == nil {
		effectiveStart := *t.StartDate
		if t.HandoverAt != nil && t.HandoverAt.After(effectiveStart) {
			effectiveStart = *t.HandoverAt
		}
		days := calcDaysBorrowed(effectiveStart, time.Now())
		depositAmountCents := t.TotalChargedCents - PlatformFeeCents
		pointsEarned := int(depositAmountCents * int64(days+4) / 100)

		if pointsEarned > 0 {
			// We log the error but don't fail the resolution if wallet update fails
			_ = s.walletSvc.AddPoints(ctx, ownerID, pointsEarned)
		}
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

// RefundDisputePoints allows an admin to refund a percentage of the listing's value in points to the borrower.
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

	ownerID, listingTitle, deposit, err := s.repo.FindListingInfoForRefund(ctx, t.ListingID)
	if err != nil {
		return 0, fmt.Errorf("service: get listing info: %w", err)
	}

	// Calculate points: deposit is in Euros, so we multiply by 100 to get points/cents.
	points := int(deposit * 100) * percentage / 100
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
