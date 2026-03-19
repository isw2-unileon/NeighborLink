package usuario

import (
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

// RegisterRoutes attaches the usuario routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/usuarios", h.listUsuarios)
}

func (h *Handler) listUsuarios(c *gin.Context) {
	usuarios, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": usuarios})
}
