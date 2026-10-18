package api

import (
	"context"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
	"vasoli-backend/internal/gen/vasoli/v1/v1connect"
)

type AchievementService struct {
	v1connect.UnimplementedAchievementServiceHandler
	DB *db.Queries
}

func (s *AchievementService) ListAchievements(
	ctx context.Context,
	req *connect.Request[pb.ListAchievementsRequest],
) (*connect.Response[pb.ListAchievementsResponse], error) {
	// 1. Authenticate user
	userID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	// 2. Fetch all achievements
	allAchievements, err := s.DB.ListAchievements(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 3. Fetch user achievements to see which are awarded
	userAchievements, err := s.DB.ListUserAchievements(ctx, userID)
	if err != nil && err != pgx.ErrNoRows {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// Map awarded timestamps
	awardedMap := make(map[string]pgtype.Timestamptz)
	for _, ua := range userAchievements {
		awardedMap[ua.ID.String()] = ua.AwardedAt
	}

	// 4. Map to protobuf
	var res []*pb.Achievement
	for _, a := range allAchievements {
		ach := &pb.Achievement{
			Id:          a.ID.String(),
			Code:        a.Code,
			Title:       a.Title,
			Description: a.Description,
			Icon:        a.Icon.String,
		}
		if awardedAt, ok := awardedMap[a.ID.String()]; ok && awardedAt.Valid {
			ach.AwardedAt = timestamppb.New(awardedAt.Time)
		}
		res = append(res, ach)
	}

	return connect.NewResponse(&pb.ListAchievementsResponse{
		Achievements: res,
	}), nil
}

// Internal helper for triggering achievements from other services
func awardAchievementIfEligible(ctx context.Context, queries *db.Queries, userID pgtype.UUID, code string) error {
	// Check if already awarded
	awarded, err := queries.CheckAchievementAwarded(ctx, db.CheckAchievementAwardedParams{
		UserID: userID,
		Code:   code,
	})
	if err != nil {
		return err
	}
	if awarded {
		return nil // Already awarded
	}

	// Try to award it
	_, err = queries.AwardAchievement(ctx, db.AwardAchievementParams{
		UserID: userID,
		Code:   code,
	})
	return err
}
