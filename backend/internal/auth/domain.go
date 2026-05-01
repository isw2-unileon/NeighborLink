package auth

import "context"

// RegisterRequest es el body del POST /api/auth/register
type RegisterRequest struct {
	Name     string `json:"name"     binding:"required,min=2"`
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Address  string `json:"address"  binding:"required"`
}

// LoginRequest es el body del POST /api/auth/login
type LoginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Response holds the JWT token and user info returned after a successful auth operation.
type Response struct {
	Token string  `json:"token"`
	User  UserDTO `json:"user"`
}

// UserDTO es la representación pública del usuario (sin password_hash)
type UserDTO struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Address string `json:"address"`
}

// Service defines the business operations for the auth domain.
type Service interface {
	Register(ctx context.Context, req RegisterRequest) (Response, error)
	Login(ctx context.Context, req LoginRequest) (Response, error)
}
