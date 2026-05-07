package transactions_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/isw2-unileon/neighborlink/backend/internal/platform/middleware"
	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
	"github.com/stretchr/testify/assert"
)

type fakeRepository struct {
	transactions          []transactions.Transaction
	err                   error
	ownerByTransactionID  map[string]string
}

func (f *fakeRepository) FindAll(ctx context.Context) ([]transactions.Transaction, error) {
	return f.transactions, f.err
}

func (f *fakeRepository) FindByID(ctx context.Context, id string) (*transactions.Transaction, error) {
	if f.err != nil {
		return nil, f.err
	}
	for _, t := range f.transactions {
		if t.ID == id {
			return &t, nil
		}
	}
	return nil, nil
}

func (f *fakeRepository) FindByListing(ctx context.Context, listingID string) ([]transactions.Transaction, error) {
	if f.err != nil {
		return nil, f.err
	}
	var result []transactions.Transaction
	for _, t := range f.transactions {
		if t.ListingID == listingID {
			result = append(result, t)
		}
	}
	return result, nil
}

func (f *fakeRepository) FindByBorrower(ctx context.Context, borrowerID string) ([]transactions.Transaction, error) {
	if f.err != nil {
		return nil, f.err
	}
	var result []transactions.Transaction
	for _, t := range f.transactions {
		if t.BorrowerID == borrowerID {
			result = append(result, t)
		}
	}
	return result, nil
}

func (f *fakeRepository) FindListingOwnerByTransactionID(ctx context.Context, id string) (string, error) {
	if f.err != nil {
		return "", f.err
	}
	if f.ownerByTransactionID != nil {
		if ownerID, ok := f.ownerByTransactionID[id]; ok {
			return ownerID, nil
		}
	}
	return "", fmt.Errorf("transaction %s not found", id)
}

func (f *fakeRepository) Create(ctx context.Context, t transactions.Transaction) (*transactions.Transaction, error) {
	if f.err != nil {
		return nil, f.err
	}
	t.ID = fmt.Sprintf("fake-%d", len(f.transactions)+1)
	t.Status = "pending"
	f.transactions = append(f.transactions, t)
	created := f.transactions[len(f.transactions)-1]
	return &created, nil
}

func (f *fakeRepository) UpdatePaymentIntent(ctx context.Context, id string, paymentIntentID string, paymentMethodID string) error {
	if f.err != nil {
		return f.err
	}
	now := time.Now()
	for i, t := range f.transactions {
		if t.ID == id {
			f.transactions[i].StripePaymentIntentID = paymentIntentID
			f.transactions[i].PaymentMethodID = paymentMethodID
			f.transactions[i].Status = "agreed"
			f.transactions[i].AgreedAt = &now
			return nil
		}
	}
	return fmt.Errorf("transaction %s not found", id)
}

func (f *fakeRepository) UpdateStatus(ctx context.Context, id string, status string) error {
	if f.err != nil {
		return f.err
	}
	now := time.Now()
	for i, t := range f.transactions {
		if t.ID == id {
			f.transactions[i].Status = status
			switch status {
			case "handed_over":
				f.transactions[i].HandoverAt = &now
			case "returned":
				f.transactions[i].ReturnAt = &now
			}
			return nil
		}
	}
	return fmt.Errorf("transaction %s not found", id)
}

const testJWTSecret = "test-secret"

func makeToken(userID string) string {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, _ := token.SignedString([]byte(testJWTSecret))
	return "Bearer " + t
}

func setupRouter(repo transactions.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := transactions.NewHandler(repo, nil)
	api := r.Group("/api")
	h.RegisterRoutes(api, middleware.RequireAuth(testJWTSecret))
	return r
}

