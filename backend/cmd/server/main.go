package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

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
	// 0. Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("Note: .env file not found, using system environment variables")
	}

	// 1. Get environment variables
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("DATABASE_URL not set, using placeholder")
	}

	jwtSecret := os.Getenv("SUPABASE_JWT_SECRET")
	if jwtSecret == "" {
		log.Println("SUPABASE_JWT_SECRET not set, using placeholder")
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
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Printf("Warning: Unable to create database pool: %v\n", err)
	} else {
		defer pool.Close()
		if err := pool.Ping(ctx); err != nil {
			log.Printf("Warning: Unable to ping database: %v\n", err)
		}
	}

	var dbQueries *db.Queries
	if pool != nil {
		dbQueries = db.New(pool)
	}
	// Note: services should handle nil DB if needed, or simply let the gRPC calls fail with 500
	_ = dbQueries // Used to register services shortly...

	// Create Interceptors
	interceptors := connect.WithInterceptors(api.NewAuthInterceptor(jwtSecret))

	// Base mux for /rpc
	rpcMux := http.NewServeMux()

	// Register Services
	rpcMux.Handle(v1connect.NewUserServiceHandler(&api.UserService{DB: dbQueries}, interceptors))
	rpcMux.Handle(v1connect.NewTransactionServiceHandler(&api.TransactionService{DB: dbQueries}, interceptors))
	rpcMux.Handle(v1connect.NewBudgetServiceHandler(&api.BudgetService{DB: dbQueries}, interceptors))
	rpcMux.Handle(v1connect.NewGoalServiceHandler(&api.GoalService{DB: dbQueries}, interceptors))
	rpcMux.Handle(v1connect.NewImportServiceHandler(&api.ImportService{DB: dbQueries}, interceptors))
	rpcMux.Handle(v1connect.NewRecurringServiceHandler(&api.RecurringService{DB: dbQueries}, interceptors))
	rpcMux.Handle(v1connect.NewReceiptServiceHandler(&api.ReceiptService{DB: dbQueries}, interceptors))
	rpcMux.Handle(v1connect.NewCategoryServiceHandler(&api.CategoryService{DB: dbQueries}, interceptors))
	rpcMux.Handle(v1connect.NewInsightsServiceHandler(&api.InsightsService{DB: dbQueries}, interceptors))
	rpcMux.Handle(v1connect.NewReminderServiceHandler(&api.ReminderService{DB: dbQueries}, interceptors))

	// Main mux
	mux := http.NewServeMux()
	
	// Health check endpoint (no auth)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Mount RPC
	mux.Handle("/rpc/", http.StripPrefix("/rpc", rpcMux))

	// CORS Setup
	c := cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "Connect-Protocol-Version"},
		ExposedHeaders:   []string{"Grpc-Status", "Grpc-Message", "Grpc-Status-Details-Bin", "X-Grpc-Test"},
		AllowCredentials: true,
	})

	handler := c.Handler(h2c.NewHandler(mux, &http2.Server{}))

	log.Println("Starting Vasoli gRPC server on :8080...")
	err = http.ListenAndServe("localhost:8080", handler)
	if err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
