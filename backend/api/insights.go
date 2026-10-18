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
		return nil, ErrorUnauthenticated(err.Error())
	}

	startDate, endDate := monthRange(req.Msg.MonthYear, time.Now().UTC())
	totals, err := s.DB.GetSummaryTotals(ctx, db.GetSummaryTotalsParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(endDate),
	})
	if err != nil {
		if isMockMode() {
			return connect.NewResponse(getMockSummary()), nil
		}
		return nil, ErrorInternal("internal system error")
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
		return nil, ErrorUnauthenticated(err.Error())
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
		return nil, ErrorInternal("internal system error")
	}

	prevTotals, err := s.DB.GetSummaryTotals(ctx, db.GetSummaryTotalsParams{
		UserID:    userUUID,
		StartDate: timestamptz(prevStartDate),
		EndDate:   timestamptz(prevEndDate),
	})
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}

	transactionCount, err := s.DB.GetTransactionCountInRange(ctx, db.GetTransactionCountInRangeParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(endDate),
	})
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}

	categoryRows, err := s.DB.ListTopExpenseCategories(ctx, db.ListTopExpenseCategoriesParams{
		UserID:     userUUID,
		StartDate:  timestamptz(startDate),
		EndDate:    timestamptz(endDate),
		LimitCount: 3,
	})
	if err != nil {
		return nil, ErrorInternal("internal system error")
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
		return nil, ErrorInternal("internal system error")
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
		return nil, ErrorInternal("internal system error")
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
		return nil, ErrorInternal("internal system error")
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
		return nil, ErrorUnauthenticated(err.Error())
	}

	now := time.Now().In(indiaLocation)
	startDate := indiaMonthStart(now)
	totals, err := s.DB.GetSummaryTotals(ctx, db.GetSummaryTotalsParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(now),
	})
	if err != nil {
		if isMockMode() {
			return connect.NewResponse(getMockHealthScore()), nil
		}
		return nil, ErrorInternal("internal system error")
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
	startDate, err := time.ParseInLocation("2006-01", monthYear, indiaLocation)
	if err != nil {
		local := fallback.In(indiaLocation)
		startDate = indiaMonthStart(local)
	} else {
		startDate = indiaMonthStart(startDate)
	}
	return startDate, startDate.AddDate(0, 1, 0)
}

func indiaMonthStart(value time.Time) time.Time {
	local := value.In(indiaLocation)
	return time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, indiaLocation)
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

func (s *InsightsService) GetSpendingAnalytics(ctx context.Context, req *connect.Request[pb.GetSpendingAnalyticsRequest]) (*connect.Response[pb.GetSpendingAnalyticsResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}

	now := time.Now().UTC()
	startDate, endDate := monthRange(req.Msg.MonthYear, now)
	prevStartDate := startDate.AddDate(0, -1, 0)
	prevEndDate := startDate

	categoryRows, err := s.DB.ListTopExpenseCategories(ctx, db.ListTopExpenseCategoriesParams{
		UserID:     userUUID,
		StartDate:  timestamptz(startDate),
		EndDate:    timestamptz(endDate),
		LimitCount: 5,
	})
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}

	topCategories := make([]*pb.CategoryInsight, 0, len(categoryRows))
	for _, row := range categoryRows {
		topCategories = append(topCategories, &pb.CategoryInsight{
			Name:       row.CategoryName,
			Icon:       row.CategoryIcon,
			TotalPaise: row.TotalPaise,
		})
	}

	trendRows, err := s.DB.GetCategoryTrends(ctx, db.GetCategoryTrendsParams{
		UserID:            userUUID,
		CurrentStartDate:  timestamptz(startDate),
		CurrentEndDate:    timestamptz(endDate),
		PreviousStartDate: timestamptz(prevStartDate),
		PreviousEndDate:   timestamptz(prevEndDate),
	})
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}

	trends := make([]*pb.CategoryTrend, 0, len(trendRows))
	for _, row := range trendRows {
		trends = append(trends, &pb.CategoryTrend{
			CategoryName:    row.CategoryName,
			CategoryIcon:    row.CategoryIcon,
			CurrentPaise:    row.CurrentPaise,
			PreviousPaise:   row.PreviousPaise,
			DifferencePaise: row.DifferencePaise,
		})
	}

	return connect.NewResponse(&pb.GetSpendingAnalyticsResponse{
		Trends:        trends,
		TopCategories: topCategories,
	}), nil
}

