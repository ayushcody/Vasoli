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
	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type importCountingDBTX struct {
	queryRowCalls int
}

func (*importCountingDBTX) Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, errors.New("unexpected Exec")
}

func (*importCountingDBTX) Query(context.Context, string, ...interface{}) (pgx.Rows, error) {
	return nil, errors.New("unexpected Query")
}

func (db *importCountingDBTX) QueryRow(context.Context, string, ...interface{}) pgx.Row {
	db.queryRowCalls++
	return fakeDBRow{err: errors.New("unexpected QueryRow")}
}

func (*importCountingDBTX) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	return 0, errors.New("unexpected CopyFrom")
}

func TestImportStatementDoesNotCreateBatchForMalformedFileOrRetry(t *testing.T) {
	dbtx := &importCountingDBTX{}
	service := &ImportService{DB: db.New(dbtx)}
	ctx := context.WithValue(context.Background(), UserIDKey, "11111111-1111-1111-1111-111111111111")
	request := connect.NewRequest(&pb.ImportStatementRequest{
		Format: "generic_csv",
		File:   []byte("date,description\n\"unterminated"),
	})

	for attempt := 1; attempt <= 2; attempt++ {
		_, err := service.ImportStatement(ctx, request)
		if connect.CodeOf(err) != connect.CodeFailedPrecondition {
			t.Fatalf("attempt %d code = %v, want %v", attempt, connect.CodeOf(err), connect.CodeFailedPrecondition)
		}
	}
	if dbtx.queryRowCalls != 0 {
		t.Fatalf("database QueryRow calls = %d, want 0 for invalid imports", dbtx.queryRowCalls)
	}
}

func TestImportStatementRejectsOversizedFileBeforeDatabaseWrite(t *testing.T) {
	dbtx := &importCountingDBTX{}
	service := &ImportService{DB: db.New(dbtx)}
	ctx := context.WithValue(context.Background(), UserIDKey, "11111111-1111-1111-1111-111111111111")
	request := connect.NewRequest(&pb.ImportStatementRequest{
		Format: "generic_csv",
		File:   make([]byte, maxImportFileBytes+1),
	})

	_, err := service.ImportStatement(ctx, request)
	if connect.CodeOf(err) != connect.CodeFailedPrecondition {
		t.Fatalf("code = %v, want %v", connect.CodeOf(err), connect.CodeFailedPrecondition)
	}
	if dbtx.queryRowCalls != 0 {
		t.Fatalf("database QueryRow calls = %d, want 0 for oversized import", dbtx.queryRowCalls)
	}
}

func TestParseImportRowsRejectsExcessiveCSVRows(t *testing.T) {
	file := []byte(strings.Repeat("x\n", maxImportCSVRows+21))
	_, err := parseImportRows("generic_csv", file, "")
	if err == nil || !strings.Contains(err.Error(), "row import limit") {
		t.Fatalf("error = %v, want row import limit error", err)
	}
}

func TestImportStatementDoesNotCreateBatchWhenNoTransactionsParse(t *testing.T) {
	dbtx := &importCountingDBTX{}
	service := &ImportService{DB: db.New(dbtx)}
	ctx := context.WithValue(context.Background(), UserIDKey, "11111111-1111-1111-1111-111111111111")
	request := connect.NewRequest(&pb.ImportStatementRequest{
		Format: "generic_csv",
		File:   []byte("date,description,amount\n31/02/2026,Coffee,12.50\n"),
	})

	_, err := service.ImportStatement(ctx, request)
	if connect.CodeOf(err) != connect.CodeFailedPrecondition {
		t.Fatalf("code = %v, want %v", connect.CodeOf(err), connect.CodeFailedPrecondition)
	}
	if dbtx.queryRowCalls != 0 {
		t.Fatalf("database QueryRow calls = %d, want 0 when no transactions parse", dbtx.queryRowCalls)
	}
}

func TestImportAmountUsesExactPaiseAndRejectsOverflow(t *testing.T) {
	if got := parseDecimalAmount("₹1,234.56"); got != 123456 {
		t.Fatalf("parseDecimalAmount() = %d, want 123456", got)
	}
	if got := parseSignedDecimalAmount("90071992547409.93"); got != 9007199254740993 {
		t.Fatalf("parseSignedDecimalAmount() = %d, want exact value 9007199254740993", got)
	}
	if got := parseSignedDecimalAmount("92233720368547758.08"); got != 0 {
		t.Fatalf("overflow amount = %d, want 0", got)
	}
	if got := parseSignedDecimalAmount("(12.34)"); got != -1234 {
		t.Fatalf("accounting negative = %d, want -1234", got)
	}
}

func TestImportDateRejectsCalendarOverflow(t *testing.T) {
	for _, value := range []string{"31/02/2026", "00/01/2026", "01/13/2026"} {
		if _, err := parseSlashDate(value); err == nil {
			t.Errorf("parseSlashDate(%q) unexpectedly succeeded", value)
		}
	}
	got, err := parseFlexibleDate("29/02/24")
	if err != nil {
		t.Fatalf("parseFlexibleDate() error = %v", err)
	}
	if got.Year() != 2024 || got.Month() != 2 || got.Day() != 29 {
		t.Fatalf("parsed date = %v, want 2024-02-29", got)
	}
}

func TestImportDateOnlyUsesIndiaMidnightAndExplicitTimestampKeepsInstant(t *testing.T) {
	for _, value := range []string{"2026-10-18", "18/10/2026", "18-10-2026"} {
		got, err := parseFlexibleDate(value)
		if err != nil {
			t.Fatalf("parseFlexibleDate(%q): %v", value, err)
		}
		if got.Format("2006-01-02") != "2026-10-18" || got.Hour() != 0 || got.Minute() != 0 || got.Location().String() != "Asia/Kolkata" {
			t.Errorf("date-only %q parsed as %s; want India midnight", value, got.Format(time.RFC3339))
		}
	}

	explicit, err := parseFlexibleDate("2026-10-18T00:00:00Z")
	if err != nil {
		t.Fatal(err)
	}
	if !explicit.Equal(time.Date(2026, time.October, 18, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("explicit UTC instant parsed as %s", explicit.Format(time.RFC3339Nano))
	}

	localDateTime, err := parseFlexibleDate("2026-10-18 00:00:00")
	if err != nil {
		t.Fatal(err)
	}
	if localDateTime.Location().String() != "Asia/Kolkata" || localDateTime.Hour() != 0 {
		t.Errorf("local date-time parsed as %s; want India-local midnight", localDateTime.Format(time.RFC3339))
	}
	localTimestamp, err := parseFlexibleDate("2026-10-18T09:45:00")
	if err != nil {
		t.Fatal(err)
	}
	if localTimestamp.Location().String() != "Asia/Kolkata" || localTimestamp.Hour() != 9 || localTimestamp.Minute() != 45 {
		t.Errorf("local timestamp parsed as %s; want India-local 09:45", localTimestamp.Format(time.RFC3339))
	}
}
