package transactions_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
	"github.com/stretchr/testify/assert"
)

type fakeRepository struct {
	transactions []transactions.Transaction
	err          error
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

func setupRouter(repo transactions.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := transactions.NewHandler(repo)
	api := r.Group("/api")
	h.RegisterRoutes(api)
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
