package api

import (
	"context"
	"errors"
	"strings"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

var validBudgetPeriods = map[string]struct{}{
	"WEEKLY":    {},
	"MONTHLY":   {},
	"QUARTERLY": {},
	"YEARLY":    {},
}

type BudgetService struct {
	DB *db.Queries
}

func (s *BudgetService) CreateBudget(ctx context.Context, req *connect.Request[pb.CreateBudgetRequest]) (*connect.Response[pb.CreateBudgetResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}
	if req.Msg.StartDate == nil || req.Msg.EndDate == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("start_date and end_date are required"))
	}
	if req.Msg.AmountPaise <= 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("amount must be greater than zero"))
	}

	period, err := normalizeBudgetPeriod(req.Msg.Period)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	startDate := req.Msg.StartDate.AsTime().UTC()
	endDate := req.Msg.EndDate.AsTime().UTC()
	if !startDate.Before(endDate) {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("start_date must be before end_date"))
	}

	budget, err := s.DB.CreateBudget(ctx, db.CreateBudgetParams{
		UserID:      userUUID,
		Name:        req.Msg.Name,
		AmountPaise: req.Msg.AmountPaise,
		Period:      period,
		StartDate:   pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:     pgtype.Timestamptz{Time: endDate, Valid: true},
		Categories:  req.Msg.Categories,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	spentPaise, err := s.calculateBudgetSpent(ctx, userUUID, budget)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.CreateBudgetResponse{
		Budget: mapBudget(budget, spentPaise),
	}), nil
}

func (s *BudgetService) ListBudgets(ctx context.Context, req *connect.Request[pb.ListBudgetsRequest]) (*connect.Response[pb.ListBudgetsResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	budgets, err := s.DB.ListBudgets(ctx, userUUID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	items := make([]*pb.Budget, 0, len(budgets))
	for _, budget := range budgets {
		spentPaise, err := s.calculateBudgetSpent(ctx, userUUID, budget)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		items = append(items, mapBudget(budget, spentPaise))
	}

	return connect.NewResponse(&pb.ListBudgetsResponse{
		Budgets: items,
	}), nil
}

func (s *BudgetService) UpdateBudget(ctx context.Context, req *connect.Request[pb.UpdateBudgetRequest]) (*connect.Response[pb.UpdateBudgetResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	budgetUUID, err := parseUUID(req.Msg.Id, "budget id")
	if err != nil {
		return nil, err
	}

	period := pgtype.Text{}
	if req.Msg.Period != nil {
		normalizedPeriod, err := normalizeBudgetPeriod(req.Msg.GetPeriod())
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		period = pgtype.Text{String: normalizedPeriod, Valid: true}
	}

	if req.Msg.AmountPaise != nil && req.Msg.GetAmountPaise() <= 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("amount must be greater than zero"))
	}

	budget, err := s.DB.UpdateBudget(ctx, db.UpdateBudgetParams{
		ID:          budgetUUID,
		UserID:      userUUID,
		Name:        optionalText(req.Msg.Name),
		AmountPaise: optionalInt8(req.Msg.AmountPaise),
		Period:      period,
		Categories:  optionalText(req.Msg.Categories),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("budget not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	spentPaise, err := s.calculateBudgetSpent(ctx, userUUID, budget)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UpdateBudgetResponse{
		Budget: mapBudget(budget, spentPaise),
	}), nil
}

func (s *BudgetService) DeleteBudget(ctx context.Context, req *connect.Request[pb.DeleteBudgetRequest]) (*connect.Response[pb.DeleteBudgetResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	budgetUUID, err := parseUUID(req.Msg.Id, "budget id")
	if err != nil {
		return nil, err
	}

	if _, err := s.DB.GetBudget(ctx, db.GetBudgetParams{
		ID:     budgetUUID,
		UserID: userUUID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("budget not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if err := s.DB.DeleteBudget(ctx, db.DeleteBudgetParams{
		ID:     budgetUUID,
		UserID: userUUID,
	}); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.DeleteBudgetResponse{}), nil
}

func (s *BudgetService) calculateBudgetSpent(ctx context.Context, userUUID pgtype.UUID, budget db.Budget) (int64, error) {
	categoryIDs := parseBudgetCategories(budget.Categories)
	if len(categoryIDs) == 0 {
		return s.DB.SumBudgetSpentAllCategories(ctx, db.SumBudgetSpentAllCategoriesParams{
			UserID:    userUUID,
			StartDate: budget.StartDate,
			EndDate:   budget.EndDate,
		})
	}

	return s.DB.SumBudgetSpentByCategories(ctx, db.SumBudgetSpentByCategoriesParams{
		UserID:      userUUID,
		StartDate:   budget.StartDate,
		EndDate:     budget.EndDate,
		CategoryIds: categoryIDs,
	})
}

func mapBudget(budget db.Budget, spentPaise int64) *pb.Budget {
	item := &pb.Budget{
		Id:          UUIDToString(budget.ID),
		Name:        budget.Name,
		AmountPaise: budget.AmountPaise,
		Period:      budget.Period,
		Categories:  budget.Categories,
		UserId:      UUIDToString(budget.UserID),
		SpentPaise:  spentPaise,
	}

	if budget.StartDate.Valid {
		item.StartDate = timestamppb.New(budget.StartDate.Time)
	}
	if budget.EndDate.Valid {
		item.EndDate = timestamppb.New(budget.EndDate.Time)
	}
	if budget.CreatedAt.Valid {
		item.CreatedAt = timestamppb.New(budget.CreatedAt.Time)
	}
	if budget.UpdatedAt.Valid {
		item.UpdatedAt = timestamppb.New(budget.UpdatedAt.Time)
	}

	return item
}

func normalizeBudgetPeriod(value string) (string, error) {
	period := strings.ToUpper(strings.TrimSpace(value))
	if _, ok := validBudgetPeriods[period]; !ok {
		return "", errors.New("period must be one of WEEKLY, MONTHLY, QUARTERLY, or YEARLY")
	}
	return period, nil
}

func parseBudgetCategories(categories string) []string {
	if categories == "" {
		return nil
	}

	parts := strings.Split(categories, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			items = append(items, trimmed)
		}
	}
	return items
}
