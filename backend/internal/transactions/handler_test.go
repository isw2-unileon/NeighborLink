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

type noopPointsAdder struct{}

func (noopPointsAdder) AddPoints(_ context.Context, _ string, _ int) error { return nil }

type noopNotificationCreator struct{}

func (noopNotificationCreator) Create(_ context.Context, _ string, _ string, _ map[string]any) error {
	return nil
}

type noopListingUpdater struct{}

func (noopListingUpdater) UpdateStatus(_ context.Context, _ string, _ string) error { return nil }

type fakeRepository struct {
	transactions         []transactions.Transaction
	err                  error
	ownerByTransactionID map[string]string
	blockedDates         []transactions.DateRange
	reserved             *transactions.Transaction
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

func (f *fakeRepository) FindByBorrower(ctx context.Context, borrowerID string) ([]transactions.BorrowerTransaction, error) {
	if f.err != nil {
		return nil, f.err
	}
	var result []transactions.BorrowerTransaction
	for _, t := range f.transactions {
		if t.BorrowerID == borrowerID {
			result = append(result, transactions.BorrowerTransaction{Transaction: t})
		}
	}
	return result, nil
}

func (f *fakeRepository) FindListingOwnerAndTitle(ctx context.Context, id string) (string, string, error) {
	if f.err != nil {
		return "", "", f.err
	}
	if f.ownerByTransactionID != nil {
		if ownerID, ok := f.ownerByTransactionID[id]; ok {
			return ownerID, "listing-title", nil
		}
	}
	return "", "", fmt.Errorf("transaction %s not found", id)
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

func (f *fakeRepository) UpdatePaymentIntent(ctx context.Context, id string, paymentIntentID string, paymentMethodID string, totalChargedCents int64) error {
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

func (f *fakeRepository) Reserve(ctx context.Context, t transactions.Transaction) (*transactions.Transaction, error) {
	if f.err != nil {
		return nil, f.err
	}
	t.ID = "new-id"
	f.reserved = &t
	return &t, nil
}

func (f *fakeRepository) FindBlockedDates(ctx context.Context, listingID string) ([]transactions.DateRange, error) {
	return f.blockedDates, f.err
}

func (f *fakeRepository) GenerateCode(_ context.Context, _ string, _ string) (string, error) {
	if f.err != nil {
		return "", f.err
	}
	return "123456", nil
}

func (f *fakeRepository) ValidateCode(_ context.Context, _ string, _ string, code string) (bool, error) {
	if f.err != nil {
		return false, f.err
	}
	return code == "123456", nil
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
	r.Use(gin.Recovery())
	svc := transactions.NewService(repo, nil, noopListingUpdater{})
	h := transactions.NewHandler(repo, svc, noopPointsAdder{}, noopNotificationCreator{})
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
					Data []transactions.BorrowerTransaction `json:"data"`
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

	body := `{"listing_id":"l-1","payment_method_id":"pm_test"}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestCreateTransaction_CreatesPendingRecord(t *testing.T) {
	router := setupRouter(&fakeRepository{})

	body := `{"listing_id":"l-1","payment_method_id":"pm_test"}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("borrower-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp struct {
		Data transactions.Transaction `json:"data"`
	}
	err := json.NewDecoder(w.Body).Decode(&resp)
	assert.NoError(t, err)
	assert.Equal(t, "pending", resp.Data.Status)
}

func TestAcceptTransaction_RequiresAuth(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	body := `{"deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/transactions/tx-1/accept", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAcceptTransaction_ForbidsNonOwner(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	body := `{"deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/transactions/tx-1/accept", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("other-user"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestAcceptTransaction_AllowsOwner(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	body := `{"deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/transactions/tx-1/accept", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("owner-1"))
	router.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusUnauthorized, w.Code)
	assert.NotEqual(t, http.StatusForbidden, w.Code)
}

func TestRejectTransaction_RequiresAuth(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/transactions/tx-1/reject", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRejectTransaction_ForbidsNonOwner(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/transactions/tx-1/reject", nil)
	req.Header.Set("Authorization", makeToken("other-user"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestRejectTransaction_AllowsOwner(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/transactions/tx-1/reject", nil)
	req.Header.Set("Authorization", makeToken("owner-1"))
	router.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusUnauthorized, w.Code)
	assert.NotEqual(t, http.StatusForbidden, w.Code)
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

func TestGetAvailability_ReturnsBlockedDates(t *testing.T) {
	repo := &fakeRepository{
		blockedDates: []transactions.DateRange{
			{StartDate: "2026-06-01", EndDate: "2026-06-03"},
		},
	}
	router := setupRouter(repo)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/listings/listing-1/availability", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Data []transactions.DateRange `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Len(t, resp.Data, 1)
	assert.Equal(t, "2026-06-01", resp.Data[0].StartDate)
}

func TestGetAvailability_RepoError_Returns500(t *testing.T) {
	router := setupRouter(&fakeRepository{err: errors.New("db down")})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/listings/listing-1/availability", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ---- POST /api/listings/:id/reserve ----

func TestReserveListing_ValidInput_Returns201(t *testing.T) {
	router := setupRouter(&fakeRepository{})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/listings/listing-1/reserve",
		strings.NewReader(`{"start_date":"2026-06-10","end_date":"2026-06-14","payment_method_id":"pm_sim"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("user-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestReserveListing_NoAuth_Returns401(t *testing.T) {
	router := setupRouter(&fakeRepository{})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/listings/listing-1/reserve",
		strings.NewReader(`{"start_date":"2026-06-10","end_date":"2026-06-14","payment_method_id":"pm_sim"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestReserveListing_MoreThan7Days_Returns400(t *testing.T) {
	router := setupRouter(&fakeRepository{})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/listings/listing-1/reserve",
		strings.NewReader(`{"start_date":"2026-06-01","end_date":"2026-06-10","payment_method_id":"pm_sim"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("user-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestReserveListing_EndBeforeStart_Returns400(t *testing.T) {
	router := setupRouter(&fakeRepository{})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/listings/listing-1/reserve",
		strings.NewReader(`{"start_date":"2026-06-10","end_date":"2026-06-08","payment_method_id":"pm_sim"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("user-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestReserveListing_OverlapWithExisting_Returns409(t *testing.T) {
	router := setupRouter(&fakeRepository{
		blockedDates: []transactions.DateRange{
			{StartDate: "2026-06-08", EndDate: "2026-06-12"},
		},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/listings/listing-1/reserve",
		strings.NewReader(`{"start_date":"2026-06-10","end_date":"2026-06-14","payment_method_id":"pm_sim"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("user-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestReserveListing_InvalidDateFormat_Returns400(t *testing.T) {
	router := setupRouter(&fakeRepository{})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/listings/listing-1/reserve",
		strings.NewReader(`{"start_date":"10-06-2026","end_date":"2026-06-14","payment_method_id":"pm_sim"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("user-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestReserveListing_RepoError_Returns500(t *testing.T) {
	router := setupRouter(&fakeRepository{err: errors.New("db down")})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/listings/listing-1/reserve",
		strings.NewReader(`{"start_date":"2026-06-10","end_date":"2026-06-14","payment_method_id":"pm_sim"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("user-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestReserveListing_SavesCorrectData(t *testing.T) {
	repo := &fakeRepository{}
	router := setupRouter(repo)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/listings/listing-1/reserve",
		strings.NewReader(`{"start_date":"2026-06-10","end_date":"2026-06-14","payment_method_id":"pm_sim"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("user-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	assert.NotNil(t, repo.reserved)
	assert.Equal(t, "listing-1", repo.reserved.ListingID)
	assert.Equal(t, "user-1", repo.reserved.BorrowerID)
	assert.Equal(t, 2026, repo.reserved.StartDate.Year())
	assert.Equal(t, 6, int(repo.reserved.StartDate.Month()))
	assert.Equal(t, 10, repo.reserved.StartDate.Day())
}

// ---- POST /api/transactions/:id/generate-delivery-code ----

func TestGenerateDeliveryCode_RequiresAuth(t *testing.T) {
	router := setupRouter(&fakeRepository{
		transactions: []transactions.Transaction{{ID: "tx-1", BorrowerID: "borrower-1", Status: "agreed"}},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/generate-delivery-code", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestGenerateDeliveryCode_ForbidsNonBorrower(t *testing.T) {
	router := setupRouter(&fakeRepository{
		transactions: []transactions.Transaction{{ID: "tx-1", BorrowerID: "borrower-1", Status: "agreed"}},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/generate-delivery-code", nil)
	req.Header.Set("Authorization", makeToken("other-user"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestGenerateDeliveryCode_ReturnsBorrowerCode(t *testing.T) {
	router := setupRouter(&fakeRepository{
		transactions: []transactions.Transaction{{ID: "tx-1", BorrowerID: "borrower-1", Status: "agreed"}},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/generate-delivery-code", nil)
	req.Header.Set("Authorization", makeToken("borrower-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Data struct {
			Code string `json:"code"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "123456", resp.Data.Code)
}

func TestGenerateDeliveryCode_TransactionNotFound_Returns404(t *testing.T) {
	router := setupRouter(&fakeRepository{transactions: []transactions.Transaction{}})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/nonexistent/generate-delivery-code", nil)
	req.Header.Set("Authorization", makeToken("borrower-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ---- POST /api/transactions/:id/generate-return-code ----

func TestGenerateReturnCode_RequiresAuth(t *testing.T) {
	router := setupRouter(&fakeRepository{
		transactions: []transactions.Transaction{{ID: "tx-1", BorrowerID: "borrower-1", Status: "handed_over"}},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/generate-return-code", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestGenerateReturnCode_ForbidsNonBorrower(t *testing.T) {
	router := setupRouter(&fakeRepository{
		transactions: []transactions.Transaction{{ID: "tx-1", BorrowerID: "borrower-1", Status: "handed_over"}},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/generate-return-code", nil)
	req.Header.Set("Authorization", makeToken("other-user"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestGenerateReturnCode_ReturnsBorrowerCode(t *testing.T) {
	router := setupRouter(&fakeRepository{
		transactions: []transactions.Transaction{{ID: "tx-1", BorrowerID: "borrower-1", Status: "handed_over"}},
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/generate-return-code", nil)
	req.Header.Set("Authorization", makeToken("borrower-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Data struct {
			Code string `json:"code"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "123456", resp.Data.Code)
}

// ---- POST /api/transactions/:id/confirm-handover ----

func TestConfirmHandover_RequiresAuth(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	body := `{"code":"123456","deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/confirm-handover", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestConfirmHandover_ForbidsNonOwner(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	body := `{"code":"123456","deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/confirm-handover", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("other-user"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestConfirmHandover_InvalidCode_Returns422(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
		transactions:         []transactions.Transaction{{ID: "tx-1", Status: "agreed"}},
	})

	body := `{"code":"wrong-code","deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/confirm-handover", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("owner-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestConfirmHandover_ValidCode_Returns200(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
		transactions:         []transactions.Transaction{{ID: "tx-1", Status: "agreed"}},
	})

	body := `{"code":"123456","deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/confirm-handover", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("owner-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ---- POST /api/transactions/:id/confirm-return ----

func TestConfirmReturn_RequiresAuth(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	body := `{"code":"123456","deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/confirm-return", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestConfirmReturn_ForbidsNonOwner(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
	})

	body := `{"code":"123456","deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/confirm-return", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("other-user"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestConfirmReturn_InvalidCode_Returns422(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
		transactions:         []transactions.Transaction{{ID: "tx-1", Status: "handed_over"}},
	})

	body := `{"code":"wrong-code","deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/confirm-return", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("owner-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestConfirmReturn_ValidCode_Returns200(t *testing.T) {
	router := setupRouter(&fakeRepository{
		ownerByTransactionID: map[string]string{"tx-1": "owner-1"},
		transactions:         []transactions.Transaction{{ID: "tx-1", Status: "handed_over"}},
	})

	body := `{"code":"123456","deposit_amount_cents":5000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/confirm-return", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", makeToken("owner-1"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}
