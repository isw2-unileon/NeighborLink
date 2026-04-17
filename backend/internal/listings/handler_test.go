package listings_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/isw2-unileon/neighborlink/backend/internal/listings"
	"github.com/stretchr/testify/assert"
)

type fakeRepository struct {
	listings []listings.Listing
	err      error
}

func (f *fakeRepository) FindAll(ctx context.Context) ([]listings.Listing, error) {
	return f.listings, f.err
}

func (f *fakeRepository) FindByID(ctx context.Context, id string) (*listings.Listing, error) {
	if f.err != nil {
		return nil, f.err
	}
	for _, l := range f.listings {
		if l.ID == id {
			return &l, nil
		}
	}
	return nil, nil
}

func (f *fakeRepository) FindByOwner(ctx context.Context, ownerID string) ([]listings.Listing, error) {
	if f.err != nil {
		return nil, f.err
	}
	var result []listings.Listing
	for _, l := range f.listings {
		if l.OwnerID == ownerID {
			result = append(result, l)
		}
	}
	return result, nil
}

func setupRouter(repo listings.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := listings.NewHandler(repo)
	api := r.Group("/api")
	h.RegisterRoutes(api)
	return r
}

func TestListListings(t *testing.T) {
	tests := []struct {
		name       string
		repoData   []listings.Listing
		repoErr    error
		wantStatus int
		wantLen    int
	}{
		{
			name:       "returns empty list",
			repoData:   []listings.Listing{},
			wantStatus: http.StatusOK,
			wantLen:    0,
		},
		{
			name:       "returns listings",
			repoData:   []listings.Listing{{ID: "1", Title: "Taladro"}, {ID: "2", Title: "Bici"}},
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
			router := setupRouter(&fakeRepository{listings: tt.repoData, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/listings", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var resp struct {
					Data []listings.Listing `json:"data"`
				}
				err := json.NewDecoder(w.Body).Decode(&resp)
				assert.NoError(t, err)
				assert.Len(t, resp.Data, tt.wantLen)
			}
		})
	}
}

func TestGetListing(t *testing.T) {
	tests := []struct {
		name       string
		repoData   []listings.Listing
		repoErr    error
		listingID  string
		wantStatus int
	}{
		{
			name:       "listing found returns 200",
			repoData:   []listings.Listing{{ID: "abc-123", Title: "Taladro"}},
			listingID:  "abc-123",
			wantStatus: http.StatusOK,
		},
		{
			name:       "listing not found returns 404",
			repoData:   []listings.Listing{},
			listingID:  "nonexistent",
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "repo error returns 500",
			repoErr:    errors.New("db down"),
			listingID:  "abc-123",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{listings: tt.repoData, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/listings/"+tt.listingID, nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

func TestListByOwner(t *testing.T) {
	tests := []struct {
		name       string
		repoData   []listings.Listing
		repoErr    error
		ownerID    string
		wantStatus int
		wantLen    int
	}{
		{
			name:       "returns listings for owner",
			repoData:   []listings.Listing{{ID: "1", OwnerID: "owner-1"}, {ID: "2", OwnerID: "owner-2"}},
			ownerID:    "owner-1",
			wantStatus: http.StatusOK,
			wantLen:    1,
		},
		{
			name:       "repo error returns 500",
			repoErr:    errors.New("db down"),
			ownerID:    "owner-1",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{listings: tt.repoData, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/users/"+tt.ownerID+"/listings", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var resp struct {
					Data []listings.Listing `json:"data"`
				}
				err := json.NewDecoder(w.Body).Decode(&resp)
				assert.NoError(t, err)
				assert.Len(t, resp.Data, tt.wantLen)
			}
		})
	}
}
