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

func TestListUpcomingWeeklyRuleOverThirtyDays(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	now := startOfDay(time.Now().UTC())

	service := &RecurringService{
		DB: db.New(recurringServiceDBTX{
			rules: []db.RecurringRule{
				newTestRecurringRule("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", userID, now.AddDate(0, 0, 1), "weekly", pgtype.Timestamptz{}),
			},
		}),
	}

	ctx := context.WithValue(context.Background(), UserIDKey, userID)
	res, err := service.ListUpcoming(ctx, connect.NewRequest(&pb.ListUpcomingRequest{DaysAhead: 30}))
	if err != nil {
		t.Fatalf("ListUpcoming() error = %v", err)
	}

	if got := len(res.Msg.Rules); got != 5 {
		t.Fatalf("weekly occurrences = %d, want 5", got)
	}
	if !res.Msg.Rules[0].GetNextDueDate().AsTime().Before(res.Msg.Rules[1].GetNextDueDate().AsTime()) {
		t.Fatal("expected weekly occurrences to be sorted ascending")
	}
}

func TestListUpcomingMonthlyRuleOverSixtyDays(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	now := startOfDay(time.Now().UTC())

	service := &RecurringService{
		DB: db.New(recurringServiceDBTX{
			rules: []db.RecurringRule{
				newTestRecurringRule("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", userID, now.AddDate(0, 0, 1), "monthly", pgtype.Timestamptz{}),
			},
		}),
	}

	ctx := context.WithValue(context.Background(), UserIDKey, userID)
	res, err := service.ListUpcoming(ctx, connect.NewRequest(&pb.ListUpcomingRequest{DaysAhead: 60}))
	if err != nil {
		t.Fatalf("ListUpcoming() error = %v", err)
	}

	if got := len(res.Msg.Rules); got < 2 {
		t.Fatalf("monthly occurrences = %d, want at least 2", got)
	}
	for i := 1; i < len(res.Msg.Rules); i++ {
		prev := res.Msg.Rules[i-1].GetNextDueDate().AsTime()
		curr := res.Msg.Rules[i].GetNextDueDate().AsTime()
		diff := curr.Sub(prev)
		if diff < 28*24*time.Hour || diff > 31*24*time.Hour {
			t.Fatalf("monthly occurrence spacing = %s, want roughly one month", diff)
		}
	}
}

func TestListUpcomingSkipsSnoozedRuleUntilSnoozePasses(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	now := startOfDay(time.Now().UTC())

	service := &RecurringService{
		DB: db.New(recurringServiceDBTX{
			rules: []db.RecurringRule{
				newTestRecurringRule(
					"cccccccc-cccc-cccc-cccc-cccccccccccc",
					userID,
					now,
					"weekly",
					pgtype.Timestamptz{Time: now.AddDate(0, 0, 14), Valid: true},
				),
			},
		}),
	}

	ctx := context.WithValue(context.Background(), UserIDKey, userID)
	res, err := service.ListUpcoming(ctx, connect.NewRequest(&pb.ListUpcomingRequest{DaysAhead: 7}))
	if err != nil {
		t.Fatalf("ListUpcoming() error = %v", err)
	}

	if got := len(res.Msg.Rules); got != 0 {
		t.Fatalf("snoozed occurrences = %d, want 0", got)
	}
}

func TestMonthlyOccurrencesPreserveMonthEndAnchor(t *testing.T) {
	rule := newTestRecurringRule(
		"dddddddd-dddd-dddd-dddd-dddddddddddd",
		"11111111-1111-1111-1111-111111111111",
		time.Date(2025, time.January, 31, 9, 15, 0, 0, time.UTC),
		"monthly",
		pgtype.Timestamptz{},
	)
	got := expandRecurringOccurrences(rule,
		time.Date(2025, time.January, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2025, time.April, 1, 0, 0, 0, 0, time.UTC),
	)
	want := []time.Time{
		time.Date(2025, time.January, 31, 0, 0, 0, 0, indiaLocation),
		time.Date(2025, time.February, 28, 0, 0, 0, 0, indiaLocation),
		time.Date(2025, time.March, 31, 0, 0, 0, 0, indiaLocation),
	}
	if len(got) != len(want) {
		t.Fatalf("occurrence count = %d, want %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if !got[i].Equal(want[i]) {
			t.Errorf("occurrence %d = %v, want %v", i, got[i], want[i])
		}
	}
}

