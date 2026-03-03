package main

import (
	"log"
	"net/http"
	"os"

	"connectrpc.com/connect"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	"vasoli-backend/api"
	"vasoli-backend/internal/gen/vasoli/v1/v1connect"
)

func main() {
	// 1. Get environment variables
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("DATABASE_URL not set, using placeholder")
	}

	jwtSecret := os.Getenv("SUPABASE_JWT_SECRET")
	if jwtSecret == "" {
		log.Println("SUPABASE_JWT_SECRET not set, using placeholder")
	}

	// 2. Connect to Database
	// conn, err := pgx.Connect(context.Background(), dbURL)
	// if err != nil {
	// 	log.Fatalf("Unable to connect to database: %v\n", err)
	// }
	// defer conn.Close(context.Background())
	// dbQueries := db.New(conn)

	mux := http.NewServeMux()
	
	// Create Interceptors
	interceptors := connect.WithInterceptors(api.NewAuthInterceptor(jwtSecret))

	// Register Services
	mux.Handle(v1connect.NewUserServiceHandler(&api.UserService{DB: nil}, interceptors))
	mux.Handle(v1connect.NewTransactionServiceHandler(&api.TransactionService{DB: nil}, interceptors))
	mux.Handle(v1connect.NewBudgetServiceHandler(&api.BudgetService{DB: nil}, interceptors))
	mux.Handle(v1connect.NewGoalServiceHandler(&api.GoalService{DB: nil}, interceptors))
	
	log.Println("Starting Vasoli gRPC server on :8080...")
	err := http.ListenAndServe(

		"localhost:8080",
		h2c.NewHandler(mux, &http2.Server{}),
	)
	if err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
