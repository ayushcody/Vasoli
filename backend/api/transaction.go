package api

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
	"vasoli-backend/internal/merchantnorm"
)

var validTransactionTypes = map[string]struct{}{
	"EXPENSE":    {},
	"INCOME":     {},
	"INVESTMENT": {},
	"REFUND":     {},
}

type transactionCreateInput struct {
	AmountPaise           int64
	Description           string
	Date                  time.Time
	Type                  string
	CategoryID            *string
	AccountID             pgtype.UUID
	RefundOfTransactionID pgtype.UUID
	ReceiptURL            *string
	PaymentMethod         *string
	UpiID                 *string
	UpiRef                *string
	BankRRN               *string
	MerchantRaw           string
	MerchantNorm          string
	Status                string
	Provenance            string
	Tags                  []string
	ImportBatchID         pgtype.UUID
}

type TransactionService struct {
	DB   *db.Queries
	Pool *pgxpool.Pool
}

func rejectPairedTransferMutation(transaction db.Transaction) error {
	if transaction.TransferGroupID.Valid {
		return ErrorInvalidArgument("paired transfers cannot be edited or deleted one leg at a time")
	}
	return nil
}

func validateExpenseRefundAggregate(refunded, newAmount int64, requestedType *string) error {
	if refunded > 0 && requestedType != nil && !strings.EqualFold(*requestedType, "EXPENSE") {
		return ErrorInvalidArgument("an expense with refunds must remain type EXPENSE")
	}
	if newAmount < refunded {
		return ErrorInvalidArgument("expense amount cannot be less than refunds already recorded")
	}
	return nil
}

func (s *TransactionService) CreateTransaction(ctx context.Context, req *connect.Request[pb.CreateTransactionRequest]) (*connect.Response[pb.CreateTransactionResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}

	if req.Msg.Date == nil {
		return nil, ErrorInvalidArgument("date is required")
	}
	accountID, err := validateOwnedAccount(ctx, s.DB, userUUID, req.Msg.AccountId)
	if err != nil {
		return nil, err
	}

	if req.Msg.CategoryId != nil && strings.TrimSpace(req.Msg.GetCategoryId()) != "" {
		categoryUUID, e := parseUUID(req.Msg.GetCategoryId(), "category_id")
		if e != nil {
			return nil, e
		}
		if e = requireOwnedCategory(ctx, s.Pool, userUUID, categoryUUID); e != nil {
			if errors.Is(e, errCategoryNotOwned) {
				return nil, ErrorInvalidArgument("category_id is not available to this user")
			}
			return nil, ErrorInternal("internal system error")
		}
	}
	var created db.Transaction
	if strings.EqualFold(req.Msg.Type, "REFUND") || req.Msg.RefundOfTransactionId != nil {
		if !strings.EqualFold(req.Msg.Type, "REFUND") || req.Msg.RefundOfTransactionId == nil {
			return nil, ErrorInvalidArgument("refund transactions require type REFUND and refund_of_transaction_id")
		}
		created, err = createRefundTransaction(ctx, s, userUUID, req.Msg, accountID)
	} else {
		created, err = createTransactionRecord(ctx, s.DB, userUUID, transactionCreateInput{
			AmountPaise:   req.Msg.AmountPaise,
			Description:   req.Msg.Description,
			Date:          req.Msg.Date.AsTime(),
			Type:          req.Msg.Type,
			CategoryID:    req.Msg.CategoryId,
			ReceiptURL:    req.Msg.ReceiptUrl,
			PaymentMethod: req.Msg.PaymentMethod,
			UpiID:         req.Msg.UpiId,
			UpiRef:        req.Msg.UpiRef,
			BankRRN:       req.Msg.BankRrn,
			MerchantRaw:   req.Msg.MerchantRaw,
			MerchantNorm:  req.Msg.MerchantNorm,
			Status:        req.Msg.Status,
			Provenance:    req.Msg.Provenance,
			Tags:          req.Msg.Tags,
			AccountID:     accountID,
		})
	}
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&pb.CreateTransactionResponse{
		Transaction: mapTransaction(created),
	}), nil
}

