// Package wallet manages the virtual points balance for lenders.
package wallet

import (
	"context"
	"errors"
	"time"
)

// MinRedeemPoints is the minimum stored balance (euro-cents) required to redeem.
// 1000 stored units = 10.00 displayed points = €10.00.
const MinRedeemPoints = 1000

// ErrInsufficientPoints is returned when a redemption is attempted below the minimum.
var ErrInsufficientPoints = errors.New("insufficient points: balance must be at least 10.00")

// Redemption records a payout request from a lender.
type Redemption struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id"`
	PointsRedeemed int       `json:"points_redeemed"`
	AmountEuros    float64   `json:"amount_euros"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

// PointsHistoryEntry represents a completed transaction with the points earned by the lender.
type PointsHistoryEntry struct {
	TransactionID string    `json:"transaction_id"`
	ListingTitle  string    `json:"listing_title"`
	PointsEarned  int       `json:"points_earned"` // stored euro-cents
	CompletedAt   time.Time `json:"completed_at"`
}

// Repository is the persistence contract for the wallet package.
type Repository interface {
	GetPoints(ctx context.Context, userID string) (int, error)
	AddPoints(ctx context.Context, userID string, delta int) error
	CreateRedemption(ctx context.Context, userID string, points int) (*Redemption, error)
	GetPointsHistory(ctx context.Context, userID string) ([]PointsHistoryEntry, error)
}

// Service is the business-logic contract for the wallet package.
type Service interface {
	AddPoints(ctx context.Context, userID string, points int) error
	RedeemPoints(ctx context.Context, userID string) (*Redemption, error)
	GetPointsHistory(ctx context.Context, userID string) ([]PointsHistoryEntry, error)
}