package users_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/isw2-unileon/neighborlink/backend/internal/users"
	"github.com/stretchr/testify/assert"
)

// --- Fakes ---

type fakeRepository struct {
	users []users.User
	err   error
}

func (f *fakeRepository) FindAll(ctx context.Context) ([]users.User, error) {
	return f.users, f.err
}

func (f *fakeRepository) FindByID(ctx context.Context, id string) (*users.User, error) {
	if f.err != nil {
		return nil, f.err
	}
	for _, u := range f.users {
		if u.ID == id {
			return &u, nil
		}
	}
	return nil, nil
}

func (f *fakeRepository) Update(ctx context.Context, id string, input users.UpdateUserInput) (*users.User, error) {
	if f.err != nil {
		return nil, f.err
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

// authMiddlewareWithUser inyecta un userID fijo en el contexto de Gin,
// simulando un token JWT válido en tests de rutas protegidas.
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
		repoErr    error
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
			repoErr:    errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{users: tt.repoUsers, err: tt.repoErr}, &fakeStorageService{})

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
		repoErr    error
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
			repoErr:    errors.New("db down"),
			userID:     "abc-123",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{users: tt.repoUsers, err: tt.repoErr}, &fakeStorageService{})

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
		repoErr    error
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
			name:       "user not found returns 404",
			repoUsers:  []users.User{},
			body:       map[string]string{"name": "New Name"},
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "repo error returns 500",
			repoErr:    errors.New("db down"),
			body:       map[string]string{"name": "New Name"},
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{users: tt.repoUsers, err: tt.repoErr}, &fakeStorageService{})

			bodyBytes, _ := json.Marshal(tt.body)
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPut, "/api/users/me", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}
