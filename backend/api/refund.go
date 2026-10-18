package api

import (
	"context"
	"errors"
	"strings"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

func createRefundTransaction(ctx context.Context, service *TransactionService, userID pgtype.UUID, request *pb.CreateTransactionRequest, requestedAccount pgtype.UUID) (db.Transaction, error) {
	originalID, err := parseUUID(request.GetRefundOfTransactionId(), "refund_of_transaction_id")
	if err != nil {
		return db.Transaction{}, err
	}
	if request.AmountPaise <= 0 {
		return db.Transaction{}, ErrorInvalidArgument("amount must be greater than zero")
	}
	if strings.TrimSpace(request.Description) == "" {
		return db.Transaction{}, ErrorInvalidArgument("description is required")
	}
	if request.Date == nil {
		return db.Transaction{}, ErrorInvalidArgument("date is required")
	}
	if err = validateTransactionDate(request.Date.AsTime()); err != nil {
		return db.Transaction{}, ErrorInvalidArgument(err.Error())
	}
	tx, err := service.Pool.Begin(ctx)
	if err != nil {
		return db.Transaction{}, ErrorInternal("internal system error")
	}
	defer tx.Rollback(ctx)
	var originalAmount int64
	var originalType string
	var originalAccount, category pgtype.UUID
	var originalCurrency string
	err = tx.QueryRow(ctx, `SELECT t.amount_paise,t.type,t.account_id,t.category_id,COALESCE(a.currency,'INR') FROM transactions t LEFT JOIN financial_accounts a ON a.id=t.account_id AND a.user_id=t.user_id WHERE t.id=$1 AND t.user_id=$2 FOR UPDATE OF t`, originalID, userID).Scan(&originalAmount, &originalType, &originalAccount, &category, &originalCurrency)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Transaction{}, connect.NewError(connect.CodeNotFound, errors.New("original expense not found"))
	}
	if err != nil {
		return db.Transaction{}, ErrorInternal("internal system error")
	}
	if originalType != "EXPENSE" {
		return db.Transaction{}, ErrorInvalidArgument("refund must reference an expense")
	}
	var alreadyRefunded int64
	if err = tx.QueryRow(ctx, `SELECT COALESCE(SUM(amount_paise),0) FROM transactions WHERE user_id=$1 AND refund_of_transaction_id=$2 AND type='REFUND' AND status<>'VOID'`, userID, originalID).Scan(&alreadyRefunded); err != nil {
		return db.Transaction{}, ErrorInternal("internal system error")
	}
	if request.AmountPaise > originalAmount-alreadyRefunded {
		return db.Transaction{}, ErrorInvalidArgument("refund exceeds the remaining amount of the original expense")
	}
	account := requestedAccount
	if !account.Valid {
		account = originalAccount
	}
	refundCurrency := originalCurrency
	if account.Valid {
		if err = tx.QueryRow(ctx, `SELECT currency FROM financial_accounts WHERE id=$1 AND user_id=$2`, account, userID).Scan(&refundCurrency); err != nil {
			return db.Transaction{}, connect.NewError(connect.CodeInvalidArgument, errors.New("refund account not found"))
		}
	}
	if refundCurrency != originalCurrency {
		return db.Transaction{}, ErrorInvalidArgument("refund account must use the original expense currency")
	}
	categoryID := category
	if request.CategoryId != nil && strings.TrimSpace(request.GetCategoryId()) != "" {
		categoryID, err = parseUUID(request.GetCategoryId(), "category_id")
		if err != nil {
			return db.Transaction{}, err
		}
	}
	var categoryPtr *string
	if categoryID.Valid {
		value := UUIDToString(categoryID)
		categoryPtr = &value
	}
	row, err := createTransactionRecord(ctx, db.New(tx), userID, transactionCreateInput{AmountPaise: request.AmountPaise, Description: request.Description, Date: request.Date.AsTime(), Type: "REFUND", CategoryID: categoryPtr, AccountID: account, RefundOfTransactionID: originalID, ReceiptURL: request.ReceiptUrl, PaymentMethod: request.PaymentMethod, UpiID: request.UpiId, UpiRef: request.UpiRef, BankRRN: request.BankRrn, MerchantRaw: request.MerchantRaw, MerchantNorm: request.MerchantNorm, Status: request.Status, Provenance: "REFUND", Tags: request.Tags})
	if err != nil {
		return db.Transaction{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return db.Transaction{}, ErrorInternal("internal system error")
	}
	return row, nil
}

func updateRefundTransaction(ctx context.Context, service *TransactionService, userID, transactionID pgtype.UUID, request *pb.UpdateTransactionRequest, existing db.Transaction, requestedAccount, requestedCategory pgtype.UUID) (db.Transaction, error) {
	if request.Type != nil && strings.ToUpper(request.GetType()) != "REFUND" {
		return db.Transaction{}, ErrorInvalidArgument("a refund transaction must remain type REFUND")
	}
	originalID := existing.RefundOfTransactionID
	if request.RefundOfTransactionId != nil {
		parsed, err := parseUUID(request.GetRefundOfTransactionId(), "refund_of_transaction_id")
		if err != nil {
			return db.Transaction{}, err
		}
		originalID = parsed
	}
	if !originalID.Valid {
		return db.Transaction{}, ErrorInvalidArgument("refund transaction requires refund_of_transaction_id")
	}
	amount := existing.AmountPaise
	if request.AmountPaise != nil {
		amount = request.GetAmountPaise()
	}
	if amount <= 0 {
		return db.Transaction{}, ErrorInvalidArgument("amount must be greater than zero")
	}
	tx, err := service.Pool.Begin(ctx)
	if err != nil {
		return db.Transaction{}, ErrorInternal("internal system error")
	}
	defer tx.Rollback(ctx)
	var originalAmount int64
	var originalType string
	var originalAccount, originalCategory pgtype.UUID
	var originalCurrency string
	err = tx.QueryRow(ctx, `SELECT t.amount_paise,t.type,t.account_id,t.category_id,COALESCE(a.currency,'INR') FROM transactions t LEFT JOIN financial_accounts a ON a.id=t.account_id AND a.user_id=t.user_id WHERE t.id=$1 AND t.user_id=$2 FOR UPDATE OF t`, originalID, userID).Scan(&originalAmount, &originalType, &originalAccount, &originalCategory, &originalCurrency)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Transaction{}, connect.NewError(connect.CodeNotFound, errors.New("original expense not found"))
	}
	if err != nil {
		return db.Transaction{}, ErrorInternal("internal system error")
	}
	if originalType != "EXPENSE" {
		return db.Transaction{}, ErrorInvalidArgument("refund must reference an expense")
	}
	var already int64
	if err = tx.QueryRow(ctx, `SELECT COALESCE(SUM(amount_paise),0) FROM transactions WHERE user_id=$1 AND refund_of_transaction_id=$2 AND type='REFUND' AND status<>'VOID' AND id<>$3`, userID, originalID, transactionID).Scan(&already); err != nil {
		return db.Transaction{}, ErrorInternal("internal system error")
	}
	if amount > originalAmount-already {
		return db.Transaction{}, ErrorInvalidArgument("refund exceeds the remaining amount of the original expense")
	}
	account := existing.AccountID
	if requestedAccount.Valid {
		account = requestedAccount
	}
	if !account.Valid {
		account = originalAccount
	}
	currency := originalCurrency
	if account.Valid {
		if err = tx.QueryRow(ctx, `SELECT currency FROM financial_accounts WHERE id=$1 AND user_id=$2`, account, userID).Scan(&currency); err != nil {
			return db.Transaction{}, ErrorInvalidArgument("refund account not found")
		}
	}
	if currency != originalCurrency {
		return db.Transaction{}, ErrorInvalidArgument("refund account must use the original expense currency")
	}
	category := existing.CategoryID
	if requestedCategory.Valid {
		category = requestedCategory
	} else if !category.Valid {
		category = originalCategory
	}
	typ := pgtype.Text{String: "REFUND", Valid: true}
	updated, err := db.New(tx).UpdateTransaction(ctx, db.UpdateTransactionParams{ID: transactionID, UserID: userID, AmountPaise: optionalInt8(request.AmountPaise), Description: optionalText(request.Description), MerchantRaw: optionalText(request.MerchantRaw), MerchantNorm: optionalText(request.MerchantNorm), Date: optionalTimestampValue(request.Date), Type: typ, Status: optionalText(request.Status), Provenance: optionalText(request.Provenance), CategoryID: category, PaymentMethod: optionalText(request.PaymentMethod), UpiID: optionalText(request.UpiId), UpiRef: optionalText(request.UpiRef), BankRrn: optionalText(request.BankRrn), AccountID: account, RefundOfTransactionID: originalID})
	if err != nil {
		return db.Transaction{}, ErrorInternal("internal system error")
	}
	if err = tx.Commit(ctx); err != nil {
		return db.Transaction{}, ErrorInternal("internal system error")
	}
	return updated, nil
}
