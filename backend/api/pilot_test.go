package api

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"vasoli-backend/internal/payday"
)

func TestParseIndiaDateUsesAsiaKolkataMidnight(t *testing.T) {
	got, err := parseIndiaDate("2026-10-17")
	if err != nil {
		t.Fatal(err)
	}
	name, offset := got.Zone()
	if name != "IST" || offset != 5*60*60+30*60 {
		t.Fatalf("zone = %s offset=%d, want India +05:30", name, offset)
	}
	if got.Hour() != 0 || got.Minute() != 0 || got.Format("2006-01-02") != "2026-10-17" {
		t.Fatalf("parsed date = %s", got.Format(time.RFC3339))
	}
}

func TestPaydayDateValidationUsesIndiaDayAndLeapCalendar(t *testing.T) {
	indiaBoundary := time.Date(2026, 10, 17, 20, 0, 0, 0, time.UTC) // Oct 18 in India.
	todayIndia := indiaBoundary.In(indiaLocation)
	todayDate, _ := parseIndiaDate("2026-10-18")
	previousDate, _ := parseIndiaDate("2026-10-17")
	if !validNextPayday(todayDate, todayIndia) {
		t.Fatal("today in India must be accepted despite UTC date still being yesterday")
	}
	if validNextPayday(previousDate, todayIndia) {
		t.Fatal("previous India calendar day must be rejected")
	}

	leapToday, _ := parseIndiaDate("2028-02-29")
	upper := indiaDayStart(leapToday).AddDate(0, 0, 366)
	if !validNextPayday(upper, leapToday) {
		t.Fatalf("366-day leap-year boundary %s should be accepted", upper.Format("2006-01-02"))
	}
	if validNextPayday(upper.AddDate(0, 0, 1), leapToday) {
		t.Fatal("payday beyond 366 calendar days must be rejected")
	}
}

func TestTransferFlowDirectionAffectsOwnAccountProjection(t *testing.T) {
	if transactionFlowIsIncome("TRANSFER", "IN") != true || transactionFlowIsIncome("TRANSFER", "OUT") != false {
		t.Fatal("transfer directions must update only the matching account balance")
	}
}

func TestPooledForecastMinimumIncludesCurrentOpeningBeforeFutureIncome(t *testing.T) {
	today := time.Date(2026, 8, 1, 0, 0, 0, 0, indiaLocation)
	days := []payday.Day{{Date: today, OpeningPaise: 500, ClosingPaise: 1500}, {Date: today.AddDate(0, 0, 1), OpeningPaise: 1500, ClosingPaise: 1200}}
	lowest, first, err := pooledForecastMinimum(days, 800, 0)
	if err != nil {
		t.Fatal(err)
	}
	if lowest != 500 {
		t.Fatalf("pooled lowest=%d, want current opening 500", lowest)
	}
	if first == nil || *first != "2026-08-01" {
		t.Fatalf("first shortfall=%v, want today", first)
	}
}

func TestValidateObligationTransactionRequiresMatchingPostedExpense(t *testing.T) {
	account := pgtype.UUID{Bytes: [16]byte{1}, Valid: true}
	otherAccount := pgtype.UUID{Bytes: [16]byte{2}, Valid: true}
	paidAt := time.Date(2026, time.October, 18, 0, 30, 0, 0, indiaLocation)
	dateOnlyTransaction := time.Date(2026, time.October, 17, 18, 30, 0, 0, time.UTC) // Midnight Oct 18 in India.
	if err := validateObligationTransaction("EXPENSE", "POSTED", 10_029, 10_029, account, account, dateOnlyTransaction, paidAt); err != nil {
		t.Fatalf("same India calendar-day date-only expense should be valid: %v", err)
	}
	tests := []struct {
		name    string
		typ     string
		status  string
		amount  int64
		account pgtype.UUID
		date    time.Time
	}{
		{name: "income", typ: "INCOME", status: "POSTED", amount: 10_029, account: account, date: dateOnlyTransaction},
		{name: "pending", typ: "EXPENSE", status: "PENDING", amount: 10_029, account: account, date: dateOnlyTransaction},
		{name: "wrong amount", typ: "EXPENSE", status: "POSTED", amount: 10_028, account: account, date: dateOnlyTransaction},
		{name: "wrong account", typ: "EXPENSE", status: "POSTED", amount: 10_029, account: otherAccount, date: dateOnlyTransaction},
		{name: "future date", typ: "EXPENSE", status: "POSTED", amount: 10_029, account: account, date: paidAt.AddDate(0, 0, 1)},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := validateObligationTransaction(test.typ, test.status, test.amount, 10_029, test.account, account, test.date, paidAt); err == nil {
				t.Fatal("expected linked transaction to be rejected")
			}
		})
	}
}
