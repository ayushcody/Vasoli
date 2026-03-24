package api

import (
	"context"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5/pgtype"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type ReceiptService struct {
	DB *db.Queries
}

func mapReceipt(r db.Receipt) *pb.Receipt {
	receipt := &pb.Receipt{
		Id:                  UUIDToString(r.ID),
		UserId:              UUIDToString(r.UserID),
		Merchant:            r.Merchant,
		AmountPaise:         r.AmountPaise,
		Reimbursable:        r.Reimbursable,
		OcrPayloadEncrypted: r.OcrPayloadEncrypted,
	}

	if r.PurchaseDate.Valid {
		receipt.PurchaseDate = timestamppb.New(r.PurchaseDate.Time)
	}
	if r.ReturnBy.Valid {
		receipt.ReturnBy = timestamppb.New(r.ReturnBy.Time)
	}
	if r.WarrantyUntil.Valid {
		receipt.WarrantyUntil = timestamppb.New(r.WarrantyUntil.Time)
	}
	if r.CreatedAt.Valid {
		receipt.CreatedAt = timestamppb.New(r.CreatedAt.Time)
	}
	if r.SnoozedUntil.Valid {
		receipt.SnoozedUntil = timestamppb.New(r.SnoozedUntil.Time)
	}

	return receipt
}

func optionalTimestamp(ts interface{ AsTime() time.Time }, valid bool) pgtype.Timestamptz {
	if !valid || ts == nil {
		return pgtype.Timestamptz{}
	}

	return pgtype.Timestamptz{Time: ts.AsTime(), Valid: true}
}

func (s *ReceiptService) CreateReceipt(ctx context.Context, req *connect.Request[pb.CreateReceiptRequest]) (*connect.Response[pb.CreateReceiptResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	purchaseDate := time.Now().UTC()
	if req.Msg.PurchaseDate != nil {
		purchaseDate = req.Msg.PurchaseDate.AsTime()
	}

	receipt, err := s.DB.CreateReceipt(ctx, db.CreateReceiptParams{
		UserID:              userUUID,
		Merchant:            req.Msg.Merchant,
		AmountPaise:         req.Msg.AmountPaise,
		PurchaseDate:        pgtype.Timestamptz{Time: purchaseDate, Valid: true},
		ReturnBy:            optionalTimestamp(req.Msg.ReturnBy, req.Msg.ReturnBy != nil),
		WarrantyUntil:       optionalTimestamp(req.Msg.WarrantyUntil, req.Msg.WarrantyUntil != nil),
		Reimbursable:        req.Msg.Reimbursable,
		OcrPayloadEncrypted: req.Msg.OcrPayloadEncrypted,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.CreateReceiptResponse{
		Receipt: mapReceipt(receipt),
	}), nil
}

func (s *ReceiptService) ListReceipts(ctx context.Context, req *connect.Request[pb.ListReceiptsRequest]) (*connect.Response[pb.ListReceiptsResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	receipts, err := s.DB.ListReceipts(ctx, userUUID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	items := make([]*pb.Receipt, 0, len(receipts))
	for _, receipt := range receipts {
		items = append(items, mapReceipt(receipt))
	}

	return connect.NewResponse(&pb.ListReceiptsResponse{
		Receipts: items,
	}), nil
}

func (s *ReceiptService) ListExpiring(ctx context.Context, req *connect.Request[pb.ListExpiringRequest]) (*connect.Response[pb.ListExpiringResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	daysAhead := req.Msg.DaysAhead
	if daysAhead <= 0 {
		daysAhead = 30
	}

	cutoff := time.Now().UTC().AddDate(0, 0, int(daysAhead))
	receipts, err := s.DB.ListExpiringReceipts(ctx, db.ListExpiringReceiptsParams{
		UserID:   userUUID,
		ReturnBy: pgtype.Timestamptz{Time: cutoff, Valid: true},
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	items := make([]*pb.Receipt, 0, len(receipts))
	for _, receipt := range receipts {
		items = append(items, mapReceipt(receipt))
	}

	return connect.NewResponse(&pb.ListExpiringResponse{
		Receipts: items,
	}), nil
}

func (s *ReceiptService) UpdateReceipt(ctx context.Context, req *connect.Request[pb.UpdateReceiptRequest]) (*connect.Response[pb.UpdateReceiptResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	var receiptUUID pgtype.UUID
	if err := receiptUUID.Scan(req.Msg.Id); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	receipt, err := s.DB.UpdateReceipt(ctx, db.UpdateReceiptParams{
		ID:            receiptUUID,
		UserID:        userUUID,
		Reimbursable:  pgtype.Bool{Bool: req.Msg.GetReimbursable(), Valid: req.Msg.Reimbursable != nil},
		ReturnBy:      optionalTimestamp(req.Msg.ReturnBy, req.Msg.ReturnBy != nil),
		WarrantyUntil: optionalTimestamp(req.Msg.WarrantyUntil, req.Msg.WarrantyUntil != nil),
		SnoozedUntil:  optionalTimestamp(req.Msg.SnoozedUntil, req.Msg.SnoozedUntil != nil),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UpdateReceiptResponse{
		Receipt: mapReceipt(receipt),
	}), nil
}
