package messages_test

import (
	"bytes"
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

// --- Fakes ---

type fakeAdminChecker struct {
	isAdmin bool
}

func (f *fakeAdminChecker) IsAdmin(_ context.Context, _ string) (bool, error) {
	return f.isAdmin, nil
}

type fakeRepository struct {
	messages []messages.Message
	err      error
}

func (f *fakeRepository) FindByTransaction(_ context.Context, transactionID string) ([]messages.Message, error) {
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

func (f *fakeRepository) FindByID(_ context.Context, id string) (*messages.Message, error) {
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

func (f *fakeRepository) Create(_ context.Context, m messages.Message) (*messages.Message, error) {
	if f.err != nil {
		return nil, f.err
	}
	m.ID = "new-id"
	return &m, nil
}

func (f *fakeRepository) FindActiveByParticipant(_ context.Context, _ string) ([]messages.Message, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.messages, nil
}

type fakeTxReader struct {
	summary         *messages.TransactionSummary
	err             error
	updateStatusErr error
}

func (f *fakeTxReader) UpdateStatus(_ context.Context, _ string, _ string) error {
	return f.updateStatusErr
}

func (f *fakeTxReader) FindByID(_ context.Context, _ string) (*messages.TransactionSummary, error) {
	return f.summary, f.err
}

// --- Setup ---

// injectUser es un middleware de test que inyecta un userID fijo en el contexto.
func injectUser(userID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	}
}

func setupRouter(repo messages.Repository, txReader messages.TransactionReader) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// Default to non-admin
	h := messages.NewHandler(repo, txReader, &fakeAdminChecker{isAdmin: false})
	api := r.Group("/api")
	h.RegisterRoutes(api, injectUser("user-1"))
	return r
}

// --- Tests existentes ---

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
			router := setupRouter(&fakeRepository{messages: tt.repoData, err: tt.repoErr}, &fakeTxReader{})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/transactions/"+tt.transactionID+"/messages", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			if tt.wantStatus == http.StatusOK {
				var resp struct {
					Data []messages.Message `json:"data"`
				}
				assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
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
			router := setupRouter(&fakeRepository{messages: tt.repoData, err: tt.repoErr}, &fakeTxReader{})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/messages/"+tt.messageID, nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

// --- Tests nuevos ---

func TestCreateMessage(t *testing.T) {
	tests := []struct {
		name       string
		senderID   string
		txSummary  *messages.TransactionSummary
		txErr      error
		repoErr    error
		body       map[string]string
		wantStatus int
	}{
		{
			name:       "borrower sends message in active transaction",
			senderID:   "user-1",
			txSummary:  &messages.TransactionSummary{BorrowerID: "user-1", OwnerID: "user-2", Status: "agreed"},
			body:       map[string]string{"content": "Hola!"},
			wantStatus: http.StatusCreated,
		},
		{
			name:       "owner sends message in handed_over transaction",
			senderID:   "user-2",
			txSummary:  &messages.TransactionSummary{BorrowerID: "user-1", OwnerID: "user-2", Status: "handed_over"},
			body:       map[string]string{"content": "¿Todo bien?"},
			wantStatus: http.StatusCreated,
		},
		{
			name:       "transaction not active returns 409",
			senderID:   "user-1",
			txSummary:  &messages.TransactionSummary{BorrowerID: "user-1", OwnerID: "user-2", Status: "returned"},
			body:       map[string]string{"content": "Hola"},
			wantStatus: http.StatusConflict,
		},
		{
			name:       "non-participant returns 403",
			senderID:   "user-1",
			txSummary:  &messages.TransactionSummary{BorrowerID: "user-99", OwnerID: "user-2", Status: "agreed"},
			body:       map[string]string{"content": "Intruso"},
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "transaction not found returns 404",
			senderID:   "user-1",
			txSummary:  nil,
			body:       map[string]string{"content": "Hola"},
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "missing content returns 400",
			senderID:   "user-1",
			txSummary:  &messages.TransactionSummary{BorrowerID: "user-1", OwnerID: "user-2", Status: "agreed"},
			body:       map[string]string{},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "repo error on create returns 500",
			senderID:   "user-1",
			txSummary:  &messages.TransactionSummary{BorrowerID: "user-1", OwnerID: "user-2", Status: "agreed"},
			repoErr:    errors.New("db down"),
			body:       map[string]string{"content": "Hola"},
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{err: tt.repoErr}
			txReader := &fakeTxReader{summary: tt.txSummary, err: tt.txErr}

			gin.SetMode(gin.TestMode)
			r := gin.New()
			// Default to non-admin
			h := messages.NewHandler(repo, txReader, &fakeAdminChecker{isAdmin: false})
			api := r.Group("/api")
			h.RegisterRoutes(api, injectUser(tt.senderID))

			bodyBytes, _ := json.Marshal(tt.body)
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/transactions/tx-1/messages", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

func TestListActiveChats(t *testing.T) {
	tests := []struct {
		name       string
		repoData   []messages.Message
		repoErr    error
		wantStatus int
		wantLen    int
	}{
		{
			name:       "returns active chats for user",
			repoData:   []messages.Message{{ID: "1", TransactionID: "tx-1"}, {ID: "2", TransactionID: "tx-2"}},
			wantStatus: http.StatusOK,
			wantLen:    2,
		},
		{
			name:       "returns empty list when no active chats",
			repoData:   []messages.Message{},
			wantStatus: http.StatusOK,
			wantLen:    0,
		},
		{
			name:       "repo error returns 500",
			repoErr:    errors.New("db down"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{messages: tt.repoData, err: tt.repoErr}
			router := setupRouter(repo, &fakeTxReader{})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/chats", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			if tt.wantStatus == http.StatusOK {
				var resp struct {
					Data []messages.Message `json:"data"`
				}
				assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
				assert.Len(t, resp.Data, tt.wantLen)
			}
		})
	}
}
