package api

import (
	"context"

	"connectrpc.com/connect"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type TransactionService struct {
	DB *db.Queries
}

func (s *TransactionService) CreateTransaction(ctx context.Context, req *connect.Request[pb.CreateTransactionRequest]) (*connect.Response[pb.CreateTransactionResponse], error) {
	// Call sqlc to create transaction

	res := connect.NewResponse(&pb.CreateTransactionResponse{
		Transaction: &pb.Transaction{
			Id:            "mock-txn-id",
			Amount:        req.Msg.Amount,
			Description:   req.Msg.Description,
			Date:          req.Msg.Date,
			Type:          req.Msg.Type,
			PaymentMethod: req.Msg.GetPaymentMethod(),
			UpiId:         req.Msg.UpiId,
			BankRrn:       req.Msg.BankRrn,
		},
	})
	return res, nil
}

func (s *TransactionService) GetTransaction(ctx context.Context, req *connect.Request[pb.GetTransactionRequest]) (*connect.Response[pb.GetTransactionResponse], error) {
	// Fetch single transaction from DB
	res := connect.NewResponse(&pb.GetTransactionResponse{
		Transaction: &pb.Transaction{
			Id: req.Msg.Id,
		},
	})
	return res, nil
}

func (s *TransactionService) ListTransactions(ctx context.Context, req *connect.Request[pb.ListTransactionsRequest]) (*connect.Response[pb.ListTransactionsResponse], error) {
	// List transactions for the authenticated user from DB
	res := connect.NewResponse(&pb.ListTransactionsResponse{
		Transactions: []*pb.Transaction{},
	})
	return res, nil
}

func (s *TransactionService) UpdateTransaction(ctx context.Context, req *connect.Request[pb.UpdateTransactionRequest]) (*connect.Response[pb.UpdateTransactionResponse], error) {
	res := connect.NewResponse(&pb.UpdateTransactionResponse{
		Transaction: &pb.Transaction{
			Id: req.Msg.Id,
		},
	})
	return res, nil
}

func (s *TransactionService) DeleteTransaction(ctx context.Context, req *connect.Request[pb.DeleteTransactionRequest]) (*connect.Response[pb.DeleteTransactionResponse], error) {
	// Delete transaction from DB
	res := connect.NewResponse(&pb.DeleteTransactionResponse{})
	return res, nil
}
