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
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	rg.GET("/listings", h.listListings)
	rg.GET("/listings/:id", h.getListing)
	rg.GET("/users/:id/listings", h.listByOwner)

	protected := rg.Group("/")
	protected.Use(authMiddleware)
	{
		protected.POST("/listings", h.createListing)
		protected.PUT("/listings/:id", h.updateListing)
		protected.DELETE("/listings/:id", h.deleteListing)
	}
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

func (h *Handler) createListing(c *gin.Context) {
	ownerID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input ListingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	listing, err := h.repo.Create(c.Request.Context(), ownerID.(string), input)
	if err != nil {
		slog.Error("failed to create listing", "owner_id", ownerID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": listing})
}

func (h *Handler) updateListing(c *gin.Context) {
	id := c.Param("id")
	ownerID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	existing, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		slog.Error("failed to fetch listing for update", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "listing not found"})
		return
	}
	if existing.OwnerID != ownerID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var input ListingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.repo.Update(c.Request.Context(), id, input)
	if err != nil {
		slog.Error("failed to update listing", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": updated})
}

func (h *Handler) deleteListing(c *gin.Context) {
	id := c.Param("id")
	ownerID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	existing, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		slog.Error("failed to fetch listing for delete", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "listing not found"})
		return
	}
	if existing.OwnerID != ownerID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		slog.Error("failed to delete listing", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