func (s *TransactionService) GetTransaction(ctx context.Context, req *connect.Request[pb.GetTransactionRequest]) (*connect.Response[pb.GetTransactionResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}

	transactionUUID, err := parseUUID(req.Msg.Id, "transaction id")
	if err != nil {
		return nil, err
	}

	tx, err := s.DB.GetTransaction(ctx, db.GetTransactionParams{
		ID:     transactionUUID,
		UserID: userUUID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("transaction not found"))
		}
		return nil, ErrorInternal("internal system error")
	}

	return connect.NewResponse(&pb.GetTransactionResponse{
		Transaction: mapTransaction(tx),
	}), nil
}

func (s *TransactionService) ListTransactions(ctx context.Context, req *connect.Request[pb.ListTransactionsRequest]) (*connect.Response[pb.ListTransactionsResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}

	pageSize := req.Msg.PageSize
	if pageSize <= 0 {
		pageSize = 50
	}
	if pageSize > 200 {
		pageSize = 200
	}

	cursorDate, cursorID, err := decodeTransactionPageToken(req.Msg.PageToken)
	if err != nil {
		return nil, ErrorInvalidArgument(err.Error())
	}

	var categoryID pgtype.UUID
	if req.Msg.CategoryId != nil {
		categoryID, err = parseRawUUID(req.Msg.GetCategoryId())
		if err != nil {
			return nil, ErrorInvalidArgument("category_id must be a valid UUID")
		}
		if err = requireOwnedCategory(ctx, s.Pool, userUUID, categoryID); err != nil {
			if errors.Is(err, errCategoryNotOwned) {
				return nil, ErrorInvalidArgument("category_id is not available to this user")
			}
			return nil, ErrorInternal("internal system error")
		}
	}

	if req.Msg.Type != nil {
		if err := validateTransactionType(req.Msg.GetType()); err != nil {
			return nil, ErrorInvalidArgument(err.Error())
		}
	}

	if req.Msg.StartDate != nil && req.Msg.EndDate != nil && !req.Msg.StartDate.AsTime().Before(req.Msg.EndDate.AsTime()) {
		return nil, ErrorInvalidArgument("start_date must be before end_date")
	}
	if len(req.Msg.Search) > 200 {
		return nil, ErrorInvalidArgument("search is too long")
	}
	accountID, err := validateOwnedAccount(ctx, s.DB, userUUID, req.Msg.AccountId)
	if err != nil {
		return nil, err
	}
	rows, err := s.DB.ListTransactions(ctx, db.ListTransactionsParams{
		UserID:     userUUID,
		Type:       optionalText(req.Msg.Type),
		CategoryID: categoryID,
		StartDate:  optionalTimestampValue(req.Msg.StartDate),
		EndDate:    optionalTimestampValue(req.Msg.EndDate),
		AccountID:  accountID,
		Search:     pgtype.Text{String: strings.TrimSpace(req.Msg.Search), Valid: strings.TrimSpace(req.Msg.Search) != ""},
		CursorDate: optionalTimeValue(cursorDate),
		CursorID:   cursorID,
		LimitCount: pageSize + 1,
	})
	if err != nil {
		if isMockMode() {
			return connect.NewResponse(&pb.ListTransactionsResponse{
				Transactions: getMockTransactions(),
			}), nil
		}
		return nil, ErrorInternal("internal system error")
	}

	nextPageToken := ""
	if len(rows) > int(pageSize) {
		last := rows[pageSize-1]
		nextPageToken = encodeTransactionPageToken(last.Date.Time, UUIDToString(last.ID))
		rows = rows[:pageSize]
	}

	transactions := make([]*pb.Transaction, 0, len(rows))
	for _, row := range rows {
		transactions = append(transactions, mapTransaction(row))
	}

	return connect.NewResponse(&pb.ListTransactionsResponse{
		Transactions:  transactions,
		NextPageToken: nextPageToken,
	}), nil
}

