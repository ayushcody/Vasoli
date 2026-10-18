package api

import (
	"os"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

func isMockMode() bool {
	return os.Getenv("BYPASS_AUTH") == "true" && !isProduction()
}

func isProduction() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("ENV")), "production")
}

func getMockTransactions() []*pb.Transaction {
	now := time.Now().UTC()
	return []*pb.Transaction{
		{
			Id:          "mock-tx-1",
			AmountPaise: 450000,
			Description: "Amazon.in purchase",
			Date:        timestamppb.New(now.Add(-2 * 24 * time.Hour)),
			Type:        "EXPENSE",
			Status:      "POSTED",
			Provenance:  "MOCK",
		},
		{
			Id:          "mock-tx-2",
			AmountPaise: 12000000,
			Description: "Monthly Salary",
			Date:        timestamppb.New(now.Add(-10 * 24 * time.Hour)),
			Type:        "INCOME",
			Status:      "POSTED",
			Provenance:  "MOCK",
		},
		{
			Id:          "mock-tx-3",
			AmountPaise: 250000,
			Description: "Starbucks Coffee",
			Date:        timestamppb.New(now.Add(-1 * 24 * time.Hour)),
			Type:        "EXPENSE",
			Status:      "POSTED",
			Provenance:  "MOCK",
		},
	}
}

func getMockSummary() *pb.GetSummaryResponse {
	return &pb.GetSummaryResponse{
		TotalIncomePaise:  12000000,
		TotalExpensePaise: 700000,
		BalancePaise:      11300000,
	}
}

func getMockHealthScore() *pb.GetHealthScoreResponse {
	return &pb.GetHealthScoreResponse{
		Score: 85,
		Components: []*pb.HealthScoreComponent{
			{
				Name:        "Savings Rate",
				Score:       90,
				Weight:      100,
				Description: "Your savings rate is excellent this month.",
			},
		},
		Factors: []*pb.HealthScoreFactor{
			{
				Type:        "positive",
				Title:       "High Savings Rate",
				Description: "You saved more than 20% of your income.",
				Impact:      15,
			},
		},
		Insights: []*pb.HealthScoreInsight{
			{
				Category: "Savings",
				Tip:      "Consider moving some surplus to your long-term goal.",
				Priority: "medium",
			},
		},
	}
}

func getMockUser() *pb.User {
	return &pb.User{
		Id:    "00000000-0000-0000-0000-000000000000",
		Email: "dev@vasoli.com",
		Name:  "Dev User",
	}
}

func getMockGoals() []*pb.Goal {
	color := "#FF6B6B"
	desc := "Saving for a new car"
	return []*pb.Goal{
		{
			Id:                 "mock-goal-1",
			Name:               "New Car",
			TargetAmountPaise:  1500000,
			CurrentAmountPaise: 450000,
			Status:             "ACTIVE",
			Color:              &color,
			Description:        &desc,
		},
	}
}

func getMockReceipts() []*pb.Receipt {
	return []*pb.Receipt{
		{
			Id:          "mock-receipt-1",
			Merchant:    "Croma",
			AmountPaise: 25000,
			CreatedAt:   timestamppb.New(time.Now().Add(-30 * 24 * time.Hour)),
		},
	}
}

func getMockRecurringRules() []*pb.RecurringRule {
	return []*pb.RecurringRule{
		{
			Id:           "mock-recurring-1",
			MerchantNorm: "Netflix",
			AmountPaise:  19900,
			Type:         "EXPENSE",
			Cadence:      "monthly",
			NextDueDate:  timestamppb.New(time.Now().Add(5 * 24 * time.Hour)),
			Active:       true,
		},
	}
}
