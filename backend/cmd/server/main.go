package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

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

	authMiddleware := middleware.RequireAuth(cfg.JWTSecret)

	userRepo := usersModule.NewPostgresRepository(pool)
	userHandler := usersModule.NewHandler(userRepo)

	// Auth module
	authSvc := authModule.NewService(pool, cfg.JWTSecret)
	authHandler := authModule.NewHandler(authSvc)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	api.GET("/hello", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Hello from the API"})
	})
	userHandler.RegisterRoutes(api)
	authHandler.RegisterRoutes(api)

	listingRepo := listingsModule.NewPostgresRepository(pool)
	listingHandler := listingsModule.NewHandler(listingRepo)
	listingHandler.RegisterRoutes(api, authMiddleware)

	// If StripeSecretKey is empty, the client is initialised without a key and
	// all Stripe calls will fail. This is acceptable in development when payment
	// endpoints are not used.
	stripeClient := stripeplatform.NewClient(cfg.StripeSecretKey)
	transactionRepo := transactionsModule.NewPostgresRepository(pool)
	transactionService := transactionsModule.NewService(transactionRepo, stripeClient)
	transactionHandler := transactionsModule.NewHandler(transactionRepo, transactionService)
	transactionHandler.RegisterRoutes(api)

	messageRepo := messagesModule.NewPostgresRepository(pool)
	messageHandler := messagesModule.NewHandler(messageRepo)
	messageHandler.RegisterRoutes(api)

	reviewRepo := reviewsModule.NewPostgresRepository(pool)
	reviewHandler := reviewsModule.NewHandler(reviewRepo)
	reviewHandler.RegisterRoutes(api)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
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

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown error", "error", err)
	}

	logger.Info("server stopped")
}