func TestYearlyOccurrencesPreserveLeapDayAnchor(t *testing.T) {
	rule := newTestRecurringRule(
		"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
		"11111111-1111-1111-1111-111111111111",
		time.Date(2024, time.February, 29, 0, 0, 0, 0, time.UTC),
		"yearly",
		pgtype.Timestamptz{},
	)
	got := expandRecurringOccurrences(rule,
		time.Date(2024, time.January, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2029, time.March, 1, 0, 0, 0, 0, time.UTC),
	)
	want := []time.Time{
		time.Date(2024, time.February, 29, 0, 0, 0, 0, indiaLocation),
		time.Date(2025, time.February, 28, 0, 0, 0, 0, indiaLocation),
		time.Date(2026, time.February, 28, 0, 0, 0, 0, indiaLocation),
		time.Date(2027, time.February, 28, 0, 0, 0, 0, indiaLocation),
		time.Date(2028, time.February, 29, 0, 0, 0, 0, indiaLocation),
		time.Date(2029, time.February, 28, 0, 0, 0, 0, indiaLocation),
	}
	if len(got) != len(want) {
		t.Fatalf("occurrence count = %d, want %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if !got[i].Equal(want[i]) {
			t.Errorf("occurrence %d = %v, want %v", i, got[i], want[i])
		}
	}
}

func TestWeeklySnoozeKeepsOriginalCadencePhase(t *testing.T) {
	anchor := time.Date(2026, time.January, 1, 9, 0, 0, 0, time.UTC)
	rule := newTestRecurringRule(
		"ffffffff-ffff-ffff-ffff-ffffffffffff",
		"11111111-1111-1111-1111-111111111111",
		anchor,
		"weekly",
		pgtype.Timestamptz{Time: time.Date(2026, time.January, 4, 18, 0, 0, 0, time.UTC), Valid: true},
	)
	got := expandRecurringOccurrences(rule,
		time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, time.January, 16, 0, 0, 0, 0, time.UTC),
	)
	want := []time.Time{
		time.Date(2026, time.January, 8, 0, 0, 0, 0, indiaLocation),
		time.Date(2026, time.January, 15, 0, 0, 0, 0, indiaLocation),
	}
	if len(got) != len(want) {
		t.Fatalf("occurrences = %v, want %v", got, want)
	}
	for i := range want {
		if !got[i].Equal(want[i]) {
			t.Errorf("occurrence %d = %v, want %v", i, got[i], want[i])
		}
	}
}

func TestIndiaMidnightMonthlyOccurrenceKeepsMarchFirstAcrossLeapDay(t *testing.T) {
	loc, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	anchor := time.Date(2028, time.March, 1, 0, 0, 0, 0, loc)
	rule := newTestRecurringRule(
		"abababab-abab-abab-abab-abababababab",
		"11111111-1111-1111-1111-111111111111",
		anchor,
		"monthly",
		pgtype.Timestamptz{},
	)
	got := expandRecurringOccurrences(rule,
		time.Date(2028, time.February, 28, 0, 0, 0, 0, loc),
		time.Date(2028, time.April, 2, 0, 0, 0, 0, loc),
	)
	want := []time.Time{
		time.Date(2028, time.March, 1, 0, 0, 0, 0, loc),
		time.Date(2028, time.April, 1, 0, 0, 0, 0, loc),
	}
	if len(got) != len(want) {
		t.Fatalf("occurrence count = %d, want %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if !got[i].Equal(want[i]) || got[i].In(loc).Format("2006-01-02") != want[i].Format("2006-01-02") {
			t.Errorf("occurrence %d = %v (%s), want %v", i, got[i], got[i].In(loc).Format(time.RFC3339), want[i])
		}
	}
	if !recurringDateMatchesIndia(anchor, "monthly", pgtype.Timestamptz{}, want[0]) {
		t.Fatal("recording the March 1 India occurrence should match the schedule")
	}
	if recurringDateMatchesIndia(anchor, "monthly", pgtype.Timestamptz{}, time.Date(2028, time.February, 29, 0, 0, 0, 0, loc)) {
		t.Fatal("February 29 should not match a March 1 India occurrence")
	}
}

type recurringServiceDBTX struct {
	rules []db.RecurringRule
}

func (f recurringServiceDBTX) Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, errors.New("not implemented")
}

func (f recurringServiceDBTX) QueryRow(context.Context, string, ...interface{}) pgx.Row {
	return fakeDBRow{err: errors.New("not implemented")}
}

func (f recurringServiceDBTX) Query(_ context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	if !strings.Contains(sql, "ListUpcomingRecurringRules") {
		return nil, errors.New("unexpected query")
	}

	userID := args[0].(pgtype.UUID)
	horizon := args[1].(pgtype.Timestamptz)

	rows := make([][]any, 0, len(f.rules))
	for _, rule := range f.rules {
		if UUIDToString(rule.UserID) != UUIDToString(userID) {
			continue
		}
		if !rule.Active || rule.CancelledAt.Valid {
			continue
		}
		if rule.NextDueDate.Time.After(horizon.Time) {
			continue
		}
		rows = append(rows, recurringRuleRowValues(rule))
	}

	return &fakeDBRows{rows: rows}, nil
}

func (f recurringServiceDBTX) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	return 0, errors.New("not implemented")
}

