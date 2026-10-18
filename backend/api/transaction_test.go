package api

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

func TestCreateTransactionValidation(t *testing.T) {
	userID := StringToUUID("11111111-1111-1111-1111-111111111111")

	tests := []struct {
		name  string
		input transactionCreateInput
	}{
		{
			name: "amount must be positive",
			input: transactionCreateInput{
				AmountPaise: 0,
				Description: "Coffee",
				Date:        time.Now().UTC(),
				Type:        "EXPENSE",
			},
		},
		{
			name: "future dates beyond one day are rejected",
			input: transactionCreateInput{
				AmountPaise: 1000,
				Description: "Coffee",
				Date:        time.Now().UTC().Add(48 * time.Hour),
				Type:        "EXPENSE",
			},
		},
		{
			name: "type must be supported",
			input: transactionCreateInput{
				AmountPaise: 1000,
				Description: "Coffee",
				Date:        time.Now().UTC(),
				Type:        "BONUS",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := createTransactionRecord(context.Background(), nil, userID, tt.input)
			if err == nil {
				t.Fatal("expected validation error")
			}
			if connect.CodeOf(err) != connect.CodeInvalidArgument {
				t.Fatalf("code = %v, want %v", connect.CodeOf(err), connect.CodeInvalidArgument)
			}
		})
	}
}

func TestGetTransactionReturnsNotFoundForWrongUser(t *testing.T) {
	transactionID := "22222222-2222-2222-2222-222222222222"
	ownerID := "11111111-1111-1111-1111-111111111111"
	callerID := "33333333-3333-3333-3333-333333333333"
	now := time.Now().UTC()

	service := &TransactionService{
		DB: db.New(transactionServiceDBTX{
			transactions: []db.Transaction{
				{
					ID:           StringToUUID(transactionID),
					UserID:       StringToUUID(ownerID),
					AmountPaise:  10_000,
					Description:  "Salary",
					MerchantRaw:  "Employer",
					MerchantNorm: "employer",
					Date:         pgtype.Timestamptz{Time: now, Valid: true},
					Type:         "INCOME",
					Status:       "POSTED",
					Provenance:   "MANUAL",
					IsRecurring:  pgtype.Bool{Bool: false, Valid: true},
				},
			},
		}),
	}

	ctx := context.WithValue(context.Background(), UserIDKey, callerID)
	_, err := service.GetTransaction(ctx, connect.NewRequest(&pb.GetTransactionRequest{Id: transactionID}))
	if err == nil {
		t.Fatal("expected not found error")
	}
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("code = %v, want %v", connect.CodeOf(err), connect.CodeNotFound)
	}
}

func TestListTransactionsPagination(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	base := time.Date(2026, time.January, 3, 9, 0, 0, 0, time.UTC)

	service := &TransactionService{
		DB: db.New(transactionServiceDBTX{
			transactions: []db.Transaction{
				newTestTransaction("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", userID, base, "Newest"),
				newTestTransaction("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", userID, base.Add(-24*time.Hour), "Middle"),
				newTestTransaction("cccccccc-cccc-cccc-cccc-cccccccccccc", userID, base.Add(-48*time.Hour), "Oldest"),
			},
		}),
	}

	ctx := context.WithValue(context.Background(), UserIDKey, userID)
	firstPage, err := service.ListTransactions(ctx, connect.NewRequest(&pb.ListTransactionsRequest{
		PageSize: 2,
	}))
	if err != nil {
		t.Fatalf("ListTransactions() first page error = %v", err)
	}

	if len(firstPage.Msg.Transactions) != 2 {
		t.Fatalf("first page length = %d, want 2", len(firstPage.Msg.Transactions))
	}
	if firstPage.Msg.NextPageToken == "" {
		t.Fatal("expected next page token on first page")
	}

	secondPage, err := service.ListTransactions(ctx, connect.NewRequest(&pb.ListTransactionsRequest{
		PageSize:  2,
		PageToken: firstPage.Msg.NextPageToken,
	}))
	if err != nil {
		t.Fatalf("ListTransactions() second page error = %v", err)
	}

	if len(secondPage.Msg.Transactions) != 1 {
		t.Fatalf("second page length = %d, want 1", len(secondPage.Msg.Transactions))
	}
	if got := secondPage.Msg.Transactions[0].Description; got != "Oldest" {
		t.Fatalf("last transaction = %q, want %q", got, "Oldest")
	}
	if secondPage.Msg.NextPageToken != "" {
		t.Fatalf("expected empty next page token, got %q", secondPage.Msg.NextPageToken)
	}
}

type transactionServiceDBTX struct {
	transactions []db.Transaction
}

func (f transactionServiceDBTX) Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, errors.New("not implemented")
}

func (f transactionServiceDBTX) QueryRow(_ context.Context, sql string, args ...interface{}) pgx.Row {
	if strings.Contains(sql, "GetTransaction") {
		id := args[0].(pgtype.UUID)
		userID := args[1].(pgtype.UUID)
		for _, tx := range f.transactions {
			if UUIDToString(tx.ID) == UUIDToString(id) && UUIDToString(tx.UserID) == UUIDToString(userID) {
				return fakeDBRow{values: transactionRowValues(tx)}
			}
		}
		return fakeDBRow{err: pgx.ErrNoRows}
	}

	return fakeDBRow{err: errors.New("unexpected query")}
}

