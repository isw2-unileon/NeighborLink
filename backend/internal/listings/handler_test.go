package listings_test

import (
	"bytes"
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

func (f *fakeRepository) Create(ctx context.Context, ownerID string, input listings.ListingInput) (*listings.Listing, error) {
	if f.err != nil {
		return nil, f.err
	}
	l := &listings.Listing{
		ID:            "new-id",
		OwnerID:       ownerID,
		Title:         input.Title,
		Description:   input.Description,
		Photos:        input.Photos,
		DepositAmount: input.DepositAmount,
		Status:        "active",
	}
	return l, nil
}

func (f *fakeRepository) Update(ctx context.Context, id string, input listings.ListingInput) (*listings.Listing, error) {
	if f.err != nil {
		return nil, f.err
	}
	for _, l := range f.listings {
		if l.ID == id {
			l.Title = input.Title
			l.Description = input.Description
			l.Photos = input.Photos
			l.DepositAmount = input.DepositAmount
			return &l, nil
		}
	}
	return nil, nil
}

func (f *fakeRepository) Delete(ctx context.Context, id string) error {
	return f.err
}

// fakeAuthMiddleware inyecta un userID fijo en el contexto de Gin.
func fakeAuthMiddleware(userID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	}
}

func setupRouter(repo listings.Repository) *gin.Engine {
	return setupRouterWithAuth(repo, fakeAuthMiddleware("owner-1"))
}

func setupRouterWithAuth(repo listings.Repository, auth gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := listings.NewHandler(repo)
	api := r.Group("/api")
	h.RegisterRoutes(api, auth)
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

func TestCreateListing(t *testing.T) {
	validBody := listings.ListingInput{
		Title:         "Taladro",
		Description:   "Buen estado",
		DepositAmount: 10,
	}

	tests := []struct {
		name       string
		body       any
		repoErr    error
		userID     string
		noAuth     bool
		wantStatus int
	}{
		{
			name:       "valid input returns 201",
			body:       validBody,
			userID:     "owner-1",
			wantStatus: http.StatusCreated,
		},
		{
			name:       "missing auth returns 401",
			body:       validBody,
			noAuth:     true,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid body returns 400",
			body:       map[string]any{"title": ""},
			userID:     "owner-1",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "repo error returns 500",
			body:       validBody,
			userID:     "owner-1",
			repoErr:    errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var auth gin.HandlerFunc
			if tt.noAuth {
				auth = func(c *gin.Context) { c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"}) }
			} else {
				auth = fakeAuthMiddleware(tt.userID)
			}
			router := setupRouterWithAuth(&fakeRepository{err: tt.repoErr}, auth)

			b, _ := json.Marshal(tt.body)
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/listings", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

func TestUpdateListing(t *testing.T) {
	existing := listings.Listing{ID: "1", OwnerID: "owner-1", Title: "Taladro", DepositAmount: 10}
	validBody := listings.ListingInput{Title: "Taladro Pro", Description: "Mejor", DepositAmount: 20}

	tests := []struct {
		name       string
		listingID  string
		body       any
		userID     string
		repoData   []listings.Listing
		wantStatus int
	}{
		{
			name:       "owner updates successfully",
			listingID:  "1",
			body:       validBody,
			userID:     "owner-1",
			repoData:   []listings.Listing{existing},
			wantStatus: http.StatusOK,
		},
		{
			name:       "non-owner gets 403",
			listingID:  "1",
			body:       validBody,
			userID:     "other-user",
			repoData:   []listings.Listing{existing},
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "listing not found returns 404",
			listingID:  "nonexistent",
			body:       validBody,
			userID:     "owner-1",
			repoData:   []listings.Listing{},
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouterWithAuth(
				&fakeRepository{listings: tt.repoData},
				fakeAuthMiddleware(tt.userID),
			)

			b, _ := json.Marshal(tt.body)
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPut, "/api/listings/"+tt.listingID, bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

func TestDeleteListing(t *testing.T) {
	existing := listings.Listing{ID: "1", OwnerID: "owner-1", Title: "Taladro"}

	tests := []struct {
		name       string
		listingID  string
		userID     string
		repoData   []listings.Listing
		wantStatus int
	}{
		{
			name:       "owner deletes successfully",
			listingID:  "1",
			userID:     "owner-1",
			repoData:   []listings.Listing{existing},
			wantStatus: http.StatusNoContent,
		},
		{
			name:       "non-owner gets 403",
			listingID:  "1",
			userID:     "other-user",
			repoData:   []listings.Listing{existing},
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "listing not found returns 404",
			listingID:  "nonexistent",
			userID:     "owner-1",
			repoData:   []listings.Listing{},
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouterWithAuth(
				&fakeRepository{listings: tt.repoData},
				fakeAuthMiddleware(tt.userID),
			)

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodDelete, "/api/listings/"+tt.listingID, nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}
