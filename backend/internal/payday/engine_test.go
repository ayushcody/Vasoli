package payday

import (
	"testing"
	"time"
)

func TestProjectKeepsPaiseAndAppliesReserveAndGoalOnce(t *testing.T) {
	today := time.Date(2026, 1, 30, 12, 0, 0, 0, time.UTC)
	days, err := Project(today, Config{DailyAllowancePaise: 10000, MinimumReservePaise: 50000, GoalReservedPaise: 20000, NextPayday: time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)}, []Account{{ID: "a", BalancePaise: 100000}}, []Flow{{Date: time.Date(2026, 1, 31, 0, 0, 0, 0, time.UTC), AmountPaise: 25000, Income: true}})
	if err != nil {
		t.Fatal(err)
	}
	if got := days[0].ClosingPaise; got != 90000 {
		t.Fatalf("Jan 30 closing = %d, want 90000", got)
	}
	if got := days[1].ClosingPaise; got != 105000 {
		t.Fatalf("Jan 31 closing = %d, want 105000", got)
	}
	if got := days[1].SafeToSpendPaise; got != 10000 {
		t.Fatalf("Jan 31 safe = %d, want 10000", got)
	}
	if len(days) != 2 {
		t.Fatalf("projection included payday itself: %d days", len(days))
	}
}

func TestProjectDoesNotCountFutureIncomeForSafeToday(t *testing.T) {
	today := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	days, err := Project(today, Config{NextPayday: today.AddDate(0, 0, 2)}, []Account{{ID: "a", BalancePaise: 50000}}, []Flow{{Date: today.AddDate(0, 0, 1), AmountPaise: 100000, Income: true}})
	if err != nil {
		t.Fatal(err)
	}
	if got := days[0].SafeToSpendPaise; got != 50000 {
		t.Fatalf("safe today used future income: %d", got)
	}
}

func TestProjectRejectsInvalidPaydayRange(t *testing.T) {
	today := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	_, err := Project(today, Config{NextPayday: today.AddDate(1, 0, 2)}, []Account{{ID: "a"}}, nil)
	if err == nil {
		t.Fatal("expected payday over 366 days to fail")
	}
}

func TestProjectTracksAccountSpecificBalancesAndPooledShortfall(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Kolkata")
	today := time.Date(2026, 4, 1, 10, 0, 0, 0, loc)
	days, err := Project(today, Config{DailyAllowancePaise: 100, MinimumReservePaise: 500, NextPayday: time.Date(2026, 4, 3, 0, 0, 0, 0, loc)}, []Account{{ID: "salary", BalancePaise: 1000}, {ID: "wallet", BalancePaise: 100}}, []Flow{{Date: time.Date(2026, 4, 2, 0, 0, 0, 0, loc), AmountPaise: 250, AccountID: "wallet"}})
	if err != nil {
		t.Fatal(err)
	}
	if got := days[1].AccountClosingPaise["wallet"]; got != -150 {
		t.Fatalf("wallet close=%d, want -150", got)
	}
	if got := days[1].AccountClosingPaise["salary"]; got != 1000 {
		t.Fatalf("salary close=%d, want 1000", got)
	}
	if got := days[1].ClosingPaise; got != 650 {
		t.Fatalf("pooled close=%d, want 650", got)
	}
}

func TestProjectUsesInputCalendarLocation(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Kolkata")
	// This instant is still the previous date in UTC but is April 2 in India.
	today := time.Date(2026, 4, 1, 20, 0, 0, 0, time.UTC).In(loc)
	days, err := Project(today, Config{NextPayday: time.Date(2026, 4, 4, 0, 0, 0, 0, loc)}, []Account{{ID: "a", BalancePaise: 1000}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got := days[0].Date.Format("2006-01-02"); got != "2026-04-02" {
		t.Fatalf("first projected date=%s, want India calendar date 2026-04-02", got)
	}
}

func TestProjectScenarioOutflowReducesTodaySafeAmount(t *testing.T) {
	today := time.Date(2026, 4, 1, 10, 0, 0, 0, time.UTC)
	base, err := Project(today, Config{NextPayday: today.AddDate(0, 0, 2)}, []Account{{ID: "a", BalancePaise: 10000}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	scenario, err := Project(today, Config{NextPayday: today.AddDate(0, 0, 2)}, []Account{{ID: "a", BalancePaise: 10000}}, []Flow{{Date: today, AmountPaise: 3000}})
	if err != nil {
		t.Fatal(err)
	}
	if got := scenario[0].SafeToSpendPaise; got != base[0].SafeToSpendPaise-3000 {
		t.Fatalf("scenario safe=%d, base=%d", got, base[0].SafeToSpendPaise)
	}
}

func TestProjectInternalTransfersMoveAccountsButNotPooledSafeAmount(t *testing.T) {
	today := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	flows := []Flow{{Date: today.AddDate(0, 0, 1), AmountPaise: 3000, AccountID: "a", Transfer: true, InternalTransfer: true}, {Date: today.AddDate(0, 0, 1), AmountPaise: 3000, AccountID: "b", Transfer: true, Income: true, InternalTransfer: true}}
	days, err := Project(today, Config{NextPayday: today.AddDate(0, 0, 2)}, []Account{{ID: "a", BalancePaise: 10000}, {ID: "b", BalancePaise: 5000}}, flows)
	if err != nil {
		t.Fatal(err)
	}
	if days[1].ClosingPaise != 15000 || days[1].SafeToSpendPaise != 15000 {
		t.Fatalf("internal transfer changed pool/safe amount: close=%d safe=%d", days[1].ClosingPaise, days[1].SafeToSpendPaise)
	}
	if days[1].AccountClosingPaise["a"] != 7000 || days[1].AccountClosingPaise["b"] != 8000 {
		t.Fatalf("internal transfer account balances incorrect: %#v", days[1].AccountClosingPaise)
	}
	if days[1].IncomePaise != 0 || days[1].ObligationsPaise != 0 || days[1].TransferInPaise != 0 || days[1].TransferOutPaise != 0 {
		t.Fatalf("internal transfer mislabeled as external cashflow: %+v", days[1])
	}
}

func TestProjectExternalTransferOutReducesPoolSafeAmount(t *testing.T) {
	today := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	days, err := Project(today, Config{NextPayday: today.AddDate(0, 0, 2)}, []Account{{ID: "a", BalancePaise: 10000}}, []Flow{{Date: today.AddDate(0, 0, 1), AmountPaise: 3000, AccountID: "a", Transfer: true}})
	if err != nil {
		t.Fatal(err)
	}
	if days[1].ClosingPaise != 7000 || days[0].SafeToSpendPaise != 7000 || days[1].TransferOutPaise != 3000 {
		t.Fatalf("external transfer out not reflected correctly: %+v", days)
	}
}
