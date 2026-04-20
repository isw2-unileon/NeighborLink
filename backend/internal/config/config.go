// Package config handles application configuration from environment variables.
package config

import "os"

// Config holds the application configuration loaded from environment variables.
type Config struct {
	Port            string
	GinMode         string
	CORSAllowOrigin string
	DatabaseURL     string
	StripeSecretKey string
	JWTSecret       string
}

// Load reads configuration from environment variables and returns a Config.
func Load() Config {
	return Config{
		Port:            getEnv("PORT", "8080"),
		GinMode:         getEnv("GIN_MODE", "debug"),
		CORSAllowOrigin: getEnv("CORS_ALLOW_ORIGIN", "*"),
		DatabaseURL:     getEnv("DATABASE_URL", ""),
		StripeSecretKey: getEnv("STRIPE_SECRET_KEY", ""),
		JWTSecret:       getEnv("JWT_SECRET", "dev-secret-change-in-prod"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
