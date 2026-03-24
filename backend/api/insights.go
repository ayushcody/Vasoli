package api

import (
	"context"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5/pgtype"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type InsightsService struct {
	DB *db.Queries
}

func (s *InsightsService) GetSummary(ctx context.Context, req *connect.Request[pb.GetSummaryRequest]) (*connect.Response[pb.GetSummaryResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	// Naive date parsing of YYYY-MM
	startDate, err := time.Parse("2006-01", req.Msg.MonthYear)
	if err != nil {
		// Default to current month if bad format
		now := time.Now()
		startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	}
	endDate := startDate.AddDate(0, 1, 0)

	analytics, err := s.DB.GetWealthAnalytics(ctx, db.GetWealthAnalyticsParams{
		UserID:    userUUID,
		StartDate: pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:   pgtype.Timestamptz{Time: endDate, Valid: true},
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// Oh well, for MVP we can use the spent / invested logic

	return connect.NewResponse(&pb.GetSummaryResponse{
		// Hardcoded derived values for MVP based on existing struct
		TotalIncomePaise:  analytics.Saved + analytics.Spent, 
		TotalExpensePaise: analytics.Spent,
		BalancePaise:      analytics.Saved, 
	}), nil
}
func (s *InsightsService) GetZine(ctx context.Context, req *connect.Request[pb.GetZineRequest]) (*connect.Response[pb.GetZineResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	// Fetch basic analytics for the period
	startDate, _ := time.Parse("2006-01", req.Msg.MonthYear)
	endDate := startDate.AddDate(0, 1, 0)

	analytics, _ := s.DB.GetWealthAnalytics(ctx, db.GetWealthAnalyticsParams{
		UserID:    userUUID,
		StartDate: pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:   pgtype.Timestamptz{Time: endDate, Valid: true},
	})

	// For MVP, returning a mix of real basic stats and randomized "insights"
	// In a real app, this would be computed via complex SQL or AI 
	return connect.NewResponse(&pb.GetZineResponse{
		Period:            req.Msg.MonthYear,
		TotalSpentPaise:   analytics.Spent,
		TotalIncomePaise: analytics.Saved + analytics.Spent,
		TransactionCount:  12, // Mock count
		TopCategories: []*pb.CategoryInsight{
			{Name: "Food & Dining", Icon: "🍔", TotalPaise: analytics.Spent / 2},
			{Name: "Transport", Icon: "🚗", TotalPaise: analytics.Spent / 4},
		},
		BiggestSpend: &pb.SpendInsight{
			Merchant:    "Amazon",
			AmountPaise: analytics.Spent / 3,
		},
		Streak:            5,
		SavedVsPrevPaise: 250000, // +₹2,500
		Leak: &pb.LeakInsight{
			Category:      "Subscriptions",
			IncreasePaise: 49900,
		},
	}), nil
}

func (s *InsightsService) GetHealthScore(ctx context.Context, req *connect.Request[pb.GetHealthScoreRequest]) (*connect.Response[pb.GetHealthScoreResponse], error) {
	return connect.NewResponse(&pb.GetHealthScoreResponse{
		Score: 78,
		Components: []*pb.HealthScoreComponent{
			{Name: "Savings Rate", Score: 85, Weight: 30, Description: "You are saving 20% of your income."},
			{Name: "Debt-to-Income", Score: 92, Weight: 25, Description: "Low debt levels detected."},
			{Name: "Emergency Fund", Score: 45, Weight: 20, Description: "Only 1.5 months of expenses saved."},
			{Name: "Investment Mix", Score: 70, Weight: 15, Description: "Good diversification but room to grow."},
			{Name: "Budget Adherence", Score: 88, Weight: 10, Description: "Staying within limits most months."},
		},
		Factors: []*pb.HealthScoreFactor{
			{Type: "positive", Title: "Consistent Income", Description: "Your income has been steady for 6 months.", Impact: 12.5},
			{Type: "negative", Title: "Low Savings", Description: "Try to increase your monthly savings rate.", Impact: -5.0},
		},
		Insights: []*pb.HealthScoreInsight{
			{Category: "Savings", Tip: "Set up an automated transfer to your emergency fund.", Priority: "high"},
		},
	}), nil
}
