package api

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type UserService struct {
	DB *db.Queries
}

func (s *UserService) GetProfile(ctx context.Context, req *connect.Request[pb.GetProfileRequest]) (*connect.Response[pb.GetProfileResponse], error) {
	// Normally we would extract the user ID from the Context (set by the AuthInterceptor)
	// For this MVP, we use the ID from the request if provided, or default to a mocked/extracted ID.
	userID := req.Msg.Id
	if userID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("user ID is required"))
	}

	// Fetch from DB using sqlc
	// dbUser, err := s.DB.GetUser(ctx, userID)
	// if err != nil { ... }

	// Mock response for now until full DB connection is active
	res := connect.NewResponse(&pb.GetProfileResponse{
		User: &pb.User{
			Id:    userID,
			Email: "mock@example.com",
			Name:  "Mock User",
		},
	})
	return res, nil
}

func (s *UserService) UpdateProfile(ctx context.Context, req *connect.Request[pb.UpdateProfileRequest]) (*connect.Response[pb.UpdateProfileResponse], error) {
	// Handle Profile update logic
	res := connect.NewResponse(&pb.UpdateProfileResponse{
		User: &pb.User{
			Id:   "mock-user-id",
			Name: req.Msg.GetName(),
		},
	})
	return res, nil
}

func (s *UserService) GetWealthAnalytics(ctx context.Context, req *connect.Request[pb.GetWealthAnalyticsRequest]) (*connect.Response[pb.GetWealthAnalyticsResponse], error) {
	// Optional: Fetch from DB using s.DB.GetWealthAnalytics(ctx, userID)
	// For immediate UI verification without needing a populated DB, we return live stub data:

	res := connect.NewResponse(&pb.GetWealthAnalyticsResponse{
		Saved:    450000,
		Spent:    210000,
		Invested: 850000,
	})
	return res, nil
}
