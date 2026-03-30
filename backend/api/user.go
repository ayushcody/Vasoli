package api

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type UserService struct {
	DB *db.Queries
}

func (s *UserService) GetProfile(ctx context.Context, req *connect.Request[pb.GetProfileRequest]) (*connect.Response[pb.GetProfileResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	user, err := s.DB.GetUser(ctx, userUUID)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeInternal, err)
		}

		user, err = s.DB.CreateUser(ctx, db.CreateUserParams{
			ID:        userUUID,
			Email:     UserEmailFromContext(ctx),
			Name:      "",
			AvatarUrl: "",
		})
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	return connect.NewResponse(&pb.GetProfileResponse{
		User: mapUser(user),
	}), nil
}

func (s *UserService) UpdateProfile(ctx context.Context, req *connect.Request[pb.UpdateProfileRequest]) (*connect.Response[pb.UpdateProfileResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	currentUser, err := s.DB.GetUser(ctx, userUUID)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeInternal, err)
		}

		currentUser, err = s.DB.CreateUser(ctx, db.CreateUserParams{
			ID:        userUUID,
			Email:     UserEmailFromContext(ctx),
			Name:      "",
			AvatarUrl: "",
		})
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	user, err := s.DB.UpdateUser(ctx, db.UpdateUserParams{
		ID:        userUUID,
		Email:     pgtype.Text{String: currentUser.Email, Valid: true},
		Name:      optionalText(req.Msg.Name),
		AvatarUrl: optionalText(req.Msg.AvatarUrl),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UpdateProfileResponse{
		User: mapUser(user),
	}), nil
}

func (s *UserService) GetWealthAnalytics(ctx context.Context, req *connect.Request[pb.GetWealthAnalyticsRequest]) (*connect.Response[pb.GetWealthAnalyticsResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	startDate := time.Date(1970, time.January, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Now().UTC().AddDate(0, 0, 1)

	summary, err := s.DB.GetSummaryTotals(ctx, db.GetSummaryTotalsParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(endDate),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	analytics, err := s.DB.GetWealthAnalytics(ctx, db.GetWealthAnalyticsParams{
		UserID:    userUUID,
		StartDate: timestamptz(startDate),
		EndDate:   timestamptz(endDate),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.GetWealthAnalyticsResponse{
		Saved:    float64(summary.NetBalance) / 100,
		Spent:    float64(summary.TotalExpenses) / 100,
		Invested: float64(analytics.Invested) / 100,
	}), nil
}

func mapUser(user db.User) *pb.User {
	mapped := &pb.User{
		Id:        UUIDToString(user.ID),
		Email:     user.Email,
		Name:      user.Name,
		AvatarUrl: user.AvatarUrl,
	}

	if user.CreatedAt.Valid {
		mapped.CreatedAt = timestamppb.New(user.CreatedAt.Time)
	}
	if user.UpdatedAt.Valid {
		mapped.UpdatedAt = timestamppb.New(user.UpdatedAt.Time)
	}

	return mapped
}
