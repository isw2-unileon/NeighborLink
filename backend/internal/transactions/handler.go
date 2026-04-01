package transactions

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler holds the HTTP handlers for the transactions module.
type Handler struct {
	repo Repository
}

// NewHandler creates a new Handler injecting the Repository interface.
func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes attaches the transactions routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/transactions", h.listTransactions)
	rg.GET("/transactions/:id", h.getTransaction)
	rg.GET("/listings/:id/transactions", h.listByListing)
	rg.GET("/users/:id/transactions", h.listByBorrower)
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
