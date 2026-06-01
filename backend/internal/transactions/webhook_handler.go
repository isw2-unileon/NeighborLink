package transactions

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v76"
)

type webhookVerifier interface {
	ConstructEvent(payload []byte, sigHeader, secret string) (stripe.Event, error)
}

// WebhookHandler handles incoming Stripe webhook events.
type WebhookHandler struct {
	verifier webhookVerifier
	repo     Repository
	secret   string
}

// NewWebhookHandler returns a WebhookHandler wired to the given verifier, repo, and webhook secret.
func NewWebhookHandler(verifier webhookVerifier, repo Repository, secret string) *WebhookHandler {
	return &WebhookHandler{verifier: verifier, repo: repo, secret: secret}
}

// RegisterRoutes mounts the webhook endpoint. No auth middleware — Stripe calls this directly.
func (h *WebhookHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/stripe/webhook", h.handle)
}

func (h *WebhookHandler) handle(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	event, err := h.verifier.ConstructEvent(body, c.GetHeader("Stripe-Signature"), h.secret)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	switch event.Type {
	case "payment_intent.payment_failed":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			slog.Error("webhook: failed to parse payment_intent", "error", err)
			break
		}
		if err := h.repo.CancelByPaymentIntentID(c.Request.Context(), pi.ID); err != nil {
			slog.Error("webhook: failed to cancel transaction", "payment_intent_id", pi.ID, "error", err)
		}

	case "charge.dispute.created":
		var dispute stripe.Dispute
		if err := json.Unmarshal(event.Data.Raw, &dispute); err != nil {
			slog.Warn("webhook: failed to parse dispute", "error", err)
			break
		}
		slog.Warn("charge disputed — review required", "dispute_id", dispute.ID, "charge_id", dispute.Charge.ID)
	}

	c.Status(http.StatusOK)
}
