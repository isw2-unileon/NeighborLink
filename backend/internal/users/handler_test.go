package users_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/isw2-unileon/neighborlink/backend/internal/users"
	"github.com/stretchr/testify/assert"
)

// fakeRepository es un Fake en memoria.
// Implementa la interfaz Repository sin tocar la base de datos real.
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

func setupRouter(repo users.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := users.NewHandler(repo)
	api := r.Group("/api")
	h.RegisterRoutes(api)
	return r
}

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
			router := setupRouter(&fakeRepository{users: tt.repoUsers, err: tt.repoErr})

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
			router := setupRouter(&fakeRepository{users: tt.repoUsers, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/users/"+tt.userID, nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}
