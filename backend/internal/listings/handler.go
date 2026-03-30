package listings

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler holds the HTTP handlers for the listings module.
type Handler struct {
	repo Repository
}

// NewHandler creates a new Handler injecting the Repository interface.
func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes attaches the listings routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/listings", h.listListings)
	rg.GET("/listings/:id", h.getListing)
	rg.GET("/users/:id/listings", h.listByOwner)
}

func (h *Handler) listListings(c *gin.Context) {
	listings, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		slog.Error("failed to list listings", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": listings})
}

func (h *Handler) getListing(c *gin.Context) {
	id := c.Param("id")

	listing, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		slog.Error("failed to get listing", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if listing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "listing not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": listing})
}

func (h *Handler) listByOwner(c *gin.Context) {
	ownerID := c.Param("id")

	listings, err := h.repo.FindByOwner(c.Request.Context(), ownerID)
	if err != nil {
		slog.Error("failed to list listings by owner", "owner_id", ownerID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": listings})
}
