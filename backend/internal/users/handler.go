package users

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler holds the HTTP handler for the usuario module.
type Handler struct {
	repo Repository
}

// NewHandler creates a new Handler injecting the Repository interface.
// It receives the interface, not the concrete implementation — so it
// works with any storage backend without knowing the details.
func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes attaches the user routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/users", h.listUsers)
	rg.GET("/users/:id", h.getUser)
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
