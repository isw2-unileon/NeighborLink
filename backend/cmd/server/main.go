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
	notificationsModule "github.com/isw2-unileon/neighborlink/backend/internal/notifications"
	"github.com/isw2-unileon/neighborlink/backend/internal/platform/adapters"
	"github.com/isw2-unileon/neighborlink/backend/internal/platform/database"
	"github.com/isw2-unileon/neighborlink/backend/internal/platform/middleware"
	stripeplatform "github.com/isw2-unileon/neighborlink/backend/internal/platform/stripe"
	reviewsModule "github.com/isw2-unileon/neighborlink/backend/internal/reviews"
	transactionsModule "github.com/isw2-unileon/neighborlink/backend/internal/transactions"
	usersModule "github.com/isw2-unileon/neighborlink/backend/internal/users"
	walletModule "github.com/isw2-unileon/neighborlink/backend/internal/wallet"
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
	// Repositories
	userRepo := usersModule.NewPostgresRepository(pool)
	messageRepo := messagesModule.NewPostgresRepository(pool)
	listingRepo := listingsModule.NewPostgresRepository(pool)
	walletRepo := walletModule.NewPostgresRepository(pool)
	notificationsRepo := notificationsModule.NewRepository(pool)
	transactionRepo := transactionsModule.NewPostgresRepository(pool)

	// Services
	userStorageSvc := usersModule.NewSupabaseStorageService(cfg.SupabaseURL, cfg.SupabaseServiceKey)
	listingStorageSvc := listingsModule.NewSupabaseStorageService(cfg.SupabaseURL, cfg.SupabaseServiceKey)
	notificationsSvc := notificationsModule.NewService(notificationsRepo)
	walletSvc := walletModule.NewService(walletRepo)
	stripeClient := stripeplatform.NewClient(cfg.StripeSecretKey)

	transactionSvc := transactionsModule.NewService(
		transactionRepo,
		stripeClient,
		listingRepo,
		&adminAdapter{repo: userRepo},
		&messageAdapter{repo: messageRepo},
		walletSvc,
		notificationsSvc,
	)

	// Handlers
	usersModule.NewHandler(userRepo, userStorageSvc).RegisterRoutes(api, authMiddleware)
	authModule.NewHandler(authModule.NewService(pool, cfg.JWTSecret)).RegisterRoutes(api)
	notificationsModule.NewHandler(notificationsRepo).RegisterRoutes(api, authMiddleware)
	listingsModule.NewHandler(
		listingRepo,
		listingStorageSvc,
		notificationsSvc,
		&adminCheckAdapter{repo: userRepo},
		transactionRepo,
	).RegisterRoutes(api, authMiddleware)
	walletModule.NewHandler(walletSvc).RegisterRoutes(api, authMiddleware)
	transactionsModule.NewHandler(
		transactionRepo,
		transactionSvc,
		walletSvc,
		notificationsSvc,
		&adminCheckAdapter{repo: userRepo},
	).RegisterRoutes(api, authMiddleware)
	transactionsModule.NewWebhookHandler(stripeClient, transactionRepo, cfg.StripeWebhookSecret).RegisterRoutes(api)

	// Messages
	messagesModule.NewHandler(
		messageRepo,
		adapters.NewTxReaderAdapter(transactionRepo),
	).RegisterRoutes(api, authMiddleware)

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

// Adapters to satisfy transactions.Service narrow interfaces without package coupling.

type adminAdapter struct {
	repo usersModule.Repository
}

func (a *adminAdapter) FindFirstAdmin(ctx context.Context) (string, error) {
	u, err := a.repo.FindFirstAdmin(ctx)
	if err != nil {
		return "", err
	}
	if u == nil {
		return "", nil
	}
	return u.ID, nil
}

type messageAdapter struct {
	repo messagesModule.Repository
}

func (m *messageAdapter) CreateSystemMessage(ctx context.Context, transactionID, content string) error {
	_, err := m.repo.Create(ctx, messagesModule.Message{
		TransactionID: transactionID,
		SenderID:      messagesModule.SystemUserID,
		Content:       content,
	})
	return err
}

type adminCheckAdapter struct {
	repo usersModule.Repository
}

func (a *adminCheckAdapter) IsAdmin(ctx context.Context, userID string) (bool, error) {
	u, err := a.repo.FindByID(ctx, userID)
	if err != nil {
		return false, err
	}
	if u == nil {
		return false, nil
	}
	return u.Role == "admin", nil
}

