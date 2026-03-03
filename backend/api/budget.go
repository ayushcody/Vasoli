package api

import (
	"context"

	"connectrpc.com/connect"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type BudgetService struct {
	DB *db.Queries
}

func (s *BudgetService) CreateBudget(ctx context.Context, req *connect.Request[pb.CreateBudgetRequest]) (*connect.Response[pb.CreateBudgetResponse], error) {
	res := connect.NewResponse(&pb.CreateBudgetResponse{
		Budget: &pb.Budget{
			Id:     "mock-budget-id",
			Name:   req.Msg.Name,
			Amount: req.Msg.Amount,
		},
	})
	return res, nil
}

func (s *BudgetService) ListBudgets(ctx context.Context, req *connect.Request[pb.ListBudgetsRequest]) (*connect.Response[pb.ListBudgetsResponse], error) {
	res := connect.NewResponse(&pb.ListBudgetsResponse{
		Budgets: []*pb.Budget{},
	})
	return res, nil
}

func (s *BudgetService) UpdateBudget(ctx context.Context, req *connect.Request[pb.UpdateBudgetRequest]) (*connect.Response[pb.UpdateBudgetResponse], error) {
	res := connect.NewResponse(&pb.UpdateBudgetResponse{
		Budget: &pb.Budget{
			Id: req.Msg.Id,
		},
	})
	return res, nil
}

func (s *BudgetService) DeleteBudget(ctx context.Context, req *connect.Request[pb.DeleteBudgetRequest]) (*connect.Response[pb.DeleteBudgetResponse], error) {
	res := connect.NewResponse(&pb.DeleteBudgetResponse{})
	return res, nil
}