func (s *TransactionService) UpdateTransaction(ctx context.Context, req *connect.Request[pb.UpdateTransactionRequest]) (*connect.Response[pb.UpdateTransactionResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}

	transactionUUID, err := parseUUID(req.Msg.Id, "transaction id")
	if err != nil {
		return nil, err
	}

	if req.Msg.AmountPaise != nil && req.Msg.GetAmountPaise() <= 0 {
		return nil, ErrorInvalidArgument("amount must be greater than zero")
	}
	if req.Msg.Type != nil {
		if err := validateTransactionType(req.Msg.GetType()); err != nil {
			return nil, ErrorInvalidArgument(err.Error())
		}
	}
	if req.Msg.Date != nil {
		if err := validateTransactionDate(req.Msg.Date.AsTime()); err != nil {
			return nil, ErrorInvalidArgument(err.Error())
		}
	}

	var categoryID pgtype.UUID
	if req.Msg.CategoryId != nil {
		categoryID, err = parseRawUUID(req.Msg.GetCategoryId())
		if err != nil {
			return nil, ErrorInvalidArgument("category_id must be a valid UUID")
		}
		if err = requireOwnedCategory(ctx, s.Pool, userUUID, categoryID); err != nil {
			if errors.Is(err, errCategoryNotOwned) {
				return nil, ErrorInvalidArgument("category_id is not available to this user")
			}
			return nil, ErrorInternal("internal system error")
		}
	}
	accountID, err := validateOwnedAccount(ctx, s.DB, userUUID, req.Msg.AccountId)
	if err != nil {
		return nil, err
	}
	current, currentErr := s.DB.GetTransaction(ctx, db.GetTransactionParams{ID: transactionUUID, UserID: userUUID})
	if currentErr != nil {
		if errors.Is(currentErr, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("transaction not found"))
		}
		return nil, ErrorInternal("internal system error")
	}
	if err := rejectPairedTransferMutation(current); err != nil {
		return nil, err
	}
	if current.Type == "REFUND" || (req.Msg.Type != nil && strings.EqualFold(req.Msg.GetType(), "REFUND")) || req.Msg.RefundOfTransactionId != nil {
		updated, e := updateRefundTransaction(ctx, s, userUUID, transactionUUID, req.Msg, current, accountID, categoryID)
		if e != nil {
			return nil, e
		}
		return connect.NewResponse(&pb.UpdateTransactionResponse{Transaction: mapTransaction(updated)}), nil
	}

	updateParams := db.UpdateTransactionParams{
		ID: transactionUUID, UserID: userUUID, AmountPaise: optionalInt8(req.Msg.AmountPaise),
		Description: optionalText(req.Msg.Description), MerchantRaw: optionalText(req.Msg.MerchantRaw), MerchantNorm: optionalText(req.Msg.MerchantNorm),
		Date: optionalTimestampValue(req.Msg.Date), Type: optionalText(req.Msg.Type), Status: optionalText(req.Msg.Status),
		Provenance: optionalText(req.Msg.Provenance), CategoryID: categoryID, PaymentMethod: optionalText(req.Msg.PaymentMethod),
		UpiID: optionalText(req.Msg.UpiId), UpiRef: optionalText(req.Msg.UpiRef), BankRrn: optionalText(req.Msg.BankRrn),
		AccountID: accountID, RefundOfTransactionID: pgtype.UUID{},
	}
	var updated db.Transaction
	if current.Type == "EXPENSE" && (req.Msg.AmountPaise != nil || req.Msg.Type != nil) {
		if s.Pool == nil {
			return nil, ErrorInternal("expense refund validation is unavailable")
		}
		tx, beginErr := s.Pool.Begin(ctx)
		if beginErr != nil {
			return nil, ErrorInternal("internal system error")
		}
		defer tx.Rollback(ctx)
		var lockedType string
		if e := tx.QueryRow(ctx, `SELECT type FROM transactions WHERE id=$1 AND user_id=$2 FOR UPDATE`, transactionUUID, userUUID).Scan(&lockedType); e != nil {
			if errors.Is(e, pgx.ErrNoRows) {
				return nil, connect.NewError(connect.CodeNotFound, errors.New("transaction not found"))
			}
			return nil, ErrorInternal("internal system error")
		}
		if lockedType == "EXPENSE" {
			var refunded int64
			if e := tx.QueryRow(ctx, `SELECT COALESCE(SUM(amount_paise),0) FROM transactions WHERE user_id=$1 AND refund_of_transaction_id=$2 AND type='REFUND' AND status<>'VOID'`, userUUID, transactionUUID).Scan(&refunded); e != nil {
				return nil, ErrorInternal("internal system error")
			}
			newAmount := current.AmountPaise
			if req.Msg.AmountPaise != nil {
				newAmount = req.Msg.GetAmountPaise()
			}
			if e := validateExpenseRefundAggregate(refunded, newAmount, req.Msg.Type); e != nil {
				return nil, e
			}
		}
		updated, err = db.New(tx).UpdateTransaction(ctx, updateParams)
		if err != nil {
			return nil, ErrorInternal("internal system error")
		}
		if err = tx.Commit(ctx); err != nil {
			return nil, ErrorInternal("internal system error")
		}
	} else {
		updated, err = s.DB.UpdateTransaction(ctx, updateParams)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("transaction not found"))
		}
		return nil, ErrorInternal("internal system error")
	}

	return connect.NewResponse(&pb.UpdateTransactionResponse{
		Transaction: mapTransaction(updated),
	}), nil
}

