package api

import (
	"context"
	"errors"
	"io"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

func TestInsightsServiceGetSummary(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	januaryIncomeDate := time.Date(2026, time.January, 3, 0, 0, 0, 0, time.UTC)
	januaryExpenseDate := time.Date(2026, time.January, 12, 0, 0, 0, 0, time.UTC)
	januaryInvestmentDate := time.Date(2026, time.January, 20, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name         string
		transactions []db.Transaction
		wantIncome   int64
		wantExpense  int64
		wantBalance  int64
	}{
		{
			name: "income expenses and investments use standard accounting semantics",
			transactions: []db.Transaction{
				{UserID: StringToUUID(userID), AmountPaise: 100_000, Type: "INCOME", Date: pgtype.Timestamptz{Time: januaryIncomeDate, Valid: true}},
				{UserID: StringToUUID(userID), AmountPaise: 25_000, Type: "EXPENSE", Date: pgtype.Timestamptz{Time: januaryExpenseDate, Valid: true}},
				{UserID: StringToUUID(userID), AmountPaise: 10_000, Type: "INVESTMENT", Date: pgtype.Timestamptz{Time: januaryInvestmentDate, Valid: true}},
				{UserID: StringToUUID(userID), AmountPaise: 5_000, Type: "EXPENSE", Date: pgtype.Timestamptz{Time: januaryExpenseDate.Add(24 * time.Hour), Valid: true}},
			},
			wantIncome:  100_000,
			wantExpense: 30_000,
			wantBalance: 70_000,
		},
		{
			name:         "no transactions returns zeros",
			transactions: nil,
			wantIncome:   0,
			wantExpense:  0,
			wantBalance:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := &InsightsService{
				DB: db.New(summaryDBTX{transactions: tt.transactions}),
			}

			ctx := context.WithValue(context.Background(), UserIDKey, userID)
			res, err := service.GetSummary(ctx, connect.NewRequest(&pb.GetSummaryRequest{MonthYear: "2026-01"}))
			if err != nil {
				t.Fatalf("GetSummary() error = %v", err)
			}

			if got := res.Msg.TotalIncomePaise; got != tt.wantIncome {
				t.Fatalf("TotalIncomePaise = %d, want %d", got, tt.wantIncome)
			}
			if got := res.Msg.TotalExpensePaise; got != tt.wantExpense {
				t.Fatalf("TotalExpensePaise = %d, want %d", got, tt.wantExpense)
			}
			if got := res.Msg.BalancePaise; got != tt.wantBalance {
				t.Fatalf("BalancePaise = %d, want %d", got, tt.wantBalance)
			}
		})
	}
}

type summaryDBTX struct {
	transactions []db.Transaction
}

func (s summaryDBTX) Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, errors.New("not implemented")
}

func (s summaryDBTX) Query(context.Context, string, ...interface{}) (pgx.Rows, error) {
	return nil, errors.New("not implemented")
}

func (s summaryDBTX) QueryRow(_ context.Context, _ string, args ...interface{}) pgx.Row {
	userID := args[0].(pgtype.UUID)
	startDate := args[1].(pgtype.Timestamptz).Time
	endDate := args[2].(pgtype.Timestamptz).Time

	var income int64
	var expenses int64
	for _, tx := range s.transactions {
		if UUIDToString(tx.UserID) != UUIDToString(userID) {
			continue
		}
		if tx.Date.Time.Before(startDate) || !tx.Date.Time.Before(endDate) {
			continue
		}

		switch tx.Type {
		case "INCOME":
			income += tx.AmountPaise
		case "EXPENSE":
			expenses += tx.AmountPaise
		}
	}

	return summaryRow{
		values: []any{income, expenses, income - expenses},
	}
}

func (s summaryDBTX) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	return 0, errors.New("not implemented")
}

type summaryRow struct {
	values []any
	err    error
}

func (r summaryRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != len(r.values) {
		return io.ErrUnexpectedEOF
	}

	for index, value := range r.values {
		switch target := dest[index].(type) {
		case *int64:
			*target = value.(int64)
		default:
			return errors.New("unsupported scan target")
		}
	}

	return nil
}
