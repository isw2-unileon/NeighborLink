package listings_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/isw2-unileon/neighborlink/backend/internal/listings"
	"github.com/stretchr/testify/assert"
)

type mockAdminChecker struct {
	admins map[string]bool
}

func (m *mockAdminChecker) IsAdmin(_ context.Context, userID string) (bool, error) {
	return m.admins[userID], nil
}

type mockNotificationCreator struct {
	notifications []string
}

func (m *mockNotificationCreator) Create(_ context.Context, userID, typ string, payload map[string]any) error {
	m.notifications = append(m.notifications, typ)
	return nil
}

func TestAdminListingDeletion(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("admin can delete any listing with reason", func(t *testing.T) {
		repo := &fakeRepository{
			listing: &listings.Listing{ID: "l-1", OwnerID: "owner-1", Title: "Test Item"},
		}
		adminChecker := &mockAdminChecker{admins: map[string]bool{"admin-1": true}}
		notifSvc := &mockNotificationCreator{}
		
		h := listings.NewHandler(repo, &fakeStorageService{}, notifSvc, adminChecker, &fakeTransactionLister{})

		r := gin.New()
		h.RegisterRoutes(r.Group("/api"), fakeAuthMiddleware("admin-1"))

		body := map[string]any{"reason": "Inappropriate content"}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req := httptest.NewRequest("DELETE", "/api/listings/l-1", bytes.NewBuffer(jsonBody))
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNoContent, w.Code)
		assert.Contains(t, notifSvc.notifications, "listing_deleted_by_admin")
	})

	t.Run("non-admin cannot delete others listing", func(t *testing.T) {
		repo := &fakeRepository{
			listing: &listings.Listing{ID: "l-1", OwnerID: "owner-1", Title: "Test Item"},
		}
		adminChecker := &mockAdminChecker{admins: map[string]bool{"user-2": false}}
		
		h := listings.NewHandler(repo, &fakeStorageService{}, &fakeNotificationCreator{}, adminChecker, &fakeTransactionLister{})

		r := gin.New()
		h.RegisterRoutes(r.Group("/api"), fakeAuthMiddleware("user-2"))

		w := httptest.NewRecorder()
		req := httptest.NewRequest("DELETE", "/api/listings/l-1", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
	})
}
