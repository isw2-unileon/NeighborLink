package listings_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/isw2-unileon/neighborlink/backend/internal/listings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Fakes ---

type fakeRepository struct {
	listings  []listings.Listing
	listing   *listings.Listing
	findErr   error
	createErr error
	updateErr error
	deleteErr error
	photoErr  error
}

func (f *fakeRepository) FindAll(ctx context.Context, _ listings.FilterParams) ([]listings.Listing, error) {
	return f.listings, f.findErr
}

func (f *fakeRepository) FindByID(ctx context.Context, id string) (*listings.Listing, error) {
	return f.listing, f.findErr
}

func (f *fakeRepository) FindByOwner(ctx context.Context, ownerID string) ([]listings.Listing, error) {
	return f.listings, f.findErr
}

func (f *fakeRepository) Create(ctx context.Context, ownerID string, input listings.ListingInput) (*listings.Listing, error) {
	return f.listing, f.createErr
}

func (f *fakeRepository) Update(ctx context.Context, id string, input listings.ListingInput) (*listings.Listing, error) {
	return f.listing, f.updateErr
}

func (f *fakeRepository) Delete(ctx context.Context, id string) error {
	return f.deleteErr
}

func (f *fakeRepository) AddPhoto(ctx context.Context, id string, photoURL string) (*listings.Listing, error) {
	return f.listing, f.photoErr
}

type fakeStorageService struct {
	url string
	err error
}

// Debe coincidir EXACTAMENTE con listings.StorageService.UploadPhoto
func (s *fakeStorageService) UploadPhoto(listingID string, filename string, r io.Reader, contentType string) (string, error) {
	return s.url, s.err
}

// --- Helpers ---

func fakeAuthMiddleware(userID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	}
}

func setupRouter(repo listings.Repository) *gin.Engine {
	return setupRouterWithStorage(repo, &fakeStorageService{})
}

func setupRouterWithAuth(repo listings.Repository, auth gin.HandlerFunc) *gin.Engine {
	return setupRouterFull(repo, &fakeStorageService{}, auth)
}

func setupRouterWithStorage(repo listings.Repository, storage listings.StorageService) *gin.Engine {
	return setupRouterFull(repo, storage, fakeAuthMiddleware("owner-1"))
}

func setupRouterFull(repo listings.Repository, storage listings.StorageService, auth gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := listings.NewHandler(repo, storage)
	api := r.Group("/api")
	h.RegisterRoutes(api, auth)
	return r
}

// --- Tests ---

func TestListListings(t *testing.T) {
	tests := []struct {
		name       string
		repoData   []listings.Listing
		findErr    error
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
			findErr:    errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{
				listings: tt.repoData,
				findErr:  tt.findErr,
			})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/listings", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var resp []listings.Listing
				err := json.NewDecoder(w.Body).Decode(&resp)
				assert.NoError(t, err)
				assert.Len(t, resp, tt.wantLen)
			}
		})
	}
}

