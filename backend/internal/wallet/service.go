package wallet

import (
	"context"
	"fmt"
)

type service struct {
	repo   Repository
	stripe StripePayouter
}

// NewService creates a wallet Service backed by the given Repository and Stripe client.
func NewService(repo Repository, stripe StripePayouter) Service {
	return &service{repo: repo, stripe: stripe}
}

func (s *service) AddPoints(ctx context.Context, userID string, points int) error {
	return s.repo.AddPoints(ctx, userID, points)
}

func (s *service) DeductPoints(ctx context.Context, userID string, points int) (bool, error) {
	return s.repo.DeductPoints(ctx, userID, points)
}

func (s *service) RedeemPoints(ctx context.Context, userID string, pointsToRedeem int) (*Redemption, error) {
	balance, err := s.repo.GetPoints(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("wallet: get balance failed: %w", err)
	}
	if pointsToRedeem < MinRedeemPoints || pointsToRedeem > balance {
		return nil, ErrInsufficientPoints
	}

	accountID, err := s.repo.GetStripeConnectAccountID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("wallet: get stripe account failed: %w", err)
	}
	if accountID == "" {
		return nil, ErrNoConnectedAccount
	}

	redemption, err := s.repo.CreateRedemption(ctx, userID, pointsToRedeem)
	if err != nil {
		return nil, err
	}

	if err := s.stripe.PayoutToConnectedAccount(accountID, int64(pointsToRedeem), "eur"); err != nil {
		_ = s.repo.AddPoints(ctx, userID, pointsToRedeem)
		_ = s.repo.UpdateRedemptionStatus(ctx, redemption.ID, "failed")
		return nil, fmt.Errorf("wallet: stripe payout failed: %w", err)
	}

	_ = s.repo.UpdateRedemptionStatus(ctx, redemption.ID, "completed")
	redemption.Status = "completed"
	return redemption, nil
}

func (s *service) GetPointsHistory(ctx context.Context, userID string) ([]PointsHistoryEntry, error) {
	return s.repo.GetPointsHistory(ctx, userID)
}