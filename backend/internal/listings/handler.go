package listings

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler holds the HTTP handlers for the listings module.
type Handler struct {
	repo           Repository
	storageService StorageService
}

// NewHandler creates a new Handler injecting the Repository interface.
func NewHandler(repo Repository, storageService StorageService) *Handler {
	return &Handler{repo: repo, storageService: storageService}
}

// RegisterRoutes attaches the listings routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	rg.GET("/listings", h.listListings)
	rg.GET("/listings/:id", h.getListing)
	rg.GET("/users/:id/listings", h.listByOwner)

	protected := rg.Group("/")
	protected.Use(authMiddleware)
	protected.POST("/listings", h.createListing)
	protected.POST("/listings/:id/photos", h.uploadPhoto)
	protected.PUT("/listings/:id", h.updateListing)
	protected.DELETE("/listings/:id", h.deleteListing)
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

func (h *Handler) uploadPhoto(c *gin.Context) {
	id := c.Param("id")
	ownerID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Verificar que el listing existe y pertenece al usuario
	existing, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
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

	file, header, err := c.Request.FormFile("photo")
	if err != nil {
		slog.Error("failed to parse form file", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo file is required"})
		return
	}
	slog.Info("photo received", "filename", header.Filename, "content-type", header.Header.Get("Content-Type"), "size", header.Size)
	defer file.Close()

	photoURL, err := h.storageService.UploadPhoto(id, header.Filename, file, header.Header.Get("Content-Type"))
	if err != nil {
		slog.Error("failed to upload photo", "listing_id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload photo"})
		return
	}

	updated, err := h.repo.AddPhoto(c.Request.Context(), id, photoURL)
	if err != nil {
		slog.Error("failed to save photo url", "listing_id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": updated})
}