func TestGetListing(t *testing.T) {
	tests := []struct {
		name       string
		listing    *listings.Listing
		findErr    error
		listingID  string
		wantStatus int
	}{
		{
			name:       "listing found returns 200",
			listing:    &listings.Listing{ID: "abc-123", Title: "Taladro"},
			listingID:  "abc-123",
			wantStatus: http.StatusOK,
		},
		{
			name:       "listing not found returns 404",
			listing:    nil,
			listingID:  "nonexistent",
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "repo error returns 500",
			findErr:    errors.New("db down"),
			listingID:  "abc-123",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{
				listing: tt.listing,
				findErr: tt.findErr,
			})

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
		findErr    error
		ownerID    string
		wantStatus int
		wantLen    int
	}{
		{
			name: "returns listings for owner",
			repoData: []listings.Listing{
				{ID: "1", OwnerID: "owner-1"},
				{ID: "2", OwnerID: "owner-2"},
			},
			ownerID:    "owner-1",
			wantStatus: http.StatusOK,
			wantLen:    2, // el handler devuelve lo que le dé el repo (no filtra aquí)
		},
		{
			name:       "repo error returns 500",
			findErr:    errors.New("db down"),
			ownerID:    "owner-1",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{
				listings: tt.repoData,
				findErr:  tt.findErr,
			})

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
		Photos:        []string{},
		DepositAmount: 10,
		Category:      "herramientas",
	}

	tests := []struct {
		name       string
		body       any
		createErr  error
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
			createErr:  errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var auth gin.HandlerFunc
			if tt.noAuth {
				auth = func(c *gin.Context) {
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
				}
			} else {
				auth = fakeAuthMiddleware(tt.userID)
			}

			router := setupRouterFull(
				&fakeRepository{
					createErr: tt.createErr,
					listing: &listings.Listing{
						ID:            "listing-1",
						OwnerID:       tt.userID,
						Title:         "Taladro",
						Description:   "Buen estado",
						Photos:        []string{},
						DepositAmount: 10,
						Category:      "herramientas",
						Status:        listings.StatusAvailable,
					},
				},
				&fakeStorageService{},
				auth,
			)

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
	existing := &listings.Listing{
		ID:            "1",
		OwnerID:       "owner-1",
		Title:         "Taladro",
		Description:   "Buen estado",
		Photos:        []string{},
		DepositAmount: 10,
		Category:      "herramientas",
		Status:        listings.StatusAvailable,
	}

	validBody := listings.ListingInput{
		Title:         "Taladro Pro",
		Description:   "Mejor",
		Photos:        []string{},
		DepositAmount: 20,
		Category:      "herramientas",
	}

	tests := []struct {
		name       string
		listingID  string
		body       any
		userID     string
		listing    *listings.Listing
		findErr    error
		updateErr  error
		wantStatus int
	}{
		{
			name:       "owner updates successfully",
			listingID:  "1",
			body:       validBody,
			userID:     "owner-1",
			listing:    existing,
			wantStatus: http.StatusOK,
		},
		{
			name:       "non-owner gets 403",
			listingID:  "1",
			body:       validBody,
			userID:     "other-user",
			listing:    existing,
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "listing not found returns 404",
			listingID:  "nonexistent",
			body:       validBody,
			userID:     "owner-1",
			listing:    nil,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "invalid body returns 400",
			listingID:  "1",
			body:       map[string]any{"title": ""},
			userID:     "owner-1",
			listing:    existing,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "find error returns 500",
			listingID:  "1",
			body:       validBody,
			userID:     "owner-1",
			listing:    existing,
			findErr:    errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "update error returns 500",
			listingID:  "1",
			body:       validBody,
			userID:     "owner-1",
			listing:    existing,
			updateErr:  errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{
				listing:   tt.listing,
				findErr:   tt.findErr,
				updateErr: tt.updateErr,
			}
			router := setupRouterWithAuth(repo, fakeAuthMiddleware(tt.userID))

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
	existing := &listings.Listing{
		ID:      "1",
		OwnerID: "owner-1",
		Title:   "Taladro",
	}

	tests := []struct {
		name       string
		listingID  string
		userID     string
		listing    *listings.Listing
		findErr    error
		deleteErr  error
		wantStatus int
	}{
		{
			name:       "owner deletes successfully",
			listingID:  "1",
			userID:     "owner-1",
			listing:    existing,
			wantStatus: http.StatusNoContent,
		},
		{
			name:       "non-owner gets 403",
			listingID:  "1",
			userID:     "other-user",
			listing:    existing,
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "listing not found returns 404",
			listingID:  "nonexistent",
			userID:     "owner-1",
			listing:    nil,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "find error returns 500",
			listingID:  "1",
			userID:     "owner-1",
			listing:    existing,
			findErr:    errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "delete error returns 500",
			listingID:  "1",
			userID:     "owner-1",
			listing:    existing,
			deleteErr:  errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{
				listing:   tt.listing,
				findErr:   tt.findErr,
				deleteErr: tt.deleteErr,
			}
			router := setupRouterWithAuth(repo, fakeAuthMiddleware(tt.userID))

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodDelete, "/api/listings/"+tt.listingID, nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

func TestUploadPhoto(t *testing.T) {
	existing := &listings.Listing{
		ID:      "1",
		OwnerID: "owner-1",
		Title:   "Taladro",
	}

	tests := []struct {
		name        string
		listingID   string
		userID      string
		listing     *listings.Listing
		findErr     error
		photoErr    error
		storageErr  error
		missingFile bool
		noAuth      bool
		wantStatus  int
	}{
		{
			name:       "owner uploads photo successfully",
			listingID:  "1",
			userID:     "owner-1",
			listing:    existing,
			wantStatus: http.StatusOK,
		},
		{
			name:       "missing auth returns 401",
			listingID:  "1",
			noAuth:     true,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "listing not found returns 404",
			listingID:  "nonexistent",
			userID:     "owner-1",
			listing:    nil,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "non-owner gets 403",
			listingID:  "1",
			userID:     "other-user",
			listing:    existing,
			wantStatus: http.StatusForbidden,
		},
		{
			name:        "missing file returns 400",
			listingID:   "1",
			userID:      "owner-1",
			listing:     existing,
			missingFile: true,
			wantStatus:  http.StatusBadRequest,
		},
		{
			name:       "storage error returns 500",
			listingID:  "1",
			userID:     "owner-1",
			listing:    existing,
			storageErr: errors.New("storage down"),
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "find error returns 500",
			listingID:  "1",
			userID:     "owner-1",
			listing:    existing,
			findErr:    errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "addphoto error returns 500",
			listingID:  "1",
			userID:     "owner-1",
			listing:    existing,
			photoErr:   errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{
				listing:  tt.listing,
				findErr:  tt.findErr,
				photoErr: tt.photoErr,
			}
			storage := &fakeStorageService{
				url: "https://example.com/photo.jpg",
				err: tt.storageErr,
			}

			var auth gin.HandlerFunc
			if tt.noAuth {
				auth = func(c *gin.Context) {
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
				}
			} else {
				auth = fakeAuthMiddleware(tt.userID)
			}
			router := setupRouterFull(repo, storage, auth)

			var reqBody io.Reader
			var contentType string

			if tt.missingFile {
				buf := &bytes.Buffer{}
				reqBody = buf
				contentType = "multipart/form-data; boundary=----boundary"
			} else {
				buf := &bytes.Buffer{}
				writer := multipart.NewWriter(buf)
				part, _ := writer.CreateFormFile("photo", "photo.jpg")
				_, err := part.Write([]byte("fake-image-content"))
				require.NoError(t, err)
				writer.Close()
				reqBody = buf
				contentType = writer.FormDataContentType()
			}

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/listings/"+tt.listingID+"/photos", reqBody)
			req.Header.Set("Content-Type", contentType)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}
