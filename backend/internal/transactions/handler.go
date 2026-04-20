package transactions

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Handler holds the HTTP handlers for the transactions module.
type Handler struct {
	repo    Repository
	service *Service
}

// NewHandler creates a new Handler injecting the Repository interface and the Service.
func NewHandler(repo Repository, service *Service) *Handler {
	return &Handler{repo: repo, service: service}
}

// RegisterRoutes attaches the transactions routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/transactions", h.listTransactions)
	rg.GET("/transactions/:id", h.getTransaction)
	rg.GET("/listings/:id/transactions", h.listByListing)
	rg.GET("/users/:id/transactions", h.listByBorrower)
	rg.POST("/transactions", h.createTransaction)
	rg.POST("/transactions/:id/handover", h.handoverTransaction)
	rg.POST("/transactions/:id/return", h.returnTransaction)
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
	var body struct {
		ListingID          string `json:"listing_id"`
		BorrowerID         string `json:"borrower_id"`
		PaymentMethodID    string `json:"payment_method_id"`
		DepositAmountCents int64  `json:"deposit_amount_cents"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		slog.Error("failed to parse create transaction body", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: when JWT is implemented, borrower_id must be extracted from the token,
	// not from the body or the X-User-ID header.
	borrowerID := c.GetHeader("X-User-ID")
	if borrowerID == "" {
		borrowerID = body.BorrowerID
	}

	t, err := h.service.AgreeDeal(c.Request.Context(), body.ListingID, borrowerID, body.PaymentMethodID, body.DepositAmountCents)
	if err != nil {
		slog.Error("failed to agree deal", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": t})
}

func (h *Handler) handoverTransaction(c *gin.Context) {
	id := c.Param("id")

	// TODO: when JWT is implemented, validate that the caller is the owner of the listing.
	_ = c.GetHeader("X-User-ID")

	if err := h.service.Handover(c.Request.Context(), id); err != nil {
		slog.Error("failed to handover transaction", "id", id, "error", err)
		msg := err.Error()
		switch {
		case strings.Contains(msg, "not found"):
			c.JSON(http.StatusNotFound, gin.H{"error": msg})
		case strings.Contains(msg, "status"):
			c.JSON(http.StatusConflict, gin.H{"error": msg})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) returnTransaction(c *gin.Context) {
	id := c.Param("id")

	// TODO: when JWT is implemented, validate that the caller is the owner of the listing.
	_ = c.GetHeader("X-User-ID")

	var body struct {
		DepositAmountCents int64 `json:"deposit_amount_cents"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		slog.Error("failed to parse return transaction body", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.Return(c.Request.Context(), id, body.DepositAmountCents); err != nil {
		slog.Error("failed to return transaction", "id", id, "error", err)
		msg := err.Error()
		switch {
		case strings.Contains(msg, "not found"):
			c.JSON(http.StatusNotFound, gin.H{"error": msg})
		case strings.Contains(msg, "status"):
			c.JSON(http.StatusConflict, gin.H{"error": msg})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