func newTestRecurringRule(id string, userID string, nextDue time.Time, cadence string, snoozedUntil pgtype.Timestamptz) db.RecurringRule {
	return db.RecurringRule{
		ID:           StringToUUID(id),
		UserID:       StringToUUID(userID),
		MerchantNorm: "rent",
		AmountPaise:  5_000,
		Type:         "EXPENSE",
		Cadence:      cadence,
		NextDueDate:  pgtype.Timestamptz{Time: nextDue, Valid: true},
		Active:       true,
		SnoozedUntil: snoozedUntil,
		CreatedAt:    pgtype.Timestamptz{Time: nextDue, Valid: true},
		UpdatedAt:    pgtype.Timestamptz{Time: nextDue, Valid: true},
	}
}

type recurringCandidateDBTX struct {
	candidates []db.GetRecurringCandidatesRow
}

func (f recurringCandidateDBTX) Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, errors.New("not implemented")
}

func (f recurringCandidateDBTX) QueryRow(context.Context, string, ...interface{}) pgx.Row {
	return fakeDBRow{err: errors.New("not implemented")}
}

func (f recurringCandidateDBTX) Query(_ context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	if !strings.Contains(sql, "GetRecurringCandidates") {
		return nil, errors.New("unexpected query")
	}

	rows := make([][]any, 0, len(f.candidates))
	for _, c := range f.candidates {
		rows = append(rows, []any{
			c.MerchantNorm,
			c.Type,
			c.FOccurrenceCount,
			c.FirstDate,
			c.LastDate,
			c.AvgAmount,
			c.StddevAmount,
		})
	}
	return &fakeDBRows{rows: rows}, nil
}

func (f recurringCandidateDBTX) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	return 0, errors.New("not implemented")
}

func TestListCandidatesMonthlySubscription(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	ctx := context.WithValue(context.Background(), UserIDKey, userID)

	firstDate := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	lastDate := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	service := &RecurringService{
		DB: db.New(recurringCandidateDBTX{
			candidates: []db.GetRecurringCandidatesRow{
				{
					MerchantNorm:     "netflix",
					Type:             "EXPENSE",
					FOccurrenceCount: 3,
					FirstDate:        pgtype.Timestamptz{Time: firstDate, Valid: true},
					LastDate:         pgtype.Timestamptz{Time: lastDate, Valid: true},
					AvgAmount:        80000,
					StddevAmount:     0.0,
				},
			},
		}),
	}

	req := connect.NewRequest(&pb.ListCandidatesRequest{})
	res, err := service.ListCandidates(ctx, req)
	if err != nil {
		t.Fatalf("ListCandidates failed: %v", err)
	}

	if len(res.Msg.Candidates) != 1 {
		t.Fatalf("expected 1 candidate, got %d", len(res.Msg.Candidates))
	}

	cand := res.Msg.Candidates[0]
	if cand.MerchantNorm != "netflix" {
		t.Errorf("expected netflix, got %s", cand.MerchantNorm)
	}
	if cand.InferredCadence != "monthly" {
		t.Errorf("expected monthly, got %s", cand.InferredCadence)
	}
	if cand.ConfidenceScore < 95.0 {
		t.Errorf("expected high confidence, got %f", cand.ConfidenceScore)
	}
}

func TestListCandidatesIgnoresNoisyAmounts(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	ctx := context.WithValue(context.Background(), UserIDKey, userID)

	firstDate := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	lastDate := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	service := &RecurringService{
		DB: db.New(recurringCandidateDBTX{
			candidates: []db.GetRecurringCandidatesRow{
				{
					MerchantNorm:     "uber",
					Type:             "EXPENSE",
					FOccurrenceCount: 3,
					FirstDate:        pgtype.Timestamptz{Time: firstDate, Valid: true},
					LastDate:         pgtype.Timestamptz{Time: lastDate, Valid: true},
					AvgAmount:        80000,
					StddevAmount:     45000.0, // High standard deviation
				},
			},
		}),
	}

	req := connect.NewRequest(&pb.ListCandidatesRequest{})
	res, err := service.ListCandidates(ctx, req)
	if err != nil {
		t.Fatalf("ListCandidates failed: %v", err)
	}

	if len(res.Msg.Candidates) != 0 {
		t.Fatalf("expected 0 candidates due to noise, got %d", len(res.Msg.Candidates))
	}
}

func TestListUpcomingRejectsUnboundedHorizonBeforeDatabaseAccess(t *testing.T) {
	service := &RecurringService{}
	ctx := context.WithValue(context.Background(), UserIDKey, "11111111-1111-1111-1111-111111111111")
	_, err := service.ListUpcoming(ctx, connect.NewRequest(&pb.ListUpcomingRequest{DaysAhead: 2147483647}))
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("code = %v, want invalid argument", connect.CodeOf(err))
	}
}
