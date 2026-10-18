package api

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type CategoryService struct {
	DB   *db.Queries
	Pool *pgxpool.Pool
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

	var categories []*pb.Category
	if s.Pool != nil {
		rows, queryErr := s.Pool.Query(ctx, `SELECT id, name, type, color, icon, is_default FROM categories WHERE user_id=$1 OR (user_id IS NULL AND is_default=true) ORDER BY name, id`, uuid)
		if queryErr != nil {
			return nil, connect.NewError(connect.CodeInternal, errors.New("could not list categories"))
		}
		defer rows.Close()
		for rows.Next() {
			var id pgtype.UUID
			var name, typ, color, icon string
			var isDefault pgtype.Bool
			if scanErr := rows.Scan(&id, &name, &typ, &color, &icon, &isDefault); scanErr != nil {
				return nil, connect.NewError(connect.CodeInternal, errors.New("could not list categories"))
			}
			categories = append(categories, &pb.Category{Id: UUIDToString(id), Name: name, Type: typ, Color: color, Icon: icon, IsDefault: isDefault.Bool})
		}
		if rows.Err() != nil {
			return nil, connect.NewError(connect.CodeInternal, errors.New("could not list categories"))
		}
		return connect.NewResponse(&pb.ListCategoriesResponse{Categories: categories}), nil
	}
	return nil, connect.NewError(connect.CodeUnavailable, errors.New("category ownership service unavailable"))
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
	if s.Pool != nil {
		if err := requireOwnedCategory(ctx, s.Pool, userUUID, catUUID); err != nil {
			if !errors.Is(err, errCategoryNotOwned) {
				return nil, connect.NewError(connect.CodeUnavailable, errors.New("category ownership could not be verified"))
			}
			return nil, connect.NewError(connect.CodePermissionDenied, errors.New("category is not available to this account"))
		}
	} else {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("category ownership service unavailable"))
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

var errCategoryNotOwned = errors.New("category is not owned")

func requireOwnedCategory(ctx context.Context, pool *pgxpool.Pool, userID, categoryID pgtype.UUID) error {
	if pool == nil {
		return errors.New("category ownership database is unavailable")
	}
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM categories WHERE id=$1 AND (user_id=$2 OR (user_id IS NULL AND is_default=true)))`, categoryID, userID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return errCategoryNotOwned
	}
	return nil
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
