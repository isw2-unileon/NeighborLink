package users_test

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
	"github.com/isw2-unileon/neighborlink/backend/internal/users"
	"github.com/stretchr/testify/assert"
)

// --- Fakes ---

type fakeRepository struct {
	users     []users.User
	findErr   error // error en FindByID y FindAll
	updateErr error // error en Update
}

func (f *fakeRepository) FindAll(ctx context.Context) ([]users.User, error) {
	return f.users, f.findErr
}

func (f *fakeRepository) FindByID(ctx context.Context, id string) (*users.User, error) {
	if f.findErr != nil {
		return nil, f.findErr
	}
	for _, u := range f.users {
		if u.ID == id {
			return &u, nil
		}
	}
	return nil, nil
}

func (f *fakeRepository) Update(ctx context.Context, id string, input users.UpdateUserInput) (*users.User, error) {
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	for i, u := range f.users {
		if u.ID == id {
			f.users[i].Name = input.Name
			f.users[i].AvatarURL = input.AvatarURL
			f.users[i].Address = input.Address
			return &f.users[i], nil
		}
	}
	return nil, nil
}

// fakeStorageService implementa StorageService sin llamar a Supabase.
type fakeStorageService struct {
	url string
	err error
}

func (f *fakeStorageService) UploadAvatar(userID, filename string, content io.Reader, contentType string) (string, error) {
	return f.url, f.err
}

// --- Setup helpers ---

func authMiddlewareWithUser(userID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	}
}

func setupRouter(repo users.Repository, storage users.StorageService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := users.NewHandler(repo, storage)
	api := r.Group("/api")
	h.RegisterRoutes(api, authMiddlewareWithUser("test-user-id"))
	return r
}

// --- Tests ---

func TestListUsers(t *testing.T) {
	tests := []struct {
		name       string
		repoUsers  []users.User
		findErr    error
		wantStatus int
		wantLen    int
	}{
		{
			name:       "returns empty list",
			repoUsers:  []users.User{},
			wantStatus: http.StatusOK,
			wantLen:    0,
		},
		{
			name:       "returns list with users",
			repoUsers:  []users.User{{ID: "1", Name: "Alice"}, {ID: "2", Name: "Bob"}},
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
			router := setupRouter(&fakeRepository{users: tt.repoUsers, findErr: tt.findErr}, &fakeStorageService{})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var resp struct {
					Data []users.User `json:"data"`
				}
				err := json.NewDecoder(w.Body).Decode(&resp)
				assert.NoError(t, err)
				assert.Len(t, resp.Data, tt.wantLen)
			}
		})
	}
}

func TestGetUser(t *testing.T) {
	tests := []struct {
		name       string
		repoUsers  []users.User
		findErr    error
		userID     string
		wantStatus int
	}{
		{
			name:       "user found returns 200",
			repoUsers:  []users.User{{ID: "abc-123", Name: "Alice"}},
			userID:     "abc-123",
			wantStatus: http.StatusOK,
		},
		{
			name:       "user not found returns 404",
			repoUsers:  []users.User{},
			userID:     "nonexistent",
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "repo error returns 500",
			findErr:    errors.New("db down"),
			userID:     "abc-123",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{users: tt.repoUsers, findErr: tt.findErr}, &fakeStorageService{})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/users/"+tt.userID, nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

func TestUpdateMe(t *testing.T) {
	tests := []struct {
		name       string
		repoUsers  []users.User
		findErr    error
		updateErr  error
		body       map[string]string
		wantStatus int
	}{
		{
			name:       "updates user successfully",
			repoUsers:  []users.User{{ID: "test-user-id", Name: "Old Name"}},
			body:       map[string]string{"name": "New Name"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid body returns 400",
			repoUsers:  []users.User{{ID: "test-user-id", Name: "Alice"}},
			body:       map[string]string{},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "user not found returns 404",
			repoUsers:  []users.User{},
			body:       map[string]string{"name": "New Name"},
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "find error returns 500",
			findErr:    errors.New("db down"),
			body:       map[string]string{"name": "New Name"},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "update error returns 500",
			repoUsers:  []users.User{{ID: "test-user-id", Name: "Alice"}},
			updateErr:  errors.New("db down"),
			body:       map[string]string{"name": "New Name"},
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(
				&fakeRepository{users: tt.repoUsers, findErr: tt.findErr, updateErr: tt.updateErr},
				&fakeStorageService{},
			)

			bodyBytes, _ := json.Marshal(tt.body)
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPut, "/api/users/me", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

func TestUploadAvatar(t *testing.T) {
	tests := []struct {
		name        string
		repoUsers   []users.User
		storageErr  error
		updateErr   error
		missingFile bool
		noAuth      bool
		wantStatus  int
	}{
		{
			name:       "uploads avatar successfully",
			repoUsers:  []users.User{{ID: "test-user-id", Name: "Alice", AvatarURL: "old.jpg"}},
			wantStatus: http.StatusOK,
		},
		{
			name:       "missing auth returns 401",
			noAuth:     true,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:        "missing file returns 400",
			repoUsers:   []users.User{{ID: "test-user-id", Name: "Alice"}},
			missingFile: true,
			wantStatus:  http.StatusBadRequest,
		},
		{
			name:       "storage error returns 500",
			repoUsers:  []users.User{{ID: "test-user-id", Name: "Alice"}},
			storageErr: errors.New("storage down"),
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "update error after upload returns 500",
			repoUsers:  []users.User{{ID: "test-user-id", Name: "Alice"}},
			updateErr:  errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{users: tt.repoUsers, updateErr: tt.updateErr}
			storage := &fakeStorageService{url: "https://cdn.example.com/new-avatar.jpg", err: tt.storageErr}

			gin.SetMode(gin.TestMode)
			r := gin.New()
			h := users.NewHandler(repo, storage)
			api := r.Group("/api")

			if tt.noAuth {
				h.RegisterRoutes(api, func(c *gin.Context) { c.Next() })
			} else {
				h.RegisterRoutes(api, authMiddlewareWithUser("test-user-id"))
			}

			var reqBody io.Reader
			var contentType string

			if tt.missingFile {
				reqBody = &bytes.Buffer{}
				contentType = "multipart/form-data; boundary=----boundary"
			} else {
				buf := &bytes.Buffer{}
				writer := multipart.NewWriter(buf)
				part, _ := writer.CreateFormFile("avatar", "avatar.jpg")
				part.Write([]byte("fake-image-content"))
				writer.Close()
				reqBody = buf
				contentType = writer.FormDataContentType()
			}

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/users/me/avatar", reqBody)
			req.Header.Set("Content-Type", contentType)
			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}
