package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	"vasoli-backend/api"
	"vasoli-backend/internal/db"
	"vasoli-backend/internal/gen/vasoli/v1/v1connect"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	// 0. Load .env file
	err := godotenv.Load()
	if err != nil {
		slog.Info("env file not found, using system environment variables")
	}

	envMode := os.Getenv("ENV")
	if envMode == "" {
		envMode = "development"
	}
	isProduction := strings.EqualFold(strings.TrimSpace(envMode), "production")
	bypassAuth := os.Getenv("BYPASS_AUTH") == "true"
	allowDBlessDev := bypassAuth && !isProduction
	if bypassAuth && isProduction {
		slog.Error("BYPASS_AUTH cannot be enabled in production")
		os.Exit(1)
	}

	// 1. Get environment variables
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" || strings.Contains(dbURL, "your_password") {
		if !allowDBlessDev {
			slog.Error("DATABASE_URL is missing or uses a placeholder; failing fast")
			os.Exit(1)
		}
		slog.Warn("DATABASE_URL not set or uses a placeholder; continuing in explicit DB-less development mode")
	}

	jwtSecret := os.Getenv("SUPABASE_JWT_SECRET")
	if (jwtSecret == "" || jwtSecret == "your-super-secret-jwt-token-with-at-least-32-characters-long") && os.Getenv("SUPABASE_URL") == "" && os.Getenv("SUPABASE_JWKS_URL") == "" {
		if isProduction {
			slog.Error("SUPABASE_JWT_SECRET is missing or uses placeholder in production. Failing fast.")
			os.Exit(1)
		}
		slog.Warn("SUPABASE_JWT_SECRET not set or using placeholder, running in development mode")
	}

	corsOrigins := os.Getenv("CORS_ORIGINS")
	var allowedOrigins []string
	if corsOrigins != "" {
		allowedOrigins = strings.Split(corsOrigins, ",")
	} else {
		allowedOrigins = []string{"http://localhost:3000"} // Default for local dev
	}

	// 2. Connect to Database via pgxpool
	ctx := context.Background()
	var pool *pgxpool.Pool
	var dbQueries *db.Queries
	if dbURL != "" && !strings.Contains(dbURL, "your_password") {
		pool, err = pgxpool.New(ctx, dbURL)
		if err == nil {
			pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err = pool.Ping(pingCtx)
			cancel()
		}
		if err != nil {
			if pool != nil {
				pool.Close()
				pool = nil
			}
			if !allowDBlessDev {
				slog.Error("unable to connect to database")
				os.Exit(1)
			}
			slog.Warn("database unavailable; continuing in explicit DB-less development mode")
		} else {
			defer pool.Close()
			dbQueries = db.New(pool)
		}
	}

	// Create Interceptors
	// TODO(security): Add an IP/Token-based rate limiting interceptor here for production environments.
	// We want to avoid brute force and excessive API abuse.
	interceptors := connect.WithInterceptors(api.NewLoggingInterceptor(), api.NewAuthInterceptorWithPool(jwtSecret, pool))

	// Start Notification Worker
	workerCtx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if dbQueries != nil {
		worker := api.StartNotificationWorkerWithPool(workerCtx, dbQueries, pool)
		defer worker.Stop()
	}

	// Base mux for /rpc
	rpcMux := http.NewServeMux()

	// Register Services
	rpcMux.Handle(v1connect.NewUserServiceHandler(&api.UserService{DB: dbQueries, Pool: pool}, interceptors))
	rpcMux.Handle(v1connect.NewTransactionServiceHandler(&api.TransactionService{DB: dbQueries, Pool: pool}, interceptors))
	rpcMux.Handle(v1connect.NewBudgetServiceHandler(&api.BudgetService{DB: dbQueries, Pool: pool}, interceptors))
	rpcMux.Handle(v1connect.NewGoalServiceHandler(&api.GoalService{DB: dbQueries, Pool: pool}, interceptors))
	rpcMux.Handle(v1connect.NewImportServiceHandler(
		&api.ImportService{DB: dbQueries, Pool: pool},
		connect.WithReadMaxBytes(15<<20),
		interceptors,
	))
	rpcMux.Handle(v1connect.NewRecurringServiceHandler(&api.RecurringService{DB: dbQueries, Pool: pool}, interceptors))
	rpcMux.Handle(v1connect.NewAchievementServiceHandler(&api.AchievementService{DB: dbQueries}, interceptors))
	rpcMux.Handle(v1connect.NewReceiptServiceHandler(&api.ReceiptService{DB: dbQueries, Pool: pool}, interceptors))
	rpcMux.Handle(v1connect.NewCategoryServiceHandler(&api.CategoryService{DB: dbQueries, Pool: pool}, interceptors))
	rpcMux.Handle(v1connect.NewInsightsServiceHandler(&api.InsightsService{DB: dbQueries}, interceptors))
	rpcMux.Handle(v1connect.NewReminderServiceHandler(&api.ReminderService{DB: dbQueries, Pool: pool}, interceptors))
	rpcMux.Handle(v1connect.NewAccountServiceHandler(&api.AccountService{DB: dbQueries, Pool: pool}, interceptors))

	rpcMux.Handle(v1connect.NewPilotServiceHandler(&api.PilotService{DB: dbQueries, Pool: pool}, interceptors))

	// Main mux
	mux := http.NewServeMux()

	// Health check endpoint (no auth)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	mux.Handle("/lifecycle/", api.NewLifecycleHandler(pool))
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if pool == nil {
			http.Error(w, "database unavailable", http.StatusServiceUnavailable)
			return
		}
		checkCtx, cancelCheck := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancelCheck()
		if err := pool.Ping(checkCtx); err != nil {
			http.Error(w, "database unavailable", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ready"))
	})

	// Mount RPC
	mux.Handle("/rpc/", http.StripPrefix("/rpc", api.AuthenticateRPCMiddleware(rpcMux, pool)))

	// CORS Setup
	c := cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "Connect-Protocol-Version", "X-Request-Id"},
		ExposedHeaders:   []string{"Grpc-Status", "Grpc-Message", "Grpc-Status-Details-Bin", "X-Grpc-Test", "X-Request-Id"},
		AllowCredentials: true,
	})

	handler := api.RequestIDMiddleware(c.Handler(h2c.NewHandler(mux, &http2.Server{})))

	serverAddr := strings.TrimSpace(os.Getenv("SERVER_ADDR"))
	if serverAddr == "" {
		serverAddr = ":8080"
	}
	slog.Info("starting Vasoli gRPC server", "address", serverAddr)
	server := &http.Server{Addr: serverAddr, Handler: handler, ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 20}
	err = server.ListenAndServe()
	if err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
