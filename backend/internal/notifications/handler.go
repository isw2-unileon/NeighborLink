package notifications

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Handler defines the HTTP handlers for notifications-related endpoints.
type Handler struct {
	repo Repository
}

// NewHandler creates a new Handler with the given Repository dependency.
func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes attaches the notifications routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	notifications := rg.Group("/", authMiddleware)
	notifications.GET("/notifications", h.List)
	notifications.GET("/notifications/unread-count", h.UnreadCount)
	notifications.PATCH("/notifications/read-all", h.MarkAllAsRead)
	notifications.PATCH("/notifications/:id/read", h.MarkAsRead)
}

// List returns a list of notifications for the authenticated user, ordered by time.
func (h *Handler) List(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user"})
		return
	}

	limit := 20
	if raw := c.Query("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			limit = parsed
		}
	}

	items, err := h.repo.ListByUser(c.Request.Context(), userID.(string), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load notifications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

// UnreadCount returns the number of unread notifications for the authenticated user.
func (h *Handler) UnreadCount(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user"})
		return
	}

	count, err := h.repo.CountUnreadByUser(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not count notifications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"count": count}})
}

// MarkAsRead marks a single notification as read for the authenticated user.
func (h *Handler) MarkAsRead(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user"})
		return
	}

	if err := h.repo.MarkAsRead(c.Request.Context(), userID.(string), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not mark notification as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "notification marked as read"})
}

// MarkAllAsRead marks all notifications as read for the authenticated user.
func (h *Handler) MarkAllAsRead(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user"})
		return
	}

	if err := h.repo.MarkAllAsRead(c.Request.Context(), userID.(string)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not mark all notifications as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "all notifications marked as read"})
}
