package auth

// RegisterRequest es el body del POST /api/auth/register
type RegisterRequest struct {
	Name     string `json:"name"     binding:"required,min=2"`
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginRequest es el body del POST /api/auth/login
type LoginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse es la respuesta exitosa de ambos endpoints
type AuthResponse struct {
	Token string  `json:"token"`
	User  UserDTO `json:"user"`
}

// UserDTO es la representación pública del usuario (sin passwordhash)
type UserDTO struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}
