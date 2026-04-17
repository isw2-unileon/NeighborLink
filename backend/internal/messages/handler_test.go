package messages_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/isw2-unileon/neighborlink/backend/internal/messages"
	"github.com/stretchr/testify/assert"
)

type fakeRepository struct {
	messages []messages.Message
	err      error
}

func (f *fakeRepository) FindByTransaction(ctx context.Context, transactionID string) ([]messages.Message, error) {
	if f.err != nil {
		return nil, f.err
	}
	var result []messages.Message
	for _, m := range f.messages {
		if m.TransactionID == transactionID {
			result = append(result, m)
		}
	}
	return result, nil
}

func (f *fakeRepository) FindByID(ctx context.Context, id string) (*messages.Message, error) {
	if f.err != nil {
		return nil, f.err
	}
	for _, m := range f.messages {
		if m.ID == id {
			return &m, nil
		}
	}
	return nil, nil
}

func setupRouter(repo messages.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := messages.NewHandler(repo)
	api := r.Group("/api")
	h.RegisterRoutes(api)
	return r
}

func TestListByTransaction(t *testing.T) {
	tests := []struct {
		name          string
		repoData      []messages.Message
		repoErr       error
		transactionID string
		wantStatus    int
		wantLen       int
	}{
		{
			name:          "returns messages for transaction",
			repoData:      []messages.Message{{ID: "1", TransactionID: "tx-1"}, {ID: "2", TransactionID: "tx-2"}},
			transactionID: "tx-1",
			wantStatus:    http.StatusOK,
			wantLen:       1,
		},
		{
			name:          "returns empty list when no messages",
			repoData:      []messages.Message{},
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
			router := setupRouter(&fakeRepository{messages: tt.repoData, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/transactions/"+tt.transactionID+"/messages", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var resp struct {
					Data []messages.Message `json:"data"`
				}
				err := json.NewDecoder(w.Body).Decode(&resp)
				assert.NoError(t, err)
				assert.Len(t, resp.Data, tt.wantLen)
			}
		})
	}
}

func TestGetMessage(t *testing.T) {
	tests := []struct {
		name       string
		repoData   []messages.Message
		repoErr    error
		messageID  string
		wantStatus int
	}{
		{
			name:       "message found returns 200",
			repoData:   []messages.Message{{ID: "abc-123", Content: "Hola"}},
			messageID:  "abc-123",
			wantStatus: http.StatusOK,
		},
		{
			name:       "message not found returns 404",
			repoData:   []messages.Message{},
			messageID:  "nonexistent",
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "repo error returns 500",
			repoErr:    errors.New("db down"),
			messageID:  "abc-123",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupRouter(&fakeRepository{messages: tt.repoData, err: tt.repoErr})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/messages/"+tt.messageID, nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}
