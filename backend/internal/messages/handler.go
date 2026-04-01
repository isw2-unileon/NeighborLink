package messages

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler holds the HTTP handlers for the messages module.
type Handler struct {
	repo Repository
}

// NewHandler creates a new Handler injecting the Repository interface.
func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes attaches the messages routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/transactions/:id/messages", h.listByTransaction)
	rg.GET("/messages/:id", h.getMessage)
}

func (h *Handler) listByTransaction(c *gin.Context) {
	transactionID := c.Param("id")

	messages, err := h.repo.FindByTransaction(c.Request.Context(), transactionID)
	if err != nil {
		slog.Error("failed to list messages", "transaction_id", transactionID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": messages})
}

func (h *Handler) getMessage(c *gin.Context) {
	id := c.Param("id")

	message, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		slog.Error("failed to get message", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if message == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": message})
}
