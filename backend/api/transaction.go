package api

import (
	"context"
	"log"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5/pgtype"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
	"vasoli-backend/internal/merchantnorm"
)

type TransactionService struct {
	DB *db.Queries
}

func (s *TransactionService) CreateTransaction(ctx context.Context, req *connect.Request[pb.CreateTransactionRequest]) (*connect.Response[pb.CreateTransactionResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	// Calculate Merchant Norm
	raw := req.Msg.MerchantRaw
	if raw == "" {
		raw = req.Msg.Description
	}
	norm := merchantnorm.NormalizeMerchant(raw, req.Msg.Description)

	// Check if alias exists
	alias, err := s.DB.ListMerchantAliases(ctx, userUUID)
	if err == nil {
		for _, a := range alias {
			if a.RawPattern == raw {
				norm = a.MerchantNorm
				break
			}
		}
	}

	// Try auto-categorization if category was not provided
	catID := req.Msg.CategoryId
	var catUUID pgtype.UUID
	if catID != nil && *catID != "" {
		_ = catUUID.Scan(*catID)
	} else {
		// Auto-categorize
		rule, err := s.DB.GetCategoryRule(ctx, db.GetCategoryRuleParams{
			UserID:       userUUID,
			MerchantNorm: norm,
		})
		if err == nil {
			catUUID = rule.CategoryID
		}
	}

	params := db.CreateTransactionParams{
		UserID:        userUUID,
		AmountPaise:   req.Msg.AmountPaise,
		Description:   req.Msg.Description,
		MerchantRaw:   raw,
		MerchantNorm:  norm,
		Date:          pgtype.Timestamptz{Time: req.Msg.Date.AsTime(), Valid: true},
		Type:          req.Msg.Type,
		Status:        req.Msg.Status,
		Provenance:    req.Msg.Provenance,
		CategoryID:    catUUID,
		Tags:          req.Msg.Tags,
		PaymentMethod: pgtype.Text{String: req.Msg.GetPaymentMethod(), Valid: req.Msg.PaymentMethod != nil},
		UpiID:         pgtype.Text{String: req.Msg.GetUpiId(), Valid: req.Msg.UpiId != nil},
		UpiRef:        pgtype.Text{String: req.Msg.GetUpiRef(), Valid: req.Msg.UpiRef != nil},
		BankRrn:       pgtype.Text{String: req.Msg.GetBankRrn(), Valid: req.Msg.BankRrn != nil},
	}

	if params.Status == "" {
		params.Status = "POSTED" // Default
	}
	if params.Provenance == "" {
		params.Provenance = "MANUAL" // Default
	}

	tx, err := s.DB.CreateTransaction(ctx, params)
	if err != nil {
		log.Printf("CreateTransaction DB err: %v", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var idStr = UUIDToString(tx.ID)
	var catStr = UUIDToString(tx.CategoryID)

	var catId *string
	if catStr != "" {
		catId = &catStr
	}

	return connect.NewResponse(&pb.CreateTransactionResponse{
		Transaction: &pb.Transaction{
			Id:            idStr,
			AmountPaise:   tx.AmountPaise,
			Description:   tx.Description,
			MerchantRaw:   tx.MerchantRaw,
			MerchantNorm:  tx.MerchantNorm,
			Date:          timestamppb.New(tx.Date.Time),
			Type:          tx.Type,
			Status:        tx.Status,
			Provenance:    tx.Provenance,
			CategoryId:    catId,
			PaymentMethod: tx.PaymentMethod.String,
			UpiId:         &tx.UpiID.String,
			UpiRef:        &tx.UpiRef.String,
			BankRrn:       &tx.BankRrn.String,
		},
	}), nil
}

func (s *TransactionService) GetTransaction(ctx context.Context, req *connect.Request[pb.GetTransactionRequest]) (*connect.Response[pb.GetTransactionResponse], error) {
	// Not fully implemented for MVP, stub
	return connect.NewResponse(&pb.GetTransactionResponse{}), nil
}

func (s *TransactionService) ListTransactions(ctx context.Context, req *connect.Request[pb.ListTransactionsRequest]) (*connect.Response[pb.ListTransactionsResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	limit := int32(50)
	if req.Msg.PageSize > 0 {
		limit = req.Msg.PageSize
	}

	dbTxns, err := s.DB.ListTransactions(ctx, db.ListTransactionsParams{
		UserID: userUUID,
		Limit:  limit,
		Offset: 0,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var txns []*pb.Transaction
	for _, tx := range dbTxns {
		idStr := UUIDToString(tx.ID)
		catStr := UUIDToString(tx.CategoryID)

		var catId *string
		if catStr != "" {
			catId = &catStr
		}

		txns = append(txns, &pb.Transaction{
			Id:            idStr,
			AmountPaise:   tx.AmountPaise,
			Description:   tx.Description,
			MerchantRaw:   tx.MerchantRaw,
			MerchantNorm:  tx.MerchantNorm,
			Date:          timestamppb.New(tx.Date.Time),
			Type:          tx.Type,
			Status:        tx.Status,
			Provenance:    tx.Provenance,
			CategoryId:    catId,
			PaymentMethod: tx.PaymentMethod.String,
			UpiId:         &tx.UpiID.String,
			UpiRef:        &tx.UpiRef.String,
			BankRrn:       &tx.BankRrn.String,
		})
	}

	return connect.NewResponse(&pb.ListTransactionsResponse{
		Transactions: txns,
	}), nil
}

func (s *TransactionService) UpdateTransaction(ctx context.Context, req *connect.Request[pb.UpdateTransactionRequest]) (*connect.Response[pb.UpdateTransactionResponse], error) {
	// Add similar checks as Create, omited for brevity in this MVP phase
	return connect.NewResponse(&pb.UpdateTransactionResponse{}), nil
}

func (s *TransactionService) DeleteTransaction(ctx context.Context, req *connect.Request[pb.DeleteTransactionRequest]) (*connect.Response[pb.DeleteTransactionResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	var txUUID pgtype.UUID
	_ = txUUID.Scan(req.Msg.Id)

	err = s.DB.DeleteTransaction(ctx, db.DeleteTransactionParams{
		ID:     txUUID,
		UserID: userUUID,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.DeleteTransactionResponse{}), nil
}