func (s *InsightsService) GetMerchantInsights(ctx context.Context, req *connect.Request[pb.GetMerchantInsightsRequest]) (*connect.Response[pb.GetMerchantInsightsResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}

	now := time.Now().UTC()
	startDate, endDate := monthRange(req.Msg.MonthYear, now)
	prevStartDate := startDate.AddDate(0, -1, 0)
	prevEndDate := startDate

	topMerchantsRows, err := s.DB.ListTopMerchants(ctx, db.ListTopMerchantsParams{
		UserID:     userUUID,
		StartDate:  timestamptz(startDate),
		EndDate:    timestamptz(endDate),
		LimitCount: 5,
	})
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}

	topMerchants := make([]*pb.MerchantTrend, 0, len(topMerchantsRows))
	for _, row := range topMerchantsRows {
		topMerchants = append(topMerchants, &pb.MerchantTrend{
			Merchant:     row.Merchant,
			CurrentPaise: row.TotalPaise,
		})
	}

	trendRows, err := s.DB.GetMerchantTrends(ctx, db.GetMerchantTrendsParams{
		UserID:            userUUID,
		CurrentStartDate:  timestamptz(startDate),
		CurrentEndDate:    timestamptz(endDate),
		PreviousStartDate: timestamptz(prevStartDate),
		PreviousEndDate:   timestamptz(prevEndDate),
	})
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}

	trends := make([]*pb.MerchantTrend, 0, len(trendRows))
	var savingsOpportunities []*pb.SavingsOpportunity

	for _, row := range trendRows {
		trends = append(trends, &pb.MerchantTrend{
			Merchant:        row.Merchant,
			CurrentPaise:    row.CurrentPaise,
			PreviousPaise:   row.PreviousPaise,
			CurrentCount:    row.CurrentCount,
			DifferencePaise: row.DifferencePaise,
		})

		// Savings opportunity logic: High frequency small spends
		if row.CurrentCount > 4 {
			avgSpend := float64(row.CurrentPaise) / float64(row.CurrentCount)
			if avgSpend < 50000 { // under 500 INR
				savingsOpportunities = append(savingsOpportunities, &pb.SavingsOpportunity{
					Type:                  "HIGH_FREQUENCY_SMALL_SPENDS",
					Merchant:              row.Merchant,
					Description:           "Frequent small spends detected. Consider consolidating.",
					PotentialSavingsPaise: row.CurrentPaise,
				})
			}
		}
	}

	return connect.NewResponse(&pb.GetMerchantInsightsResponse{
		Trends:               trends,
		TopMerchants:         topMerchants,
		SavingsOpportunities: savingsOpportunities,
	}), nil
}

func (s *InsightsService) GetEmergencyFundProgress(ctx context.Context, req *connect.Request[pb.GetEmergencyFundProgressRequest]) (*connect.Response[pb.GetEmergencyFundProgressResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}

	// Average monthly expense over the last 6 months
	now := time.Now().In(indiaLocation)
	endDate := indiaMonthStart(now)
	startDate := endDate.AddDate(0, -6, 0)

	avgExpense, err := s.DB.GetAverageMonthlyExpense(ctx, db.GetAverageMonthlyExpenseParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(endDate),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrorInternal("internal system error")
	}

	// Calculate total balance from all time
	totals, err := s.DB.GetSummaryTotals(ctx, db.GetSummaryTotalsParams{
		UserID:    userUUID,
		StartDate: timestamptz(time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)), // far past
		EndDate:   timestamptz(time.Now().UTC().AddDate(1, 0, 0)),           // future
	})
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}

	currentBalance := totals.NetBalance
	if currentBalance < 0 {
		currentBalance = 0
	}

	var runway float64 = 0
	if avgExpense > 0 {
		runway = float64(currentBalance) / float64(avgExpense)
	}

	return connect.NewResponse(&pb.GetEmergencyFundProgressResponse{
		Progress: &pb.EmergencyFundProgress{
			CurrentBalancePaise:        currentBalance,
			AverageMonthlyExpensePaise: avgExpense,
			MonthsOfRunway:             runway,
			Target_1MonthPaise:         avgExpense,
			Target_3MonthPaise:         avgExpense * 3,
			Target_6MonthPaise:         avgExpense * 6,
		},
	}), nil
}
