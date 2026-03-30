package api

import (
	"context"
	"errors"
	"math"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type InsightsService struct {
	DB *db.Queries
}

func (s *InsightsService) GetSummary(ctx context.Context, req *connect.Request[pb.GetSummaryRequest]) (*connect.Response[pb.GetSummaryResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	startDate, endDate := monthRange(req.Msg.MonthYear, time.Now().UTC())
	totals, err := s.DB.GetSummaryTotals(ctx, db.GetSummaryTotalsParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(endDate),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.GetSummaryResponse{
		TotalIncomePaise:  totals.TotalIncome,
		TotalExpensePaise: totals.TotalExpenses,
		BalancePaise:      totals.NetBalance,
	}), nil
}

func (s *InsightsService) GetZine(ctx context.Context, req *connect.Request[pb.GetZineRequest]) (*connect.Response[pb.GetZineResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	now := time.Now().UTC()
	startDate, endDate := monthRange(req.Msg.MonthYear, now)
	prevStartDate := startDate.AddDate(0, -1, 0)
	prevEndDate := startDate

	currentTotals, err := s.DB.GetSummaryTotals(ctx, db.GetSummaryTotalsParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(endDate),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	prevTotals, err := s.DB.GetSummaryTotals(ctx, db.GetSummaryTotalsParams{
		UserID:    userUUID,
		StartDate: timestamptz(prevStartDate),
		EndDate:   timestamptz(prevEndDate),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	transactionCount, err := s.DB.GetTransactionCountInRange(ctx, db.GetTransactionCountInRangeParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(endDate),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	categoryRows, err := s.DB.ListTopExpenseCategories(ctx, db.ListTopExpenseCategoriesParams{
		UserID:     userUUID,
		StartDate:  timestamptz(startDate),
		EndDate:    timestamptz(endDate),
		LimitCount: 3,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	topCategories := make([]*pb.CategoryInsight, 0, len(categoryRows))
	for _, row := range categoryRows {
		topCategories = append(topCategories, &pb.CategoryInsight{
			Name:       row.CategoryName,
			Icon:       row.CategoryIcon,
			TotalPaise: row.TotalPaise,
		})
	}

	var biggestSpend *pb.SpendInsight
	biggestSpendRow, err := s.DB.GetBiggestSpendInRange(ctx, db.GetBiggestSpendInRangeParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(endDate),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err == nil {
		biggestSpend = &pb.SpendInsight{
			Merchant:    biggestSpendRow.Merchant,
			AmountPaise: biggestSpendRow.AmountPaise,
			Date:        timestamppb.New(biggestSpendRow.Date.Time),
		}
	}

	streak, err := s.DB.GetTransactionDayStreak(ctx, db.GetTransactionDayStreakParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(endDate),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var leak *pb.LeakInsight
	leakRow, err := s.DB.GetLeakCategoryIncrease(ctx, db.GetLeakCategoryIncreaseParams{
		UserID:            userUUID,
		CurrentStartDate:  timestamptz(startDate),
		CurrentEndDate:    timestamptz(endDate),
		PreviousStartDate: timestamptz(prevStartDate),
		PreviousEndDate:   timestamptz(prevEndDate),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err == nil && leakRow.IncreasePaise > 0 {
		leak = &pb.LeakInsight{
			Category:      leakRow.CategoryName,
			IncreasePaise: leakRow.IncreasePaise,
		}
	}

	return connect.NewResponse(&pb.GetZineResponse{
		Period:           startDate.Format("2006-01"),
		TotalSpentPaise:  currentTotals.TotalExpenses,
		TotalIncomePaise: currentTotals.TotalIncome,
		TransactionCount: transactionCount,
		TopCategories:    topCategories,
		BiggestSpend:     biggestSpend,
		Streak:           streak,
		SavedVsPrevPaise: currentTotals.NetBalance - prevTotals.NetBalance,
		Leak:             leak,
	}), nil
}

func (s *InsightsService) GetHealthScore(ctx context.Context, req *connect.Request[pb.GetHealthScoreRequest]) (*connect.Response[pb.GetHealthScoreResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	now := time.Now().UTC()
	startDate := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	totals, err := s.DB.GetSummaryTotals(ctx, db.GetSummaryTotalsParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(now),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	savingsScore, savingsRate := savingsRateScore(totals.TotalIncome, totals.TotalExpenses)
	score := savingsScore
	description := "No income recorded for the current month yet."
	if totals.TotalIncome > 0 {
		description = "Savings rate is based on real month-to-date income and expense totals."
	}

	components := []*pb.HealthScoreComponent{
		{
			Name:        "Savings Rate",
			Score:       score,
			Weight:      100,
			Description: description,
		},
	}

	factors := []*pb.HealthScoreFactor{}
	insights := []*pb.HealthScoreInsight{}

	if totals.TotalIncome > 0 {
		if totals.NetBalance >= 0 {
			factors = append(factors, &pb.HealthScoreFactor{
				Type:        "positive",
				Title:       "Positive monthly cashflow",
				Description: "Income exceeds expenses based on recorded transactions.",
				Impact:      math.Round(savingsRate*100) / 100,
			})
		} else {
			factors = append(factors, &pb.HealthScoreFactor{
				Type:        "negative",
				Title:       "Negative monthly cashflow",
				Description: "Expenses exceed income for the current month-to-date window.",
				Impact:      math.Round(savingsRate*100) / 100,
			})
			insights = append(insights, &pb.HealthScoreInsight{
				Category: "Cashflow",
				Tip:      "Reduce discretionary spending or log missing income to improve your savings rate.",
				Priority: "high",
			})
		}
	}

	return connect.NewResponse(&pb.GetHealthScoreResponse{
		Score:      score,
		Components: components,
		Factors:    factors,
		Insights:   insights,
	}), nil
}

func authenticatedUserUUID(ctx context.Context) (pgtype.UUID, error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return pgtype.UUID{}, err
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return pgtype.UUID{}, err
	}
	return userUUID, nil
}

func monthRange(monthYear string, fallback time.Time) (time.Time, time.Time) {
	startDate, err := time.Parse("2006-01", monthYear)
	if err != nil {
		startDate = time.Date(fallback.Year(), fallback.Month(), 1, 0, 0, 0, 0, time.UTC)
	} else {
		startDate = time.Date(startDate.Year(), startDate.Month(), 1, 0, 0, 0, 0, time.UTC)
	}
	return startDate, startDate.AddDate(0, 1, 0)
}

func timestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}

func savingsRateScore(totalIncome, totalExpenses int64) (int32, float64) {
	if totalIncome <= 0 {
		return 0, 0
	}

	savingsRate := (float64(totalIncome-totalExpenses) / float64(totalIncome)) * 100
	clamped := math.Max(0, math.Min(100, savingsRate))
	return int32(math.Round(clamped)), savingsRate
}
