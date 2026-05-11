package wallet_test

import (
	"context"
	"encoding/json"
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
	points  int
	history []wallet.PointsHistoryEntry
	err     error
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
	f.points = 0
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

func makeToken(userID string) string {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, _ := token.SignedString([]byte(testJWTSecret))
	return "Bearer " + t
}

func setupRouter(repo wallet.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	h := wallet.NewHandler(wallet.NewService(repo))
	api := r.Group("/api")
	h.RegisterRoutes(api, middleware.RequireAuth(testJWTSecret))
	return r
}

func TestRedeemPoints(t *testing.T) {
	tests := []struct {
		name       string
		points     int
		wantStatus int
	}{
		{name: "no points", points: 0, wantStatus: http.StatusConflict},
		{name: "below minimum", points: 999, wantStatus: http.StatusConflict},
		{name: "exactly minimum", points: 1000, wantStatus: http.StatusOK},
		{name: "above minimum", points: 2500, wantStatus: http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{points: tt.points})
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/users/me/redeem-points", nil)
			req.Header.Set("Authorization", makeToken("user-1"))
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var body struct {
					Data wallet.Redemption `json:"data"`
				}
				assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
				assert.Equal(t, tt.points, body.Data.PointsRedeemed)
				assert.InDelta(t, float64(tt.points)/100.0, body.Data.AmountEuros, 0.001)
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
			router := setupRouter(&fakeRepository{history: tt.history})
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