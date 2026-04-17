package reviews_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/isw2-unileon/neighborlink/backend/internal/reviews"
	"github.com/stretchr/testify/assert"
)

type fakeRepository struct {
	reviews []reviews.Review
	err     error
}

func (f *fakeRepository) FindByTransaction(ctx context.Context, transactionID string) ([]reviews.Review, error) {
	if f.err != nil {
		return nil, f.err
	}
	var result []reviews.Review
	for _, r := range f.reviews {
		if r.TransactionID == transactionID {
			result = append(result, r)
		}
	}
	return result, nil
}

func (f *fakeRepository) FindByReviewed(ctx context.Context, reviewedID string) ([]reviews.Review, error) {
	if f.err != nil {
		return nil, f.err
	}
	var result []reviews.Review
	for _, r := range f.reviews {
		if r.ReviewedID == reviewedID {
			result = append(result, r)
		}
	}
	return result, nil
}

func (f *fakeRepository) FindByID(ctx context.Context, id string) (*reviews.Review, error) {
	if f.err != nil {
		return nil, f.err
	}
	for _, r := range f.reviews {
		if r.ID == id {
			return &r, nil
		}
	}
	return nil, nil
}

func setupRouter(repo reviews.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := reviews.NewHandler(repo)
	api := r.Group("/api")
	h.RegisterRoutes(api)
	return r
}

func TestListByTransaction(t *testing.T) {
	tests := []struct {
		name          string
		repoData      []reviews.Review
		repoErr       error
		transactionID string
		wantStatus    int
		wantLen       int
	}{
		{
			name:          "returns reviews for transaction",
			repoData:      []reviews.Review{{ID: "1", TransactionID: "tx-1"}, {ID: "2", TransactionID: "tx-2"}},
			transactionID: "tx-1",
			wantStatus:    http.StatusOK,
			wantLen:       1,
		},
		{
			name:          "returns empty list when no reviews",
			repoData:      []reviews.Review{},
			transactionID: "tx-1",
			wantStatus:    http.StatusOK,
			wantLen:       0,
		},
		{
			name:          "repo error returns 500",
			repoErr:       errors.New("db down"),
			transactionID: "tx-1",
			wantStatus:    http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{reviews: tt.repoData, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/transactions/"+tt.transactionID+"/reviews", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var resp struct {
					Data []reviews.Review `json:"data"`
				}
				err := json.NewDecoder(w.Body).Decode(&resp)
				assert.NoError(t, err)
				assert.Len(t, resp.Data, tt.wantLen)
			}
		})
	}
}

func TestListByReviewed(t *testing.T) {
	tests := []struct {
		name       string
		repoData   []reviews.Review
		repoErr    error
		reviewedID string
		wantStatus int
		wantLen    int
	}{
		{
			name:       "returns reviews for reviewed user",
			repoData:   []reviews.Review{{ID: "1", ReviewedID: "user-1"}, {ID: "2", ReviewedID: "user-2"}},
			reviewedID: "user-1",
			wantStatus: http.StatusOK,
			wantLen:    1,
		},
		{
			name:       "repo error returns 500",
			repoErr:    errors.New("db down"),
			reviewedID: "user-1",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{reviews: tt.repoData, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/users/"+tt.reviewedID+"/reviews", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var resp struct {
					Data []reviews.Review `json:"data"`
				}
				err := json.NewDecoder(w.Body).Decode(&resp)
				assert.NoError(t, err)
				assert.Len(t, resp.Data, tt.wantLen)
			}
		})
	}
}

func TestGetReview(t *testing.T) {
	tests := []struct {
		name       string
		repoData   []reviews.Review
		repoErr    error
		reviewID   string
		wantStatus int
	}{
		{
			name:       "review found returns 200",
			repoData:   []reviews.Review{{ID: "abc-123", Rating: 5}},
			reviewID:   "abc-123",
			wantStatus: http.StatusOK,
		},
		{
			name:       "review not found returns 404",
			repoData:   []reviews.Review{},
			reviewID:   "nonexistent",
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "repo error returns 500",
			repoErr:    errors.New("db down"),
			reviewID:   "abc-123",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{reviews: tt.repoData, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/reviews/"+tt.reviewID, nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}