func (s *TransactionService) DeleteTransaction(ctx context.Context, req *connect.Request[pb.DeleteTransactionRequest]) (*connect.Response[pb.DeleteTransactionResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}

	transactionUUID, err := parseUUID(req.Msg.Id, "transaction id")
	if err != nil {
		return nil, err
	}

	current, getErr := s.DB.GetTransaction(ctx, db.GetTransactionParams{ID: transactionUUID, UserID: userUUID})
	if getErr != nil {
		err = getErr
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("transaction not found"))
		}
		return nil, ErrorInternal("internal system error")
	}

	if err := rejectPairedTransferMutation(current); err != nil {
		return nil, err
	}
	if err := s.DB.DeleteTransaction(ctx, db.DeleteTransactionParams{
		ID:     transactionUUID,
		UserID: userUUID,
	}); err != nil {
		return nil, ErrorInternal("internal system error")
	}

	return connect.NewResponse(&pb.DeleteTransactionResponse{}), nil
}

func createTransactionRecord(ctx context.Context, queries *db.Queries, userUUID pgtype.UUID, input transactionCreateInput) (db.Transaction, error) {
	if input.Description == "" {
		return db.Transaction{}, ErrorInvalidArgument("description is required")
	}
	if input.AmountPaise <= 0 {
		return db.Transaction{}, ErrorInvalidArgument("amount must be greater than zero")
	}
	if err := validateTransactionType(input.Type); err != nil {
		return db.Transaction{}, ErrorInvalidArgument(err.Error())
	}
	input.Type = strings.ToUpper(input.Type)
	if err := validateTransactionDate(input.Date); err != nil {
		return db.Transaction{}, ErrorInvalidArgument(err.Error())
	}

	categoryID := pgtype.UUID{}
	if input.CategoryID != nil && *input.CategoryID != "" {
		parsed, err := parseRawUUID(*input.CategoryID)
		if err != nil {
			return db.Transaction{}, ErrorInvalidArgument("category_id must be a valid UUID")
		}
		categoryID = parsed
	}

	rawMerchant := strings.TrimSpace(input.MerchantRaw)
	if rawMerchant == "" {
		rawMerchant = input.Description
	}

	merchantNorm := strings.TrimSpace(input.MerchantNorm)
	if merchantNorm == "" {
		merchantNorm = merchantnorm.NormalizeMerchant(rawMerchant, input.Description)
	}

	aliases, err := queries.ListMerchantAliases(ctx, userUUID)
	if err == nil {
		for _, alias := range aliases {
			if alias.RawPattern == rawMerchant {
				merchantNorm = alias.MerchantNorm
				break
			}
		}
	}

	if !categoryID.Valid {
		rule, err := queries.GetCategoryRule(ctx, db.GetCategoryRuleParams{
			UserID:       userUUID,
			MerchantNorm: merchantNorm,
		})
		if err == nil {
			categoryID = rule.CategoryID
		}
	}

	status := input.Status
	if status == "" {
		status = "POSTED"
	}

	provenance := input.Provenance
	if provenance == "" {
		provenance = "MANUAL"
	}

	tx, err := queries.CreateTransaction(ctx, db.CreateTransactionParams{
		UserID:                userUUID,
		AmountPaise:           input.AmountPaise,
		Description:           input.Description,
		MerchantRaw:           rawMerchant,
		MerchantNorm:          merchantNorm,
		Date:                  pgtype.Timestamptz{Time: input.Date.UTC(), Valid: true},
		Type:                  input.Type,
		Status:                status,
		Provenance:            provenance,
		CategoryID:            categoryID,
		Tags:                  input.Tags,
		PaymentMethod:         optionalStringValue(input.PaymentMethod),
		UpiID:                 optionalStringValue(input.UpiID),
		UpiRef:                optionalStringValue(input.UpiRef),
		BankRrn:               optionalStringValue(input.BankRRN),
		ReceiptUrl:            optionalStringValue(input.ReceiptURL),
		ImportBatchID:         input.ImportBatchID,
		AccountID:             input.AccountID,
		RefundOfTransactionID: input.RefundOfTransactionID,
	})
	if err != nil {
		return db.Transaction{}, ErrorInternal("internal system error")
	}

	return tx, nil
}

