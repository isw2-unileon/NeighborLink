package auth

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

type Handler struct{ svc Service }

func NewHandler(svc Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	auth := rg.Group("/auth")
	auth.POST("/register", h.register)
	auth.POST("/login", h.login)
}

// validationMessage traduce los errores técnicos de Gin/validator a mensajes legibles.
// Extract Method + tabla de mensajes — DRY, fácil de extender con nuevas reglas.
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
	}

	if fieldMessages, ok := messages[fe.Field()]; ok {
		if msg, ok := fieldMessages[fe.Tag()]; ok {
			return msg
		}
	}
	return "El campo " + fe.Field() + " no es válido"
}

// parseValidationErrors extrae el primer error de validación legible.
// Devolvemos solo el primero para no abrumar al usuario — UX progresiva.
func parseValidationErrors(err error) string {
	var ve validator.ValidationErrors
	if errors.As(err, &ve) && len(ve) > 0 {
		return validationMessage(ve[0])
	}
	return "Datos inválidos"
}

func (h *Handler) register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": parseValidationErrors(err)})
		return
	}
	resp, err := h.svc.Register(c.Request.Context(), req)
	if errors.Is(err, ErrEmailTaken) {
		c.JSON(http.StatusConflict, gin.H{"error": "Este email ya está registrado"})
		return
	}
	if err != nil {
		slog.Error("register failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *Handler) login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": parseValidationErrors(err)})
		return
	}
	resp, err := h.svc.Login(c.Request.Context(), req)
	if errors.Is(err, ErrInvalidCredentials) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email o contraseña incorrectos"})
		return
	}
	if err != nil {
		slog.Error("login failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
		return
	}
	c.JSON(http.StatusOK, resp)
}
