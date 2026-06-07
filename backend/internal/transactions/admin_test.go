package transactions_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
	"github.com/stretchr/testify/assert"
)

type noopUserNameGetter struct{}

func (noopUserNameGetter) GetUserNameByID(_ context.Context, _ string) (string, error) {
	return "Usuario", nil
}

func TestAdminRestrictions(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("admin cannot reserve listing", func(t *testing.T) {
		repo := &fakeRepository{}
		adminChecker := &mockAdminChecker{Admins: map[string]bool{"admin-1": true}}

		svc := transactions.NewService(repo, nil, &noopListingUpdater{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})
		h := transactions.NewHandler(
			repo,
			svc,
			&noopPointsAdder{},
			&noopNotificationCreator{},
			adminChecker,
			&noopUserNameGetter{},
		)

		r := gin.New()
		h.RegisterRoutes(r.Group("/api"), fakeAuthMiddleware("admin-1"))

		body := map[string]any{
			"start_date": "2026-06-10",
			"end_date":   "2026-06-12",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/api/listings/listing-1/reserve", bytes.NewBuffer(jsonBody))
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
		assert.Contains(t, w.Body.String(), "administrators cannot reserve listings")
	})

	t.Run("only admin can resolve dispute", func(t *testing.T) {
		repo := &fakeRepository{
			transactions: []transactions.Transaction{
				{ID: "tx-1", Status: "pending_review", ListingID: "l-1"},
			},
		}
		adminChecker := &mockAdminChecker{Admins: map[string]bool{"user-1": false}}

		svc := transactions.NewService(repo, nil, &noopListingUpdater{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})
		h := transactions.NewHandler(
			repo,
			svc,
			&noopPointsAdder{},
			&noopNotificationCreator{},
			adminChecker,
			&noopUserNameGetter{},
		)

		r := gin.New()
		h.RegisterRoutes(r.Group("/api"), fakeAuthMiddleware("user-1"))

		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/api/transactions/tx-1/resolve-dispute", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("admin can resolve dispute", func(t *testing.T) {
		repo := &fakeRepository{
			transactions: []transactions.Transaction{
				{ID: "tx-1", Status: "pending_review", ListingID: "l-1"},
			},
		}
		adminChecker := &mockAdminChecker{Admins: map[string]bool{"admin-1": true}}

		svc := transactions.NewService(repo, nil, &noopListingUpdater{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})
		h := transactions.NewHandler(
			repo,
			svc,
			&noopPointsAdder{},
			&noopNotificationCreator{},
			adminChecker,
			&noopUserNameGetter{},
		)

		r := gin.New()
		h.RegisterRoutes(r.Group("/api"), fakeAuthMiddleware("admin-1"))

		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/api/transactions/tx-1/resolve-dispute", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("admin can refund points", func(t *testing.T) {
		repo := &fakeRepository{
			transactions: []transactions.Transaction{
				{ID: "tx-1", Status: "pending_review", ListingID: "l-1", BorrowerID: "borrower-1"},
			},
		}
		adminChecker := &mockAdminChecker{Admins: map[string]bool{"admin-1": true}}

		svc := transactions.NewService(repo, nil, &noopListingUpdater{}, &mockAdminFinder{}, &mockMessageCreator{}, &noopPointsAdder{}, &noopNotificationCreator{})
		h := transactions.NewHandler(
			repo,
			svc,
			&noopPointsAdder{},
			&noopNotificationCreator{},
			adminChecker,
			&noopUserNameGetter{},
		)

		r := gin.New()
		h.RegisterRoutes(r.Group("/api"), fakeAuthMiddleware("admin-1"))

		body := map[string]any{"percentage": 50}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/api/transactions/tx-1/refund-dispute", bytes.NewBuffer(jsonBody))
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "true")
	})
}
