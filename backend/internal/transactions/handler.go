package transactions

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// pointsAdder is a narrow interface so the transactions package does not import the wallet package.
type pointsAdder interface {
	AddPoints(ctx context.Context, userID string, points int) error
}

// Handler holds the HTTP handlers for the transactions module.
type Handler struct {
	repo      Repository
	service   *Service
	walletSvc pointsAdder
}

// NewHandler creates a new Handler injecting the Repository, Service, and a pointsAdder.
func NewHandler(repo Repository, service *Service, walletSvc pointsAdder) *Handler {
	return &Handler{repo: repo, service: service, walletSvc: walletSvc}
}

// RegisterRoutes attaches the transactions routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	rg.GET("/transactions", h.listTransactions)
	rg.GET("/transactions/:id", h.getTransaction)
	rg.GET("/listings/:id/transactions", h.listByListing)
	rg.GET("/users/:id/transactions", h.listByBorrower)

	protected := rg.Group("/")
	protected.Use(authMiddleware)
	protected.POST("/transactions", h.createTransaction)
	protected.PUT("/transactions/:id/accept", h.acceptTransaction)
	protected.PUT("/transactions/:id/reject", h.rejectTransaction)
	protected.POST("/transactions/:id/handover", h.handoverTransaction)
	protected.POST("/transactions/:id/return", h.returnTransaction)
}

func (h *Handler) listTransactions(c *gin.Context) {
	transactions, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		slog.Error("failed to list transactions", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": transactions})
}

func (h *Handler) getTransaction(c *gin.Context) {
	id := c.Param("id")

	transaction, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		slog.Error("failed to get transaction", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if transaction == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "transaction not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": transaction})
}

func (h *Handler) listByListing(c *gin.Context) {
	listingID := c.Param("id")

	transactions, err := h.repo.FindByListing(c.Request.Context(), listingID)
	if err != nil {
		slog.Error("failed to list transactions by listing", "listing_id", listingID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": transactions})
}

func (h *Handler) listByBorrower(c *gin.Context) {
	borrowerID := c.Param("id")

	transactions, err := h.repo.FindByBorrower(c.Request.Context(), borrowerID)
	if err != nil {
		slog.Error("failed to list transactions by borrower", "borrower_id", borrowerID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": transactions})
}

func (h *Handler) createTransaction(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	borrowerID := userID.(string)

	var body struct {
		ListingID       string `json:"listing_id"`
		PaymentMethodID string `json:"payment_method_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		slog.Error("failed to parse create transaction body", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	t, err := h.repo.Create(c.Request.Context(), Transaction{
		ListingID:       body.ListingID,
		BorrowerID:      borrowerID,
		PaymentMethodID: body.PaymentMethodID,
	})
	if err != nil {
		slog.Error("failed to create transaction", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": t})
}

// parseDepositAmountCents reads deposit_amount_cents from the JSON body.
// Returns the amount and true on success; writes a 400 response and returns false on failure.
func (h *Handler) parseDepositAmountCents(c *gin.Context) (int64, bool) {
	var body struct {
		DepositAmountCents int64 `json:"deposit_amount_cents"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		slog.Error("failed to parse transaction body", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return 0, false
	}
	return body.DepositAmountCents, true
}

// handleServiceError maps service-layer errors to HTTP responses.
func (h *Handler) handleServiceError(c *gin.Context, action, id string, err error) {
	slog.Error("failed to "+action+" transaction", "id", id, "error", err)
	msg := err.Error()
	switch {
	case strings.Contains(msg, "not found"):
		c.JSON(http.StatusNotFound, gin.H{"error": msg})
	case strings.Contains(msg, "status"):
		c.JSON(http.StatusConflict, gin.H{"error": msg})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
	}
}

// requireOwner checks that the authenticated caller is the listing owner for the
// given transaction. It writes the appropriate error response and returns false
// when the caller should stop processing.
func (h *Handler) requireOwner(c *gin.Context, id string) bool {
	callerID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return false
	}
	ownerID, err := h.repo.FindListingOwnerByTransactionID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "transaction not found"})
		return false
	}
	if ownerID != callerID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return false
	}
	return true
}

func (h *Handler) acceptTransaction(c *gin.Context) {
	id := c.Param("id")
	if !h.requireOwner(c, id) {
		return
	}

	depositAmountCents, ok := h.parseDepositAmountCents(c)
	if !ok {
		return
	}

	if err := h.service.Accept(c.Request.Context(), id, depositAmountCents); err != nil {
		h.handleServiceError(c, "accept", id, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) rejectTransaction(c *gin.Context) {
	id := c.Param("id")
	if !h.requireOwner(c, id) {
		return
	}

	if err := h.service.Reject(c.Request.Context(), id); err != nil {
		h.handleServiceError(c, "reject", id, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) handoverTransaction(c *gin.Context) {
	id := c.Param("id")
	if !h.requireOwner(c, id) {
		return
	}

	if err := h.service.Handover(c.Request.Context(), id); err != nil {
		h.handleServiceError(c, "handover", id, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) returnTransaction(c *gin.Context) {
	id := c.Param("id")
	if !h.requireOwner(c, id) {
		return
	}

	depositAmountCents, ok := h.parseDepositAmountCents(c)
	if !ok {
		return
	}

	if err := h.service.Return(c.Request.Context(), id, depositAmountCents); err != nil {
		h.handleServiceError(c, "return", id, err)
		return
	}

	// requireOwner already validated that the caller IS the listing owner.
	ownerID := c.MustGet("userID").(string)
	pointsEarned := int(depositAmountCents * 5 / 100)
	if err := h.walletSvc.AddPoints(c.Request.Context(), ownerID, pointsEarned); err != nil {
		slog.Error("failed to award points after return", "transaction_id", id, "error", err)
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
