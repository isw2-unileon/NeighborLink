package auth

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// Errores de dominio — evitamos exponer detalles internos al handler
var (
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
)

// Service define el contrato — DIP: el handler depende de esta interfaz
type Service interface {
	Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error)
	Login(ctx context.Context, req LoginRequest) (*AuthResponse, error)
}

type service struct {
	pool      *pgxpool.Pool
	jwtSecret []byte
}

// NewService es el constructor — devuelve la interfaz, no el struct (DIP)
func NewService(pool *pgxpool.Pool, jwtSecret string) Service {
	return &service{pool: pool, jwtSecret: []byte(jwtSecret)}
}

func (s *service) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	// 1. Verificar que el email no esté registrado
	var count int
	err := s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE email = $1", req.Email).Scan(&count)
	if err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, ErrEmailTaken
	}

	// 2. Hash de la contraseña con bcrypt (coste 12 = balance seguridad/velocidad)
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, err
	}

	// 3. Insertar usuario y recuperar el registro creado
	var user UserDTO
	err = s.pool.QueryRow(ctx,
		"INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name",
		req.Email, req.Name, string(hash),
	).Scan(&user.ID, &user.Email, &user.Name)
	if err != nil {
		return nil, err
	}

	// 4. Generar JWT
	token, err := s.generateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{Token: token, User: user}, nil
}

func (s *service) Login(ctx context.Context, req LoginRequest) (*AuthResponse, error) {
	// 1. Buscar usuario por email
	var user UserDTO
	var hash string
	err := s.pool.QueryRow(ctx,
		"SELECT id, email, name, password_hash FROM users WHERE email = $1",
		req.Email,
	).Scan(&user.ID, &user.Email, &user.Name, &hash)
	if err != nil {
		// No revelar si el email existe o no — siempre mismo error
		return nil, ErrInvalidCredentials
	}

	// 2. Comparar contraseña
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// 3. Generar JWT
	token, err := s.generateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{Token: token, User: user}, nil
}

// generateToken es un método privado — Extract Method, DRY
func (s *service) generateToken(userID string) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(24 * time.Hour).Unix(), // 24h
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}
