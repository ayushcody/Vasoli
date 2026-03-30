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
