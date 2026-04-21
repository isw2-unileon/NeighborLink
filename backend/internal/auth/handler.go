package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// Handler exposes HTTP handlers for the auth domain.
type Handler struct{ svc Service }

// NewHandler creates a new auth Handler with the given Service.
func NewHandler(svc Service) *Handler { return &Handler{svc: svc} }

// RegisterRoutes mounts the auth routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	auth := rg.Group("/auth")
	auth.POST("/register", h.register)
	auth.POST("/login", h.login)
}

// validationMessage traduce los errores técnicos de Gin/validator a mensajes legibles.
func validationMessage(fe validator.FieldError) string {
	messages := map[string]map[string]string{
		"Name": {
			"required": "El nombre es obligatorio",
			"min":      "El nombre debe tener al menos 2 caracteres",
		},
		"Email": {
			"required": "El email es obligatorio",
			"email":    "El email no tiene un formato válido (ej: tu@email.com)",
		},
		"Password": {
			"required": "La contraseña es obligatoria",
			"min":      "La contraseña debe tener al menos 6 caracteres",
		},
		"Address": {
			"required": "La dirección es obligatoria",
		},
	}
	if fieldMessages, ok := messages[fe.Field()]; ok {
		if msg, ok := fieldMessages[fe.Tag()]; ok {
			return msg
		}
	}
	return "El campo " + fe.Field() + " no es válido"
}

// parseValidationErrors extrae el primer error de validación legible.
func parseValidationErrors(err error) string {
	var ve validator.ValidationErrors
	if errors.As(err, &ve) && len(ve) > 0 {
		return validationMessage(ve[0])
	}
	return "Datos inválidos"
}

// handleAuth encapsulates the common pattern: bind JSON → call service → respond.
// Uses generics to avoid duplicating the same flow for register and login.
func handleAuth[Req any, Resp any](
	c *gin.Context,
	svcFn func(context.Context, Req) (Resp, error),
	domainErr error,
	domainStatus int,
	domainMsg string,
	successStatus int,
) {
	var req Req
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": parseValidationErrors(err)})
		return
	}
	resp, err := svcFn(c.Request.Context(), req)
	if errors.Is(err, domainErr) {
		c.JSON(domainStatus, gin.H{"error": domainMsg})
		return
	}
	if err != nil {
		slog.Error("auth request failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
		return
	}
	c.JSON(successStatus, resp)
}

func (h *Handler) register(c *gin.Context) {
	handleAuth(c, h.svc.Register, ErrEmailTaken,
		http.StatusConflict, "Este email ya está registrado", http.StatusCreated)
}

func (h *Handler) login(c *gin.Context) {
	handleAuth(c, h.svc.Login, ErrInvalidCredentials,
		http.StatusUnauthorized, "Email o contraseña incorrectos", http.StatusOK)
}
