package transactions

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type adminChecker interface {
	IsAdmin(ctx context.Context, userID string) (bool, error)
}

// Handler holds the HTTP handlers for the transactions module.
type Handler struct {
	repo      Repository
	service   *Service
	walletSvc pointsAdder
	notifSvc  notificationCreator
	adminSvc  adminChecker
}

// NewHandler creates a new Handler injecting the Repository, Service, and a pointsAdder.
func NewHandler(repo Repository, service *Service, walletSvc pointsAdder, notifSvc notificationCreator, adminSvc adminChecker) *Handler {
	return &Handler{repo: repo, service: service, walletSvc: walletSvc, notifSvc: notifSvc, adminSvc: adminSvc}
}

// RegisterRoutes attaches the transactions routes to a Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	rg.GET("/transactions", h.listTransactions)
	rg.GET("/transactions/:id", h.getTransaction)
	rg.GET("/listings/:id/transactions", h.listByListing)
	rg.GET("/users/:id/transactions", h.listByBorrower)
	rg.GET("/listings/:id/availability", h.getAvailability)

	protected := rg.Group("/")
	protected.Use(authMiddleware)
	protected.POST("/transactions", h.createTransaction)
	protected.PUT("/transactions/:id/accept", h.acceptTransaction)
	protected.PUT("/transactions/:id/reject", h.rejectTransaction)
	protected.PUT("/transactions/:id/pay", h.payTransaction)
	protected.POST("/transactions/:id/handover", h.handoverTransaction)
	protected.POST("/transactions/:id/return", h.returnTransaction)
	protected.POST("/listings/:id/reserve", h.reserveListing)
	protected.POST("/transactions/:id/generate-delivery-code", h.generateDeliveryCode)
	protected.POST("/transactions/:id/generate-return-code", h.generateReturnCode)
	protected.POST("/transactions/:id/confirm-handover", h.confirmHandover)
	protected.POST("/transactions/:id/confirm-return", h.confirmReturn)
	protected.POST("/transactions/:id/report-issue", h.reportIssueTransaction)
	protected.POST("/transactions/:id/resolve-dispute", h.resolveDisputeTransaction)
	protected.POST("/transactions/:id/refund-dispute", h.refundDisputePoints)
}