func mapTransaction(tx db.Transaction) *pb.Transaction {
	transaction := &pb.Transaction{
		Id:            UUIDToString(tx.ID),
		AmountPaise:   tx.AmountPaise,
		Description:   tx.Description,
		Type:          tx.Type,
		PaymentMethod: tx.PaymentMethod.String,
		IsRecurring:   tx.IsRecurring.Bool,
		UserId:        UUIDToString(tx.UserID),
		MerchantRaw:   tx.MerchantRaw,
		MerchantNorm:  tx.MerchantNorm,
		Status:        tx.Status,
		Provenance:    tx.Provenance,
		Tags:          tx.Tags,
	}

	if tx.Date.Valid {
		transaction.Date = timestamppb.New(tx.Date.Time)
	}
	if tx.CreatedAt.Valid {
		transaction.CreatedAt = timestamppb.New(tx.CreatedAt.Time)
	}
	if tx.UpdatedAt.Valid {
		transaction.UpdatedAt = timestamppb.New(tx.UpdatedAt.Time)
	}

	if categoryID := UUIDToString(tx.CategoryID); categoryID != "" {
		transaction.CategoryId = &categoryID
	}
	if receiptURL := tx.ReceiptUrl.String; tx.ReceiptUrl.Valid {
		transaction.ReceiptUrl = &receiptURL
	}
	if upiID := tx.UpiID.String; tx.UpiID.Valid {
		transaction.UpiId = &upiID
	}
	if upiRef := tx.UpiRef.String; tx.UpiRef.Valid {
		transaction.UpiRef = &upiRef
	}
	if bankRRN := tx.BankRrn.String; tx.BankRrn.Valid {
		transaction.BankRrn = &bankRRN
	}
	if recurringID := UUIDToString(tx.RecurringID); recurringID != "" {
		transaction.RecurringId = &recurringID
	}
	if accountID := UUIDToString(tx.AccountID); accountID != "" {
		transaction.AccountId = &accountID
	}
	if transferGroupID := UUIDToString(tx.TransferGroupID); transferGroupID != "" {
		transaction.TransferGroupId = &transferGroupID
	}
	if tx.TransferDirection.Valid {
		value := tx.TransferDirection.String
		transaction.TransferDirection = &value
	}
	if refundID := UUIDToString(tx.RefundOfTransactionID); refundID != "" {
		transaction.RefundOfTransactionId = &refundID
	}

	return transaction
}

