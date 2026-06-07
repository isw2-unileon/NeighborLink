package wallet_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/isw2-unileon/neighborlink/backend/internal/platform/middleware"
	"github.com/isw2-unileon/neighborlink/backend/internal/wallet"
	"github.com/stretchr/testify/assert"
)

const testJWTSecret = "test-wallet-secret"

// fakeRepository is an in-memory wallet.Repository for tests.
type fakeRepository struct {
	points           int
	connectAccountID string
	history          []wallet.PointsHistoryEntry
	err              error
}

func (f *fakeRepository) GetPoints(_ context.Context, _ string) (int, error) {
	return f.points, f.err
}

func (f *fakeRepository) AddPoints(_ context.Context, _ string, delta int) error {
	if f.err != nil {
		return f.err
	}
	f.points += delta
	return nil
}

func (f *fakeRepository) CreateRedemption(_ context.Context, _ string, points int) (*wallet.Redemption, error) {
	if f.err != nil {
		return nil, f.err
	}
	f.points -= points
	return &wallet.Redemption{
		ID:             "redemption-1",
		UserID:         "user-1",
		PointsRedeemed: points,
		AmountEuros:    float64(points) / 100.0,
		Status:         "pending",
		CreatedAt:      time.Now(),
	}, nil
}

func (f *fakeRepository) GetPointsHistory(_ context.Context, _ string) ([]wallet.PointsHistoryEntry, error) {
	return f.history, f.err
}

func (f *fakeRepository) GetStripeConnectAccountID(_ context.Context, _ string) (string, error) {
	return f.connectAccountID, f.err
}

func (f *fakeRepository) UpdateRedemptionStatus(_ context.Context, _, _ string) error {
	return nil
}

func (f *fakeRepository) DeductPoints(_ context.Context, _ string, amount int) (bool, error) {
	if f.err != nil {
		return false, f.err
	}
	if f.points < amount {
		return false, nil
	}
	f.points -= amount
	return true, nil
}

// fakeStripe implements wallet.StripePayouter for tests.
type fakeStripe struct{ fail bool }

func (f *fakeStripe) PayoutToConnectedAccount(_ string, _ int64, _ string) error {
	if f.fail {
		return errors.New("stripe error")
	}
	return nil
}

func makeToken(userID string) string {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, _ := token.SignedString([]byte(testJWTSecret))
	return "Bearer " + t
}

func setupRouter(repo wallet.Repository, stripe wallet.StripePayouter) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	h := wallet.NewHandler(wallet.NewService(repo, stripe))
	api := r.Group("/api")
	h.RegisterRoutes(api, middleware.RequireAuth(testJWTSecret))
	return r
}

func redeemBody(points int) *bytes.Buffer {
	b, _ := json.Marshal(map[string]int{"points_to_redeem": points})
	return bytes.NewBuffer(b)
}

func TestRedeemPoints(t *testing.T) {
	tests := []struct {
		name             string
		points           int
		connectAccountID string
		stripeFail       bool
		body             *bytes.Buffer
		wantStatus       int
	}{
		{
			name: "no body", points: 2000, connectAccountID: "acct_123",
			body: bytes.NewBufferString("{}"), wantStatus: http.StatusBadRequest,
		},
		{
			// binding:"min=1000" rejects amounts below the threshold at the HTTP layer
			name: "below minimum", points: 999, connectAccountID: "acct_123",
			body: redeemBody(999), wantStatus: http.StatusBadRequest,
		},
		{
			name: "no connected account", points: 2000, connectAccountID: "",
			body: redeemBody(1000), wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name: "stripe failure compensates", points: 2000, connectAccountID: "acct_123", stripeFail: true,
			body: redeemBody(1000), wantStatus: http.StatusInternalServerError,
		},
		{
			name: "exactly minimum", points: 1000, connectAccountID: "acct_123",
			body: redeemBody(1000), wantStatus: http.StatusOK,
		},
		{
			name: "partial redemption", points: 2500, connectAccountID: "acct_123",
			body: redeemBody(1000), wantStatus: http.StatusOK,
		},
		{
			name: "redeem more than balance", points: 500, connectAccountID: "acct_123",
			body: redeemBody(1000), wantStatus: http.StatusConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{points: tt.points, connectAccountID: tt.connectAccountID}
			stripe := &fakeStripe{fail: tt.stripeFail}
			router := setupRouter(repo, stripe)

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/users/me/redeem-points", tt.body)
			req.Header.Set("Authorization", makeToken("user-1"))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var body struct {
					Data wallet.Redemption `json:"data"`
				}
				assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
				assert.Equal(t, "completed", body.Data.Status)
				assert.InDelta(t, float64(body.Data.PointsRedeemed)/100.0, body.Data.AmountEuros, 0.001)
			}

			if tt.name == "stripe failure compensates" {
				// points should have been restored by compensation
				assert.Equal(t, tt.points, repo.points)
			}

			if tt.name == "partial redemption" {
				var body struct {
					Data wallet.Redemption `json:"data"`
				}
				assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
				assert.Equal(t, 1000, body.Data.PointsRedeemed)
				assert.Equal(t, 1500, repo.points) // 2500 - 1000
			}
		})
	}
}

func TestPointsHistory(t *testing.T) {
	tests := []struct {
		name       string
		history    []wallet.PointsHistoryEntry
		wantStatus int
		wantLen    int
	}{
		{
			name:       "empty history",
			history:    []wallet.PointsHistoryEntry{},
			wantStatus: http.StatusOK,
			wantLen:    0,
		},
		{
			name: "two entries",
			history: []wallet.PointsHistoryEntry{
				{TransactionID: "t1", ListingTitle: "Taladro", PointsEarned: 75, CompletedAt: time.Now()},
				{TransactionID: "t2", ListingTitle: "Bicicleta", PointsEarned: 100, CompletedAt: time.Now()},
			},
			wantStatus: http.StatusOK,
			wantLen:    2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{history: tt.history, connectAccountID: "acct_123"}, &fakeStripe{})
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/users/me/points-history", nil)
			req.Header.Set("Authorization", makeToken("user-1"))
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			var body struct {
				Data []wallet.PointsHistoryEntry `json:"data"`
			}
			assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
			assert.Len(t, body.Data, tt.wantLen)
		})
	}
}
