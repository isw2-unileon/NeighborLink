package wallet

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler holds the HTTP handlers for the wallet module.
type Handler struct {
	svc Service
}

// NewHandler creates a new wallet Handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches the wallet routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	protected := rg.Group("/")
	protected.Use(authMiddleware)
	protected.POST("/users/me/redeem-points", h.redeemPoints)
	protected.GET("/users/me/points-history", h.pointsHistory)
}

func (h *Handler) redeemPoints(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	redemption, err := h.svc.RedeemPoints(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrInsufficientPoints) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		slog.Error("failed to redeem points", "user_id", userID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": redemption})
}

func (h *Handler) pointsHistory(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	entries, err := h.svc.GetPointsHistory(c.Request.Context(), userID)
	if err != nil {
		slog.Error("failed to get points history", "user_id", userID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": entries})
}