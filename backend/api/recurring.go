package api

import (
	"context"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5/pgtype"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type RecurringService struct {
	DB *db.Queries
}

func (s *RecurringService) ListCandidates(ctx context.Context, req *connect.Request[pb.ListCandidatesRequest]) (*connect.Response[pb.ListCandidatesResponse], error) {
	// Not implemented full algorithm for MVP, returning empty
	return connect.NewResponse(&pb.ListCandidatesResponse{}), nil
}

func (s *RecurringService) CreateRuleFromCandidate(ctx context.Context, req *connect.Request[pb.CreateRuleFromCandidateRequest]) (*connect.Response[pb.CreateRuleFromCandidateResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	rule, err := s.DB.CreateRecurringRule(ctx, db.CreateRecurringRuleParams{
		UserID:       userUUID,
		MerchantNorm: req.Msg.MerchantNorm,
		AmountPaise:  req.Msg.AmountPaise,
		Cadence:      req.Msg.Cadence,
		NextDueDate:  pgtype.Timestamptz{Time: req.Msg.NextDueDate.AsTime(), Valid: true},
		Active:       true,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	idStr := UUIDToString(rule.ID)

	return connect.NewResponse(&pb.CreateRuleFromCandidateResponse{
		Rule: &pb.RecurringRule{
			Id:           idStr,
			UserId:       userID,
			MerchantNorm: rule.MerchantNorm,
			AmountPaise:  rule.AmountPaise,
			Cadence:      rule.Cadence,
			Active:       rule.Active,
		},
	}), nil
}

func (s *RecurringService) ListRules(ctx context.Context, req *connect.Request[pb.ListRecurringRulesRequest]) (*connect.Response[pb.ListRecurringRulesResponse], error) {
	return connect.NewResponse(&pb.ListRecurringRulesResponse{}), nil
}

func (s *RecurringService) GetRule(ctx context.Context, req *connect.Request[pb.GetRuleRequest]) (*connect.Response[pb.GetRuleResponse], error) {
	return connect.NewResponse(&pb.GetRuleResponse{}), nil
}

func (s *RecurringService) UpdateRule(ctx context.Context, req *connect.Request[pb.UpdateRuleRequest]) (*connect.Response[pb.UpdateRuleResponse], error) {
	return connect.NewResponse(&pb.UpdateRuleResponse{}), nil
}

func (s *RecurringService) DeleteRule(ctx context.Context, req *connect.Request[pb.DeleteRuleRequest]) (*connect.Response[pb.DeleteRuleResponse], error) {
	return connect.NewResponse(&pb.DeleteRuleResponse{}), nil
}

func (s *RecurringService) ListUpcoming(ctx context.Context, req *connect.Request[pb.ListUpcomingRequest]) (*connect.Response[pb.ListUpcomingResponse], error) {
	return connect.NewResponse(&pb.ListUpcomingResponse{}), nil
}

func (s *RecurringService) SnoozeRule(ctx context.Context, req *connect.Request[pb.SnoozeRuleRequest]) (*connect.Response[pb.SnoozeRuleResponse], error) {
	return connect.NewResponse(&pb.SnoozeRuleResponse{}), nil
}

func (s *RecurringService) CancelRule(ctx context.Context, req *connect.Request[pb.CancelRuleRequest]) (*connect.Response[pb.CancelRuleResponse], error) {
	return connect.NewResponse(&pb.CancelRuleResponse{}), nil
}
