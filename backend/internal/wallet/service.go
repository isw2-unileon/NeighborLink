package wallet

import (
	"context"
	"fmt"
)

type service struct {
	repo Repository
}

// NewService creates a wallet Service backed by the given Repository.
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) AddPoints(ctx context.Context, userID string, points int) error {
	return s.repo.AddPoints(ctx, userID, points)
}

func (s *service) RedeemPoints(ctx context.Context, userID string) (*Redemption, error) {
	balance, err := s.repo.GetPoints(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("wallet: get balance failed: %w", err)
	}
	if balance < MinRedeemPoints {
		return nil, ErrInsufficientPoints
	}
	return s.repo.CreateRedemption(ctx, userID, balance)
}

func (s *service) GetPointsHistory(ctx context.Context, userID string) ([]PointsHistoryEntry, error) {
	return s.repo.GetPointsHistory(ctx, userID)
}