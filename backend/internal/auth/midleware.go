// El middleware sirve cuando creemos rutas que requieran estar logueado — por ejemplo, crear un listing,
// iniciar una transacción, etc. En ese momento sí tocaremos main.go para decirle a esas rutas que pasen por el middleware.

package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const UserIDKey = "userID"

// JWTMiddleware devuelve un middleware Gin que valida el Bearer token.
// Patrón: Middleware/Chain of Responsibility — se inyecta en las rutas que lo necesiten.
// DIP: recibe el secret como parámetro, no lo lee del entorno directamente.
func JWTMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			return
		}

		raw := strings.TrimPrefix(authHeader, "Bearer ")

		token, err := jwt.Parse(raw, func(t *jwt.Token) (any, error) {
			// Verificamos explícitamente el algoritmo — evitar el ataque "alg: none"
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		}, jwt.WithExpirationRequired())

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token claims"})
			return
		}

		// Inyectamos el userID en el contexto para que los handlers lo consuman
		c.Set(UserIDKey, claims["sub"])
		c.Next()
	}
}
