package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	authModule "github.com/isw2-unileon/neighborlink/backend/internal/auth"
	"github.com/isw2-unileon/neighborlink/backend/internal/config"
	listingsModule "github.com/isw2-unileon/neighborlink/backend/internal/listings"
	messagesModule "github.com/isw2-unileon/neighborlink/backend/internal/messages"
	"github.com/isw2-unileon/neighborlink/backend/internal/platform/database"
	"github.com/isw2-unileon/neighborlink/backend/internal/platform/middleware"
	stripeplatform "github.com/isw2-unileon/neighborlink/backend/internal/platform/stripe"
	reviewsModule "github.com/isw2-unileon/neighborlink/backend/internal/reviews"
	transactionsModule "github.com/isw2-unileon/neighborlink/backend/internal/transactions"
	usersModule "github.com/isw2-unileon/neighborlink/backend/internal/users"
	"github.com/jackc/pgx/v5/pgxpool"
)

var logger = slog.New(slog.NewJSONHandler(os.Stdout, nil))

func main() {
	ctx := context.Background()
	cfg := config.Load()
	gin.SetMode(cfg.GinMode)

	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	logger.Info("database connection established")

	r := buildRouter(cfg, pool)

	if err := runServer(ctx, r, cfg.Port); err != nil {
		logger.Error("shutdown error", "error", err)
	}
	logger.Info("server stopped")
}

// buildRouter registra todos los módulos y devuelve el engine listo.
func buildRouter(cfg config.Config, pool *pgxpool.Pool) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.CORSAllowOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	authMiddleware := middleware.RequireAuth(cfg.JWTSecret)

	registerModules(api, authMiddleware, cfg, pool)

	return r
}

// registerModules inicializa y registra cada módulo en el grupo /api.
func registerModules(api *gin.RouterGroup, authMiddleware gin.HandlerFunc, cfg config.Config, pool *pgxpool.Pool) {
	// Users
	userStorageSvc := usersModule.NewSupabaseStorageService(cfg.SupabaseURL, cfg.SupabaseServiceKey)
	usersModule.NewHandler(usersModule.NewPostgresRepository(pool), userStorageSvc).RegisterRoutes(api, authMiddleware)

	// Auth
	authModule.NewHandler(authModule.NewService(pool, cfg.JWTSecret)).RegisterRoutes(api)

	// Listings
	listingRepo := listingsModule.NewPostgresRepository(pool)
	storageSvc := listingsModule.NewSupabaseStorageService(cfg.SupabaseURL, cfg.SupabaseServiceKey)
	listingsModule.NewHandler(listingRepo, storageSvc).RegisterRoutes(api, authMiddleware)

	// Transactions
	stripeClient := stripeplatform.NewClient(cfg.StripeSecretKey)
	transactionRepo := transactionsModule.NewPostgresRepository(pool)
	transactionSvc := transactionsModule.NewService(transactionRepo, stripeClient)
	transactionsModule.NewHandler(transactionRepo, transactionSvc).RegisterRoutes(api)

	// Messages
	messagesModule.NewHandler(messagesModule.NewPostgresRepository(pool)).RegisterRoutes(api)

	// Reviews
	reviewsModule.NewHandler(reviewsModule.NewPostgresRepository(pool)).RegisterRoutes(api)
}

// runServer arranca el servidor HTTP y espera señal de shutdown.
func runServer(ctx context.Context, handler http.Handler, port string) error {
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		slog.Info("server listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return srv.Shutdown(shutdownCtx)
}