func TestListTransactions(t *testing.T) {
	tests := []struct {
		name       string
		repoData   []transactions.Transaction
		repoErr    error
		wantStatus int
		wantLen    int
	}{
		{
			name:       "returns empty list",
			repoData:   []transactions.Transaction{},
			wantStatus: http.StatusOK,
			wantLen:    0,
		},
		{
			name:       "returns transactions",
			repoData:   []transactions.Transaction{{ID: "1", Status: "pending"}, {ID: "2", Status: "active"}},
			wantStatus: http.StatusOK,
			wantLen:    2,
		},
		{
			name:       "repo error returns 500",
			repoErr:    errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{transactions: tt.repoData, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/transactions", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var resp struct {
					Data []transactions.Transaction `json:"data"`
				}
				err := json.NewDecoder(w.Body).Decode(&resp)
				assert.NoError(t, err)
				assert.Len(t, resp.Data, tt.wantLen)
			}
		})
	}
}

func TestGetTransaction(t *testing.T) {
	tests := []struct {
		name          string
		repoData      []transactions.Transaction
		repoErr       error
		transactionID string
		wantStatus    int
	}{
		{
			name:          "transaction found returns 200",
			repoData:      []transactions.Transaction{{ID: "abc-123", Status: "pending"}},
			transactionID: "abc-123",
			wantStatus:    http.StatusOK,
		},
		{
			name:          "transaction not found returns 404",
			repoData:      []transactions.Transaction{},
			transactionID: "nonexistent",
			wantStatus:    http.StatusNotFound,
		},
		{
			name:          "repo error returns 500",
			repoErr:       errors.New("db down"),
			transactionID: "abc-123",
			wantStatus:    http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{transactions: tt.repoData, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/transactions/"+tt.transactionID, nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

func TestListByBorrower(t *testing.T) {
	tests := []struct {
		name       string
		repoData   []transactions.Transaction
		repoErr    error
		borrowerID string
		wantStatus int
		wantLen    int
	}{
		{
			name:       "returns transactions for borrower",
			repoData:   []transactions.Transaction{{ID: "1", BorrowerID: "user-1"}, {ID: "2", BorrowerID: "user-2"}},
			borrowerID: "user-1",
			wantStatus: http.StatusOK,
			wantLen:    1,
		},
		{
			name:       "repo error returns 500",
			repoErr:    errors.New("db down"),
			borrowerID: "user-1",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{transactions: tt.repoData, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/users/"+tt.borrowerID+"/transactions", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var resp struct {
					Data []transactions.Transaction `json:"data"`
				}
				err := json.NewDecoder(w.Body).Decode(&resp)
				assert.NoError(t, err)
				assert.Len(t, resp.Data, tt.wantLen)
			}
		})
	}
}

func TestCreateTransaction_RequiresAuth(t *testing.T) {
	router := setupRouter(&fakeRepository{})

	body := `{"listing_id":"l-1","payment_method_id":"pm_test","deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestHandoverTransaction_RequiresAuth(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/handover", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestHandoverTransaction_ForbidsNonOwner(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/handover", nil)
	req.Header.Set("Authorization", makeToken("other-user"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestHandoverTransaction_AllowsOwner(t *testing.T) {
	// service is nil so Handover will panic — use a fake service via nil check,
	// but here we just verify the auth layer passes through (service call will error).
	// We can't test the full success path without a real service, but 500 (not 401/403)
	// confirms the auth check passed.
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/handover", bytes.NewReader([]byte{}))
	req.Header.Set("Authorization", makeToken("owner-1"))
	router.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusUnauthorized, w.Code)
	assert.NotEqual(t, http.StatusForbidden, w.Code)
}

func TestReturnTransaction_RequiresAuth(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	body := `{"deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/return", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestReturnTransaction_ForbidsNonOwner(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	body := `{"deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/return", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("other-user"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestReturnTransaction_AllowsOwner(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	body := `{"deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/return", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("owner-1"))
	router.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusUnauthorized, w.Code)
	assert.NotEqual(t, http.StatusForbidden, w.Code)
}