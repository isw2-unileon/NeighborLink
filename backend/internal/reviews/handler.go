package reviews

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler holds the HTTP handlers for the reviews module.
type Handler struct {
	repo Repository
}

// NewHandler creates a new Handler injecting the Repository interface.
func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes attaches the reviews routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/transactions/:id/reviews", h.listByTransaction)
	rg.GET("/users/:id/reviews", h.listByReviewed)
	rg.GET("/reviews/:id", h.getReview)
}

func (h *Handler) listByTransaction(c *gin.Context) {
	transactionID := c.Param("id")

	reviews, err := h.repo.FindByTransaction(c.Request.Context(), transactionID)
	if err != nil {
		slog.Error("failed to list reviews by transaction", "transaction_id", transactionID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": reviews})
}

func (h *Handler) listByReviewed(c *gin.Context) {
	reviewedID := c.Param("id")

	reviews, err := h.repo.FindByReviewed(c.Request.Context(), reviewedID)
	if err != nil {
		slog.Error("failed to list reviews by reviewed user", "reviewed_id", reviewedID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": reviews})
}

func (h *Handler) getReview(c *gin.Context) {
	id := c.Param("id")

	review, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		slog.Error("failed to get review", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if review == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "review not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": review})
}
