package api

import (
	"context"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type GoalService struct {
	DB   *db.Queries
	Pool *pgxpool.Pool
}

func (s *GoalService) CreateGoal(ctx context.Context, req *connect.Request[pb.CreateGoalRequest]) (*connect.Response[pb.CreateGoalResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	params := db.CreateGoalParams{
		UserID:            userUUID,
		Name:              req.Msg.Name,
		Description:       pgtype.Text{String: req.Msg.GetDescription(), Valid: req.Msg.Description != nil},
		TargetAmountPaise: req.Msg.TargetAmountPaise,
		DueDate:           pgtype.Timestamptz{Time: req.Msg.GetDueDate().AsTime(), Valid: req.Msg.DueDate != nil},
		Color:             pgtype.Text{String: req.Msg.GetColor(), Valid: req.Msg.Color != nil},
		Icon:              pgtype.Text{String: req.Msg.GetIcon(), Valid: req.Msg.Icon != nil},
		Active:            true,
	}

	goal, err := s.DB.CreateGoal(ctx, params)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// Trigger achievements
	go func(u pgtype.UUID) {
		_ = awardAchievementIfEligible(context.Background(), s.DB, u, "FIRST_GOAL")
		// if goal name is emergency fund, trigger that too
		if req.Msg.Name == "Emergency Fund" || req.Msg.Name == "Emergency" {
			_ = awardAchievementIfEligible(context.Background(), s.DB, u, "EMERGENCY_STARTER")
		}
	}(userUUID)

	return connect.NewResponse(&pb.CreateGoalResponse{
		Goal: s.mapGoal(goal),
	}), nil
}

func (s *GoalService) GetGoal(ctx context.Context, req *connect.Request[pb.GetGoalRequest]) (*connect.Response[pb.GetGoalResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	var goalUUID pgtype.UUID
	_ = goalUUID.Scan(req.Msg.Id)

	goal, err := s.DB.GetGoal(ctx, db.GetGoalParams{
		ID:     goalUUID,
		UserID: userUUID,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&pb.GetGoalResponse{
		Goal: s.mapGoal(goal),
	}), nil
}

func (s *GoalService) ListGoals(ctx context.Context, req *connect.Request[pb.ListGoalsRequest]) (*connect.Response[pb.ListGoalsResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	goals, err := s.DB.ListGoals(ctx, userUUID)
	if err != nil {
		if isMockMode() {
			return connect.NewResponse(&pb.ListGoalsResponse{
				Goals: getMockGoals(),
			}), nil
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var pbGoals []*pb.Goal
	for _, g := range goals {
		pbGoals = append(pbGoals, s.mapGoal(g))
	}

	return connect.NewResponse(&pb.ListGoalsResponse{
		Goals: pbGoals,
	}), nil
}

func (s *GoalService) UpdateGoal(ctx context.Context, req *connect.Request[pb.UpdateGoalRequest]) (*connect.Response[pb.UpdateGoalResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	var goalUUID pgtype.UUID
	_ = goalUUID.Scan(req.Msg.Id)

	goal, err := s.DB.UpdateGoal(ctx, db.UpdateGoalParams{
		ID:                goalUUID,
		UserID:            userUUID,
		Name:              pgtype.Text{String: req.Msg.GetName(), Valid: req.Msg.Name != nil},
		TargetAmountPaise: pgtype.Int8{Int64: req.Msg.GetTargetAmountPaise(), Valid: req.Msg.TargetAmountPaise != nil},
		Status:            pgtype.Text{String: req.Msg.GetStatus(), Valid: req.Msg.Status != nil},
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UpdateGoalResponse{
		Goal: s.mapGoal(goal),
	}), nil
}

func (s *GoalService) DeleteGoal(ctx context.Context, req *connect.Request[pb.DeleteGoalRequest]) (*connect.Response[pb.DeleteGoalResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	var goalUUID pgtype.UUID
	_ = goalUUID.Scan(req.Msg.Id)

	err = s.DB.DeleteGoal(ctx, db.DeleteGoalParams{
		ID:     goalUUID,
		UserID: userUUID,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.DeleteGoalResponse{}), nil
}

func (s *GoalService) AddContribution(ctx context.Context, req *connect.Request[pb.AddContributionRequest]) (*connect.Response[pb.AddContributionResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}
	var goalUUID pgtype.UUID
	if err := goalUUID.Scan(req.Msg.GoalId); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	if _, err := s.DB.GetGoal(ctx, db.GetGoalParams{ID: goalUUID, UserID: userUUID}); err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	// Add contribution
	_, err = s.DB.AddGoalContribution(ctx, db.AddGoalContributionParams{
		GoalID:      goalUUID,
		AmountPaise: req.Msg.AmountPaise,
		Note:        pgtype.Text{String: req.Msg.GetNote(), Valid: req.Msg.Note != nil},
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// Update goal current amount
	goal, err := s.DB.UpdateGoalCurrentAmount(ctx, db.UpdateGoalCurrentAmountParams{
		CurrentAmountPaise: req.Msg.AmountPaise,
		ID:                 goalUUID,
		UserID:             userUUID,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.AddContributionResponse{
		Goal: s.mapGoal(goal),
	}), nil
}

func (s *GoalService) mapGoal(g db.Goal) *pb.Goal {
	return &pb.Goal{
		Id:                 UUIDToString(g.ID),
		Name:               g.Name,
		Description:        &g.Description.String,
		TargetAmountPaise:  g.TargetAmountPaise,
		CurrentAmountPaise: g.CurrentAmountPaise,
		DueDate:            timestamppb.New(g.DueDate.Time),
		Status:             g.Status,
		Color:              &g.Color.String,
		Icon:               &g.Icon.String,
		CreatedAt:          timestamppb.New(g.CreatedAt.Time),
		Cadence:            g.Cadence.String,
		Active:             g.Active,
	}
}
