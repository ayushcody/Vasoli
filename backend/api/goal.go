package api

import (
	"context"

	"connectrpc.com/connect"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type GoalService struct {
	DB *db.Queries
}

func (s *GoalService) CreateGoal(ctx context.Context, req *connect.Request[pb.CreateGoalRequest]) (*connect.Response[pb.CreateGoalResponse], error) {
	res := connect.NewResponse(&pb.CreateGoalResponse{
		Goal: &pb.Goal{
			Id:           "mock-goal-id",
			Name:         req.Msg.Name,
			TargetAmount: req.Msg.TargetAmount,
		},
	})
	return res, nil
}

func (s *GoalService) ListGoals(ctx context.Context, req *connect.Request[pb.ListGoalsRequest]) (*connect.Response[pb.ListGoalsResponse], error) {
	res := connect.NewResponse(&pb.ListGoalsResponse{
		Goals: []*pb.Goal{},
	})
	return res, nil
}

func (s *GoalService) UpdateGoal(ctx context.Context, req *connect.Request[pb.UpdateGoalRequest]) (*connect.Response[pb.UpdateGoalResponse], error) {
	res := connect.NewResponse(&pb.UpdateGoalResponse{
		Goal: &pb.Goal{
			Id: req.Msg.Id,
		},
	})
	return res, nil
}

func (s *GoalService) DeleteGoal(ctx context.Context, req *connect.Request[pb.DeleteGoalRequest]) (*connect.Response[pb.DeleteGoalResponse], error) {
	res := connect.NewResponse(&pb.DeleteGoalResponse{})
	return res, nil
}

func (s *GoalService) AddContribution(ctx context.Context, req *connect.Request[pb.AddContributionRequest]) (*connect.Response[pb.AddContributionResponse], error) {
	res := connect.NewResponse(&pb.AddContributionResponse{
		Goal: &pb.Goal{
			Id: req.Msg.GoalId,
		},
	})
	return res, nil
}