func validateOwnedAccount(ctx context.Context, queries *db.Queries, userUUID pgtype.UUID, raw *string) (pgtype.UUID, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return pgtype.UUID{}, nil
	}
	id, err := parseRawUUID(strings.TrimSpace(*raw))
	if err != nil {
		return pgtype.UUID{}, ErrorInvalidArgument("account_id must be a valid UUID")
	}
	if _, err := queries.GetFinancialAccount(ctx, db.GetFinancialAccountParams{ID: id, UserID: userUUID}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return pgtype.UUID{}, connect.NewError(connect.CodeNotFound, errors.New("account not found"))
		}
		return pgtype.UUID{}, ErrorInternal("internal system error")
	}
	return id, nil
}

func validateTransactionType(transactionType string) error {
	if _, ok := validTransactionTypes[strings.ToUpper(transactionType)]; !ok {
		return fmt.Errorf("unsupported transaction type %q", transactionType)
	}
	return nil
}

func validateTransactionDate(transactionDate time.Time) error {
	maxFuture := time.Now().UTC().Add(24 * time.Hour)
	if transactionDate.After(maxFuture) {
		return errors.New("date cannot be more than one day in the future")
	}
	return nil
}

func parseUUID(value string, fieldName string) (pgtype.UUID, error) {
	parsed, err := parseRawUUID(value)
	if err != nil {
		return pgtype.UUID{}, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("%s must be a valid UUID", fieldName))
	}
	return parsed, nil
}

func parseRawUUID(value string) (pgtype.UUID, error) {
	var parsed pgtype.UUID
	if err := parsed.Scan(value); err != nil {
		return pgtype.UUID{}, err
	}
	return parsed, nil
}

func optionalText(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func optionalStringValue(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func optionalInt8(value *int64) pgtype.Int8 {
	if value == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *value, Valid: true}
}

func optionalTimestampValue(value *timestamppb.Timestamp) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: value.AsTime(), Valid: true}
}

func optionalTimeValue(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
}

func encodeTransactionPageToken(date time.Time, id string) string {
	payload := fmt.Sprintf("%d|%s", date.UTC().UnixNano(), id)
	return base64.StdEncoding.EncodeToString([]byte(payload))
}

func decodeTransactionPageToken(token string) (*time.Time, pgtype.UUID, error) {
	if token == "" {
		return nil, pgtype.UUID{}, nil
	}

	decoded, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return nil, pgtype.UUID{}, errors.New("page_token is invalid")
	}

	parts := strings.Split(string(decoded), "|")
	if len(parts) != 2 {
		return nil, pgtype.UUID{}, errors.New("page_token is invalid")
	}

	unixNano, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return nil, pgtype.UUID{}, errors.New("page_token is invalid")
	}

	cursorID, err := parseRawUUID(parts[1])
	if err != nil {
		return nil, pgtype.UUID{}, errors.New("page_token is invalid")
	}

	cursorDate := time.Unix(0, unixNano).UTC()
	return &cursorDate, cursorID, nil
}
