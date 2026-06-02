package messages

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler holds the HTTP handlers for the messages module.
type Handler struct {
	repo     Repository
	txReader TransactionReader
}

// NewHandler creates a new Handler injecting the Repository and transactionReader interfaces.
func NewHandler(repo Repository, txReader TransactionReader) *Handler {
	return &Handler{repo: repo, txReader: txReader}
}

// RegisterRoutes attaches the messages routes to a Gin router group.
// authMiddleware must extract the userID from the JWT and set it as "userID" in the context.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	rg.GET("/transactions/:id/messages", h.listByTransaction)
	rg.GET("/messages/:id", h.getMessage)

	// Protected routes — require authentication.
	auth := rg.Group("/", authMiddleware)
	auth.POST("/transactions/:id/messages", h.createMessage)
	auth.GET("/chats", h.listActiveChats)
	auth.POST("/transactions/:id/decision", h.decideTransaction)
}

// listByTransaction returns all messages for a given transaction, ordered by time.
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

// getMessage returns a single message by ID.
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

// createMessage persists a new message in a transaction's chat.
// The sender must be a participant (borrower or owner) and the transaction
// must be active (agreed or handed_over).
func (h *Handler) createMessage(c *gin.Context) {
	senderID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	transactionID := c.Param("id")

	var body struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content is required"})
		return
	}

	// Verify the transaction exists and is active.
	tx, err := h.txReader.FindByID(c.Request.Context(), transactionID)
	if err != nil {
		slog.Error("failed to find transaction", "transaction_id", transactionID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if tx == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "transaction not found"})
		return
	}

	allowedStatuses := map[string]bool{
		"pending":          true,
		"awaiting_payment": true,
		"agreed":           true,
		"handed_over":      true,
	}
	if !allowedStatuses[tx.Status] {
		c.JSON(http.StatusConflict, gin.H{"error": "chat is not available for this transaction"})
		return
	}

	// Only participants can send messages — prevent 3rd party writes.
	uid := senderID.(string)
	if uid != tx.BorrowerID && uid != tx.OwnerID {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a participant of this transaction"})
		return
	}

	created, err := h.repo.Create(c.Request.Context(), Message{
		TransactionID: transactionID,
		SenderID:      uid,
		Content:       body.Content,
	})
	if err != nil {
		slog.Error("failed to create message", "transaction_id", transactionID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": created})
}

// listActiveChats returns the latest message per active transaction
// where the authenticated user is a participant.
func (h *Handler) listActiveChats(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	messages, err := h.repo.FindActiveByParticipant(c.Request.Context(), userID.(string))
	if err != nil {
		slog.Error("failed to list active chats", "user_id", userID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": messages})
}

func (h *Handler) decideTransaction(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	transactionID := c.Param("id")

	var body struct {
		Decision string `json:"decision" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "decision is required"})
		return
	}

	tx, err := h.txReader.FindByID(c.Request.Context(), transactionID)
	if err != nil {
		slog.Error("failed to find transaction", "transaction_id", transactionID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if tx == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "transaction not found"})
		return
	}

	uid := userID.(string)
	_ = uid

	if tx.Status != "pending" {
		c.JSON(http.StatusConflict, gin.H{"error": "this transaction can no longer be decided"})
		return
	}

	var nextStatus string
	var systemMessage string

	switch body.Decision {
	case "accept":
		nextStatus = "awaiting_payment"
		systemMessage = "El prestador ha aceptado las condiciones propuestas, ahora mete los métodos de pago."
	case "reject":
		nextStatus = "cancelled"
		systemMessage = "El prestador no ha aceptado las condiciones."
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "decision must be accept or reject"})
		return
	}

	if err := h.txReader.UpdateStatus(c.Request.Context(), transactionID, nextStatus); err != nil {
		slog.Error("failed to update transaction status", "transaction_id", transactionID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	_, err = h.repo.Create(c.Request.Context(), Message{
		TransactionID: transactionID,
		SenderID:      SystemUserID,
		Content:       systemMessage,
	})
	if err != nil {
		slog.Error("failed to create system message", "transaction_id", transactionID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "decision saved",
		"status":  nextStatus,
	})
}