func (f transactionServiceDBTX) Query(_ context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	if !strings.Contains(sql, "ListTransactions") {
		return nil, errors.New("unexpected query")
	}

	userID := args[0].(pgtype.UUID)
	typeFilter := args[1].(pgtype.Text)
	categoryID := args[2].(pgtype.UUID)
	startDate := args[3].(pgtype.Timestamptz)
	endDate := args[4].(pgtype.Timestamptz)
	accountID := args[5].(pgtype.UUID)
	search := args[6].(pgtype.Text)
	cursorDate := args[7].(pgtype.Timestamptz)
	cursorID := args[8].(pgtype.UUID)
	limitCount := args[9].(int32)

	filtered := make([]db.Transaction, 0, len(f.transactions))
	for _, tx := range f.transactions {
		if UUIDToString(tx.UserID) != UUIDToString(userID) {
			continue
		}
		if typeFilter.Valid && tx.Type != typeFilter.String {
			continue
		}
		if categoryID.Valid && UUIDToString(tx.CategoryID) != UUIDToString(categoryID) {
			continue
		}
		if startDate.Valid && tx.Date.Time.Before(startDate.Time) {
			continue
		}
		if endDate.Valid && !tx.Date.Time.Before(endDate.Time) {
			continue
		}
		if accountID.Valid && UUIDToString(tx.AccountID) != UUIDToString(accountID) {
			continue
		}
		if search.Valid && !strings.Contains(strings.ToLower(tx.Description), strings.ToLower(search.String)) && !strings.Contains(strings.ToLower(tx.MerchantNorm), strings.ToLower(search.String)) {
			continue
		}
		if cursorDate.Valid {
			if tx.Date.Time.After(cursorDate.Time) {
				continue
			}
			if tx.Date.Time.Equal(cursorDate.Time) && UUIDToString(tx.ID) >= UUIDToString(cursorID) {
				continue
			}
		}
		filtered = append(filtered, tx)
	}

	for i := 0; i < len(filtered)-1; i++ {
		for j := i + 1; j < len(filtered); j++ {
			left := filtered[i]
			right := filtered[j]
			if right.Date.Time.After(left.Date.Time) || (right.Date.Time.Equal(left.Date.Time) && UUIDToString(right.ID) > UUIDToString(left.ID)) {
				filtered[i], filtered[j] = filtered[j], filtered[i]
			}
		}
	}

	if int(limitCount) < len(filtered) {
		filtered = filtered[:limitCount]
	}

	rows := make([][]any, 0, len(filtered))
	for _, tx := range filtered {
		rows = append(rows, transactionRowValues(tx))
	}
	return &fakeDBRows{rows: rows}, nil
}

func (f transactionServiceDBTX) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	return 0, errors.New("not implemented")
}

func newTestTransaction(id string, userID string, date time.Time, description string) db.Transaction {
	return db.Transaction{
		ID:           StringToUUID(id),
		UserID:       StringToUUID(userID),
		AmountPaise:  10_000,
		Description:  description,
		MerchantRaw:  description,
		MerchantNorm: strings.ToLower(description),
		Date:         pgtype.Timestamptz{Time: date, Valid: true},
		Type:         "EXPENSE",
		Status:       "POSTED",
		Provenance:   "MANUAL",
		IsRecurring:  pgtype.Bool{Bool: false, Valid: true},
		CreatedAt:    pgtype.Timestamptz{Time: date, Valid: true},
		UpdatedAt:    pgtype.Timestamptz{Time: date, Valid: true},
	}
}

func TestTransferTransactionsCannotBypassAtomicTransferEndpoint(t *testing.T) {
	if err := validateTransactionType("TRANSFER"); err == nil {
		t.Fatal("ordinary transaction creation must reject TRANSFER")
	}
	groupID := StringToUUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	if err := rejectPairedTransferMutation(db.Transaction{TransferGroupID: groupID}); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("grouped transfer mutation code=%v, want invalid argument", connect.CodeOf(err))
	}
	if err := rejectPairedTransferMutation(db.Transaction{}); err != nil {
		t.Fatalf("ordinary transaction unexpectedly rejected: %v", err)
	}
}

func TestExpenseUpdateCannotInvalidateRecordedRefunds(t *testing.T) {
	if err := validateExpenseRefundAggregate(5000, 4999, nil); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("smaller expense amount code=%v", connect.CodeOf(err))
	}
	income := "INCOME"
	if err := validateExpenseRefundAggregate(5000, 10000, &income); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expense type change code=%v", connect.CodeOf(err))
	}
	expense := "EXPENSE"
	if err := validateExpenseRefundAggregate(5000, 5000, &expense); err != nil {
		t.Fatalf("valid refunded expense update rejected: %v", err)
	}
}
