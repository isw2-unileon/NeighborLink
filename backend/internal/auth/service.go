package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
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

type service struct {
	pool       *pgxpool.Pool
	jwtSecret  []byte
	httpClient *http.Client
}

// NewService es el constructor — devuelve la interfaz, no el struct (DIP)
func NewService(pool *pgxpool.Pool, jwtSecret string) Service {
	return &service{
		pool:       pool,
		jwtSecret:  []byte(jwtSecret),
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (s *service) Register(ctx context.Context, req RegisterRequest) (Response, error) {
	var count int
	err := s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE email = $1", req.Email).Scan(&count)
	if err != nil {
		return Response{}, err
	}
	if count > 0 {
		return Response{}, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return Response{}, err
	}

	// Geocodificación — fallo no bloquea el registro
	coords, err := geocode(ctx, s.httpClient, req.Address)
	if err != nil {
		slog.Warn("geocoding failed, registering without location", "address", req.Address, "error", err)
	}

	var user UserDTO
	if coords != nil {
		err = s.pool.QueryRow(ctx,
			`INSERT INTO users (email, name, password_hash, address, location)
             VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326))
             RETURNING id, email, name, address`,
			req.Email, req.Name, string(hash), req.Address, coords.Lng, coords.Lat,
		).Scan(&user.ID, &user.Email, &user.Name, &user.Address)
	} else {
		err = s.pool.QueryRow(ctx,
			`INSERT INTO users (email, name, password_hash, address)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, name, address`,
			req.Email, req.Name, string(hash), req.Address,
		).Scan(&user.ID, &user.Email, &user.Name, &user.Address)
	}
	if err != nil {
		return Response{}, err
	}

	token, err := s.generateToken(user.ID)
	if err != nil {
		return Response{}, err
	}

	return Response{Token: token, User: user}, nil
}

func (s *service) Login(ctx context.Context, req LoginRequest) (Response, error) {
	var user UserDTO
	var hash string
	err := s.pool.QueryRow(ctx,
		"SELECT id, email, name, address, avatar_url, password_hash FROM users WHERE email = $1",
		req.Email,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Address, &user.AvatarURL, &hash)
	if err != nil {
		return Response{}, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		return Response{}, ErrInvalidCredentials
	}

	token, err := s.generateToken(user.ID)
	if err != nil {
		return Response{}, err
	}

	return Response{Token: token, User: user}, nil
}

// generateToken es un método privado — Extract Method, DRY
func (s *service) generateToken(userID string) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(24 * time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}
