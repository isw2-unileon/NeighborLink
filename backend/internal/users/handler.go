package users

import (
	"io"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// StorageService defines the contract for uploading user avatars.
// Mismo patrón que listings — DIP: el handler depende de la interfaz, no de Supabase.
type StorageService interface {
	UploadAvatar(userID string, filename string, content io.Reader, contentType string) (string, error)
}

// Handler holds the HTTP handler for the users module.
type Handler struct {
	repo           Repository
	storageService StorageService
}

// NewHandler creates a new Handler injecting the Repository interface.
func NewHandler(repo Repository, storageService StorageService) *Handler {
	return &Handler{repo: repo, storageService: storageService}
}

// RegisterRoutes attaches the user routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	rg.GET("/users", h.listUsers)
	rg.GET("/users/:id", h.getUser)

	protected := rg.Group("/")
	protected.Use(authMiddleware)
	protected.PUT("/users/me", h.updateMe)
	protected.POST("/users/me/avatar", h.uploadAvatar)
}

func (h *Handler) listUsers(c *gin.Context) {
	users, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		slog.Error("failed to list users", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": users})
}

func (h *Handler) getUser(c *gin.Context) {
	id := c.Param("id")

	user, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		slog.Error("failed to get user", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}

func (h *Handler) updateMe(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input UpdateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	existing, err := h.repo.FindByID(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	input.AvatarURL = existing.AvatarURL

	updated, err := h.repo.Update(c.Request.Context(), userID.(string), input)
	if err != nil {
		slog.Error("failed to update user", "id", userID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if updated == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": updated})
}

func (h *Handler) uploadAvatar(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	file, header, err := c.Request.FormFile("avatar")
	if err != nil {
		slog.Error("failed to parse avatar file", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "avatar file is required"})
		return
	}
	defer file.Close()

	avatarURL, err := h.storageService.UploadAvatar(userID.(string), header.Filename, file, header.Header.Get("Content-Type"))
	if err != nil {
		slog.Error("failed to upload avatar", "user_id", userID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload avatar"})
		return
	}

	// Actualizamos solo el avatar_url manteniendo el resto de campos
	existing, err := h.repo.FindByID(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	updated, err := h.repo.Update(c.Request.Context(), userID.(string), UpdateUserInput{
		Name:      existing.Name,
		AvatarURL: avatarURL,
		Address:   existing.Address,
	})
	if err != nil {
		slog.Error("failed to save avatar url", "user_id", userID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": updated})
}
