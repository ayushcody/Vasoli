package api

import (
	"errors"
	"fmt"
	"io"
	"reflect"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"vasoli-backend/internal/db"
)

type fakeDBRow struct {
	values []any
	err    error
}

func (r fakeDBRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != len(r.values) {
		return io.ErrUnexpectedEOF
	}
	for i := range dest {
		if err := assignScanValue(dest[i], r.values[i]); err != nil {
			return err
		}
	}
	return nil
}

type fakeDBRows struct {
	rows    [][]any
	index   int
	current []any
	err     error
}

func (r *fakeDBRows) Close() {}

func (r *fakeDBRows) Err() error {
	return r.err
}

func (r *fakeDBRows) CommandTag() pgconn.CommandTag {
	return pgconn.CommandTag{}
}

func (r *fakeDBRows) FieldDescriptions() []pgconn.FieldDescription {
	return nil
}

func (r *fakeDBRows) Next() bool {
	if r.index >= len(r.rows) {
		r.current = nil
		return false
	}
	r.current = r.rows[r.index]
	r.index++
	return true
}

func (r *fakeDBRows) Scan(dest ...any) error {
	if r.current == nil {
		return errors.New("no current row")
	}
	if len(dest) != len(r.current) {
		return io.ErrUnexpectedEOF
	}
	for i := range dest {
		if err := assignScanValue(dest[i], r.current[i]); err != nil {
			return err
		}
	}
	return nil
}

func (r *fakeDBRows) Values() ([]any, error) {
	if r.current == nil {
		return nil, errors.New("no current row")
	}
	return r.current, nil
}

func (r *fakeDBRows) RawValues() [][]byte {
	return nil
}

func (r *fakeDBRows) Conn() *pgx.Conn {
	return nil
}

func assignScanValue(dest any, value any) error {
	target := reflect.ValueOf(dest)
	if target.Kind() != reflect.Ptr || target.IsNil() {
		return fmt.Errorf("scan destination must be a non-nil pointer, got %T", dest)
	}

	elem := target.Elem()
	if value == nil {
		elem.Set(reflect.Zero(elem.Type()))
		return nil
	}

	source := reflect.ValueOf(value)
	if source.Type().AssignableTo(elem.Type()) {
		elem.Set(source)
		return nil
	}
	if source.Type().ConvertibleTo(elem.Type()) {
		elem.Set(source.Convert(elem.Type()))
		return nil
	}

	return fmt.Errorf("cannot scan %T into %T", value, dest)
}

func transactionRowValues(tx db.Transaction) []any {
	return []any{
		tx.ID,
		tx.UserID,
		tx.AmountPaise,
		tx.Description,
		tx.MerchantRaw,
		tx.MerchantNorm,
		tx.Date,
		tx.Type,
		tx.Status,
		tx.Provenance,
		tx.CategoryID,
		tx.AccountID,
		tx.TransferGroupID,
		tx.TransferDirection,
		tx.RefundOfTransactionID,
		tx.Tags,
		tx.PaymentMethod,
		tx.UpiID,
		tx.UpiRef,
		tx.BankRrn,
		tx.IsRecurring,
		tx.RecurringID,
		tx.ReceiptUrl,
		tx.ReceiptID,
		tx.ImportBatchID,
		tx.CreatedAt,
		tx.UpdatedAt,
	}
}

func recurringRuleRowValues(rule db.RecurringRule) []any {
	return []any{
		rule.ID,
		rule.UserID,
		rule.MerchantNorm,
		rule.AmountPaise,
		rule.Type,
		rule.Cadence,
		rule.NextDueDate,
		rule.Active,
		rule.CategoryID,
		rule.AccountID,
		rule.SnoozedUntil,
		rule.CancelledAt,
		rule.CreatedAt,
		rule.UpdatedAt,
	}
}
