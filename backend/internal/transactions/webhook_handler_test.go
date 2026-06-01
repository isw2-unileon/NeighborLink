package transactions_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
	"github.com/stripe/stripe-go/v76"
	"github.com/stretchr/testify/assert"
)

type fakeVerifier struct {
	event stripe.Event
	err   error
}

func (f *fakeVerifier) ConstructEvent(_ []byte, _, _ string) (stripe.Event, error) {
	return f.event, f.err
}

func setupWebhookRouter(v *fakeVerifier, repo transactions.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := transactions.NewWebhookHandler(v, repo, "whsec_test")
	h.RegisterRoutes(r.Group("/api"))
	return r
}

func stripeEvent(eventType string, rawData any) stripe.Event {
	raw, _ := json.Marshal(rawData)
	return stripe.Event{
		Type: stripe.EventType(eventType),
		Data: &stripe.EventData{Raw: raw},
	}
}

func TestWebhookHandler(t *testing.T) {
	tests := []struct {
		name         string
		verifier     *fakeVerifier
		repo         *fakeRepository
		body         string
		wantStatus   int
		wantCancelled bool
	}{
		{
			name:       "invalid signature returns 400",
			verifier:   &fakeVerifier{err: errors.New("bad signature")},
			repo:       &fakeRepository{},
			body:       "{}",
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "payment_intent.payment_failed cancels transaction",
			verifier: &fakeVerifier{
				event: stripeEvent("payment_intent.payment_failed", stripe.PaymentIntent{ID: "pi_123"}),
			},
			repo:          &fakeRepository{},
			body:          "{}",
			wantStatus:    http.StatusOK,
			wantCancelled: true,
		},
		{
			name: "payment_intent.payment_failed with repo error still returns 200",
			verifier: &fakeVerifier{
				event: stripeEvent("payment_intent.payment_failed", stripe.PaymentIntent{ID: "pi_456"}),
			},
			repo:       &fakeRepository{err: errors.New("db error")},
			body:       "{}",
			wantStatus: http.StatusOK,
		},
		{
			name: "charge.dispute.created returns 200",
			verifier: &fakeVerifier{
				event: stripeEvent("charge.dispute.created", stripe.Dispute{ID: "dp_abc"}),
			},
			repo:       &fakeRepository{},
			body:       "{}",
			wantStatus: http.StatusOK,
		},
		{
			name: "unknown event type returns 200",
			verifier: &fakeVerifier{
				event: stripeEvent("customer.created", map[string]string{}),
			},
			repo:       &fakeRepository{},
			body:       "{}",
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupWebhookRouter(tt.verifier, tt.repo)
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/stripe/webhook", strings.NewReader(tt.body))
			req.Header.Set("Stripe-Signature", "t=1,v1=abc")
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}
