package listings

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
)

// NotificationCreator defines the interface for creating notifications from the listings module.
type NotificationCreator interface {
	Create(ctx context.Context, userID, typ string, payload map[string]any) error
}

// TransactionLister defines the interface for checking transactions.
type TransactionLister interface {
	FindByListing(ctx context.Context, listingID string) ([]transactions.Transaction, error)
}

// AdminChecker defines the interface for checking if a user has administrative privileges.
type AdminChecker interface {
	IsAdmin(ctx context.Context, userID string) (bool, error)
}

// Handler defines the HTTP handlers for listings-related endpoints.
type Handler struct {
	repo             Repository
	storageSvc       StorageService
	notificationsSvc NotificationCreator
	adminSvc         AdminChecker
	txLister         TransactionLister
}

// NewHandler creates a new Handler with the given dependencies.
func NewHandler(repo Repository, storageSvc StorageService, notificationsSvc NotificationCreator, adminSvc AdminChecker, txLister TransactionLister) *Handler {
	return &Handler{
		repo:             repo,
		storageSvc:       storageSvc,
		notificationsSvc: notificationsSvc,
		adminSvc:         adminSvc,
		txLister:         txLister,
	}
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

func (h Handler) listListings(c *gin.Context) {
	var f FilterParams

	f.Category = Category(c.Query("category"))
	f.Status = c.Query("status")
	f.ExcludeOwnerID = c.Query("exclude_owner_id")

	if v := c.Query("deposit_min"); v != "" {
		if p, err := strconv.ParseFloat(v, 64); err == nil {
			f.MinDeposit = p
		}
	}
	if v := c.Query("deposit_max"); v != "" {
		if p, err := strconv.ParseFloat(v, 64); err == nil {
			f.MaxDeposit = p
		}
	} else if v := c.Query("deposit"); v != "" {
		if p, err := strconv.ParseFloat(v, 64); err == nil {
			f.MaxDeposit = p
		}
	}

	if f.Category != "" && !IsValidCategory(f.Category) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "categoría no válida"})
		return
	}

	result, err := h.repo.FindAll(c.Request.Context(), f)
	if err != nil {
		slog.Error("listListings failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, result)
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

	if h.notificationsSvc != nil {
		err := h.notificationsSvc.Create(c.Request.Context(), ownerID.(string), "listing_created", map[string]any{
			"listing_id":    listing.ID,
			"listing_title": listing.Title,
		})
		if err != nil {
			slog.Error("failed to create notification", "owner_id", ownerID, "listing_id", listing.ID, "error", err)
		}
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
	userID, ok := c.Get("userID")
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

	isAdmin := false
	if h.adminSvc != nil {
		isAdmin, _ = h.adminSvc.IsAdmin(c.Request.Context(), userID.(string))
	}

	isOwner := existing.OwnerID == userID.(string)

	if !isOwner && !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&body) // Optional for owners, recommended for admins

	// Verificar transacciones pendientes
	txs, err := h.txLister.FindByListing(c.Request.Context(), id)
	if err == nil {
		for _, tx := range txs {
			if tx.Status != "returned" && tx.Status != "cancelled" && tx.Status != "pending_review" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "No se puede eliminar el listing porque tiene transacciones pendientes"})
				return
			}
		}
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		slog.Error("failed to delete listing", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Notificar al dueño si fue borrado por un administrador
	if isAdmin && !isOwner && h.notificationsSvc != nil {
		reason := body.Reason
		if reason == "" {
			reason = "Incumplimiento de las normas de la comunidad."
		}
		_ = h.notificationsSvc.Create(c.Request.Context(), existing.OwnerID, "listing_deleted_by_admin", map[string]any{
			"listing_title": existing.Title,
			"reason":        reason,
		})
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

	photoURL, err := h.storageSvc.UploadPhoto(id, header.Filename, file, header.Header.Get("Content-Type"))
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
