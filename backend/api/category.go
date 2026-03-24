package api

import (
	"context"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5/pgtype"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type CategoryService struct {
	DB *db.Queries
}

func (s *CategoryService) ListCategories(
	ctx context.Context,
	req *connect.Request[pb.ListCategoriesRequest],
) (*connect.Response[pb.ListCategoriesResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var uuid pgtype.UUID
	if err := uuid.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	dbCategories, err := s.DB.ListCategories(ctx, uuid)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	categories := make([]*pb.Category, 0, len(dbCategories))
	for _, c := range dbCategories {
		id := UUIDToString(c.ID)

		categories = append(categories, &pb.Category{
			Id:        id,
			Name:      c.Name,
			Type:      c.Type,
			Color:     c.Color,
			Icon:      c.Icon,
			IsDefault: c.IsDefault.Bool,
		})
	}

	return connect.NewResponse(&pb.ListCategoriesResponse{
		Categories: categories,
	}), nil
}

func (s *CategoryService) SetTransactionCategory(
	ctx context.Context,
	req *connect.Request[pb.SetTransactionCategoryRequest],
) (*connect.Response[pb.SetTransactionCategoryResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	var txUUID pgtype.UUID
	if err := txUUID.Scan(req.Msg.TransactionId); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	var catUUID pgtype.UUID
	if err := catUUID.Scan(req.Msg.CategoryId); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	// 1. Update the transaction
	_, err = s.DB.UpdateTransaction(ctx, db.UpdateTransactionParams{
		ID:         txUUID,
		UserID:     userUUID,
		CategoryID: catUUID,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 2. Upsert the learning rule
	if req.Msg.MerchantNorm != "" {
		_, err = s.DB.CreateCategoryRule(ctx, db.CreateCategoryRuleParams{
			UserID:       userUUID,
			MerchantNorm: req.Msg.MerchantNorm,
			CategoryID:   catUUID,
			Confidence:   1.0, // Manual correction sets high confidence
		})
		if err != nil {
			// Log error but don't fail the request if learning fails
			// log.Printf("Failed to upsert learning rule: %v", err)
		}
	}

	return connect.NewResponse(&pb.SetTransactionCategoryResponse{
		Success: true,
	}), nil
}

func (s *CategoryService) ListCategoryRules(
	ctx context.Context,
	req *connect.Request[pb.ListCategoryRulesRequest],
) (*connect.Response[pb.ListCategoryRulesResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	dbRules, err := s.DB.ListCategoryRules(ctx, userUUID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	rules := make([]*pb.CategoryRule, 0, len(dbRules))
	for _, r := range dbRules {
		id := UUIDToString(r.ID)
		catId := UUIDToString(r.CategoryID)

		rules = append(rules, &pb.CategoryRule{
			Id:           id,
			MerchantNorm: r.MerchantNorm,
			CategoryId:   catId,
			Confidence:   r.Confidence,
			// Ignoring LastUsed for UI display for now, could be added later
		})
	}

	return connect.NewResponse(&pb.ListCategoryRulesResponse{
		Rules: rules,
	}), nil
}