func (h *Handler) refundDisputePoints(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	isAdmin, err := h.adminSvc.IsAdmin(c.Request.Context(), userID.(string))
	if err != nil {
		slog.Error("failed to check admin status", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "only administrators can issue refunds"})
		return
	}

	id := c.Param("id")
	var body struct {
		Percentage int `json:"percentage"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	points, err := h.service.RefundDisputePoints(c.Request.Context(), id, body.Percentage)
	if err != nil {
		h.handleServiceError(c, "refund dispute points", id, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "points": points})
}

func (h *Handler) resolveDisputeTransaction(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	isAdmin, err := h.adminSvc.IsAdmin(c.Request.Context(), userID.(string))
	if err != nil {
		slog.Error("failed to check admin status", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "only administrators can resolve disputes"})
		return
	}

	id := c.Param("id")
	if err := h.service.ResolveDispute(c.Request.Context(), id); err != nil {
		h.handleServiceError(c, "resolve dispute", id, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) reportIssueTransaction(c *gin.Context) {
	id := c.Param("id")
	if !h.requireOwner(c, id) {
		return
	}

	if err := h.service.ReportIssue(c.Request.Context(), id); err != nil {
		h.handleServiceError(c, "report issue", id, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "status": "pending_review"})
}

func (h *Handler) listTransactions(c *gin.Context) {
	transactions, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		slog.Error("failed to list transactions", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": transactions})
}

func (h *Handler) getTransaction(c *gin.Context) {
	id := c.Param("id")

	transaction, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		slog.Error("failed to get transaction", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if transaction == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "transaction not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": transaction})
}

func (h *Handler) listByListing(c *gin.Context) {
	listingID := c.Param("id")

	transactions, err := h.repo.FindByListing(c.Request.Context(), listingID)
	if err != nil {
		slog.Error("failed to list transactions by listing", "listing_id", listingID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": transactions})
}

func (h *Handler) listByBorrower(c *gin.Context) {
	borrowerID := c.Param("id")

	transactions, err := h.repo.FindByBorrower(c.Request.Context(), borrowerID)
	if err != nil {
		slog.Error("failed to list transactions by borrower", "borrower_id", borrowerID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": transactions})
}

func (h *Handler) createTransaction(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	borrowerID := userID.(string)

	var body struct {
		ListingID       string `json:"listing_id"`
		PaymentMethodID string `json:"payment_method_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		slog.Error("failed to parse create transaction body", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	t, err := h.repo.Create(c.Request.Context(), Transaction{
		ListingID:       body.ListingID,
		BorrowerID:      borrowerID,
		PaymentMethodID: body.PaymentMethodID,
	})
	if err != nil {
		slog.Error("failed to create transaction", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": t})
}

// parseDepositAmountCents reads deposit_amount_cents from the JSON body.
// Returns the amount and true on success; writes a 400 response and returns false on failure.
func (h *Handler) parseDepositAmountCents(c *gin.Context) (int64, bool) {
	var body struct {
		DepositAmountCents int64 `json:"deposit_amount_cents"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		slog.Error("failed to parse transaction body", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return 0, false
	}
	return body.DepositAmountCents, true
}

// handleServiceError maps service-layer errors to HTTP responses.
func (h *Handler) handleServiceError(c *gin.Context, action, id string, err error) {
	slog.Error("failed to "+action+" transaction", "id", id, "error", err)
	msg := err.Error()
	switch {
	case strings.Contains(msg, "not found"):
		c.JSON(http.StatusNotFound, gin.H{"error": msg})
	case strings.Contains(msg, "status"):
		c.JSON(http.StatusConflict, gin.H{"error": msg})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
	}
}

// requireOwner checks that the authenticated caller is the listing owner for the
// given transaction. It writes the appropriate error response and returns false
// when the caller should stop processing.
func (h *Handler) requireOwner(c *gin.Context, id string) bool {
	callerID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return false
	}
	ownerID, err := h.repo.FindListingOwnerByTransactionID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "transaction not found"})
		return false
	}
	if ownerID != callerID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return false
	}
	return true
}

// requireBorrower checks that the authenticated caller is the borrower of the transaction.
func (h *Handler) requireBorrower(c *gin.Context, id string) bool {
	callerID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return false
	}
	t, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil || t == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "transaction not found"})
		return false
	}
	if t.BorrowerID != callerID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return false
	}
	return true
}

func (h *Handler) payTransaction(c *gin.Context) {
	id := c.Param("id")
	if !h.requireBorrower(c, id) {
		return
	}

	var body struct {
		DepositAmountCents int64  `json:"deposit_amount_cents"`
		PaymentMethodID    string `json:"payment_method_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		slog.Error("failed to parse pay transaction body", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.ConfirmPayment(c.Request.Context(), id, body.DepositAmountCents, body.PaymentMethodID); err != nil {
		h.handleServiceError(c, "pay", id, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) acceptTransaction(c *gin.Context) {
	id := c.Param("id")
	if !h.requireOwner(c, id) {
		return
	}

	if err := h.service.AcceptRequest(c.Request.Context(), id); err != nil {
		h.handleServiceError(c, "accept", id, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) rejectTransaction(c *gin.Context) {
	id := c.Param("id")
	if !h.requireOwner(c, id) {
		return
	}

	if err := h.service.Reject(c.Request.Context(), id); err != nil {
		h.handleServiceError(c, "reject", id, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) handoverTransaction(c *gin.Context) {
	id := c.Param("id")
	if !h.requireOwner(c, id) {
		return
	}

	if err := h.service.Handover(c.Request.Context(), id); err != nil {
		h.handleServiceError(c, "handover", id, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) returnTransaction(c *gin.Context) {
	id := c.Param("id")
	if !h.requireOwner(c, id) {
		return
	}

	depositAmountCents, ok := h.parseDepositAmountCents(c)
	if !ok {
		return
	}

	daysBorrowed, err := h.service.Return(c.Request.Context(), id, depositAmountCents)
	if err != nil {
		h.handleServiceError(c, "return", id, err)
		return
	}

	ownerID := c.MustGet("userID").(string)
	pointsEarned := int(depositAmountCents * int64(daysBorrowed+4) / 100)
	if err := h.walletSvc.AddPoints(c.Request.Context(), ownerID, pointsEarned); err != nil {
		slog.Error("failed to award points after return", "transaction_id", id, "error", err)
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) getAvailability(c *gin.Context) {
	listingID := c.Param("id")

	blocked, err := h.repo.FindBlockedDates(c.Request.Context(), listingID)
	if err != nil {
		slog.Error("failed to get availability", "listing_id", listingID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": blocked})
}

func (h *Handler) reserveListing(c *gin.Context) {
	listingID := c.Param("id")
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Un administrador NO puede reservar objetos
	isAdmin, err := h.adminSvc.IsAdmin(c.Request.Context(), userID.(string))
	if err != nil {
		slog.Error("failed to check admin status during reservation", "error", err)
	}
	if isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "administrators cannot reserve listings"})
		return
	}

	var input ReserveInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ✅ Llamada al helper — sustituye TODO el bloque de parseo/validación
	startDate, endDate, ok := h.validateReserveDates(c, input)
	if !ok {
		return
	}

	// ✅ A partir de aquí ya NO hay más código de fechas — solo la comprobación de solapamiento
	blocked, err := h.repo.FindBlockedDates(c.Request.Context(), listingID)
	if err != nil {
		slog.Error("failed to check availability", "listing_id", listingID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	for _, dr := range blocked {
		if dr.StartDate == "" || dr.EndDate == "" {
			continue
		}

		blockedStart, err := time.Parse("2006-01-02", dr.StartDate)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}

		blockedEnd, err := time.Parse("2006-01-02", dr.EndDate)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}

		if startDate.Before(blockedEnd) && endDate.After(blockedStart) {
			c.JSON(http.StatusConflict, gin.H{"error": "selected dates overlap with an existing reservation"})
			return
		}
	}

	t, err := h.repo.Reserve(c.Request.Context(), Transaction{
		ListingID:       listingID,
		BorrowerID:      userID.(string),
		PaymentMethodID: input.PaymentMethodID,
		StartDate:       &startDate,
		EndDate:         &endDate,
	})
	if err != nil {
		slog.Error("failed to reserve listing", "listing_id", listingID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if h.notifSvc != nil {
		go func() {
			ownerID, listingTitle, notifErr := h.repo.FindListingOwnerAndTitle(context.Background(), listingID)
			if notifErr != nil {
				slog.Error("failed to fetch listing owner for notification", "listing_id", listingID, "error", notifErr)
				return
			}
			_ = h.notifSvc.Create(context.Background(), ownerID, "chat_opened", map[string]any{
				"listing_title": listingTitle,
				"borrower_id":   userID.(string),
			})
		}()
	}

	c.JSON(http.StatusCreated, gin.H{"data": t})
}

func (h *Handler) validateReserveDates(c *gin.Context, input ReserveInput) (start, end time.Time, ok bool) {
	var err error
	start, err = time.Parse("2006-01-02", input.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_date format, use YYYY-MM-DD"})
		return
	}
	end, err = time.Parse("2006-01-02", input.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_date format, use YYYY-MM-DD"})
		return
	}
	days := int(end.Sub(start).Hours() / 24)
	if days < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "end_date must be after start_date"})
		return
	}
	if days > 7 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "maximum loan period is 7 days"})
		return
	}
	return start, end, true
}

// generateCode handles code generation for both delivery and return codes.
func (h *Handler) generateCode(c *gin.Context, codeType string) {
	id := c.Param("id")
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	t, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil || t == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "transaction not found"})
		return
	}

	if t.BorrowerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	code, err := h.repo.GenerateCode(c.Request.Context(), id, codeType)
	if err != nil {
		slog.Error("failed to generate code", "id", id, "type", codeType, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"code": code}})
}

func (h *Handler) generateDeliveryCode(c *gin.Context) { h.generateCode(c, "delivery_code") }
func (h *Handler) generateReturnCode(c *gin.Context)   { h.generateCode(c, "return_code") }

func (h *Handler) confirmHandover(c *gin.Context) {
	id := c.Param("id")
	if !h.requireOwner(c, id) {
		return
	}
	var body struct {
		Code               string `json:"code"`
		DepositAmountCents int64  `json:"deposit_amount_cents"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	valid, err := h.repo.ValidateCode(c.Request.Context(), id, "delivery_code", body.Code)
	if err != nil {
		h.handleServiceError(c, "confirm handover", id, err)
		return
	}
	if !valid {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "invalid delivery code"})
		return
	}
	if err := h.service.Handover(c.Request.Context(), id); err != nil {
		h.handleServiceError(c, "handover", id, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) confirmReturn(c *gin.Context) {
	id := c.Param("id")
	if !h.requireOwner(c, id) {
		return
	}
	var body struct {
		Code               string `json:"code"`
		DepositAmountCents int64  `json:"deposit_amount_cents"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	valid, err := h.repo.ValidateCode(c.Request.Context(), id, "return_code", body.Code)
	if err != nil {
		h.handleServiceError(c, "confirm return", id, err)
		return
	}
	if !valid {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "invalid return code"})
		return
	}
	daysBorrowed, err := h.service.Return(c.Request.Context(), id, body.DepositAmountCents)
	if err != nil {
		h.handleServiceError(c, "return", id, err)
		return
	}
	ownerID := c.MustGet("userID").(string)
	pointsEarned := int(body.DepositAmountCents * int64(daysBorrowed+4) / 100)
	if err := h.walletSvc.AddPoints(c.Request.Context(), ownerID, pointsEarned); err != nil {
		slog.Error("failed to award points after return", "transaction_id", id, "error", err)
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
