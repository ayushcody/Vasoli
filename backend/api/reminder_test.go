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
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

func TestCreateReminderValidation(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	service := &ReminderService{DB: db.New(reminderServiceDBTX{})}
	ctx := context.WithValue(context.Background(), UserIDKey, userID)

	tests := []struct {
		name string
		req  *pb.CreateReminderRequest
	}{
		{
			name: "title required",
			req: &pb.CreateReminderRequest{
				Title:   "",
				Type:    "BILL_DUE",
				DueDate: timestamppb.Now(),
			},
		},
		{
			name: "due date required",
			req: &pb.CreateReminderRequest{
				Title: "Pay electricity bill",
				Type:  "BILL_DUE",
			},
		},
		{
			name: "invalid type",
			req: &pb.CreateReminderRequest{
				Title:   "Pay electricity bill",
				Type:    "INVALID_TYPE",
				DueDate: timestamppb.Now(),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.CreateReminder(ctx, connect.NewRequest(tt.req))
			if err == nil {
				t.Fatal("expected validation error")
			}
			if connect.CodeOf(err) != connect.CodeInvalidArgument {
				t.Fatalf("code = %v, want %v", connect.CodeOf(err), connect.CodeInvalidArgument)
			}
		})
	}
}

func TestGetReminderReturnsNotFoundForWrongUser(t *testing.T) {
	reminderID := "22222222-2222-2222-2222-222222222222"
	ownerID := "11111111-1111-1111-1111-111111111111"
	callerID := "33333333-3333-3333-3333-333333333333"
	now := time.Now().UTC()

	service := &ReminderService{
		DB: db.New(reminderServiceDBTX{
			reminders: []db.Reminder{
				{
					ID:           StringToUUID(reminderID),
					UserID:       StringToUUID(ownerID),
					Title:        "Pay Rent",
					ReminderType: "BILL_DUE",
					DueAt:        pgtype.Timestamptz{Time: now, Valid: true},
					Status:       "PENDING",
				},
			},
		}),
	}

	ctx := context.WithValue(context.Background(), UserIDKey, callerID)

	// Try completing a reminder owned by someone else
	_, err := service.CompleteReminder(ctx, connect.NewRequest(&pb.CompleteReminderRequest{Id: reminderID}))
	if err == nil {
		t.Fatal("expected not found error")
	}
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("code = %v, want %v", connect.CodeOf(err), connect.CodeNotFound)
	}
}

func TestListReminders(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	now := time.Now().UTC()

	service := &ReminderService{
		DB: db.New(reminderServiceDBTX{
			reminders: []db.Reminder{
				{
					ID:           StringToUUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
					UserID:       StringToUUID(userID),
					Title:        "Pending Bill",
					ReminderType: "BILL_DUE",
					DueAt:        pgtype.Timestamptz{Time: now.Add(24 * time.Hour), Valid: true},
					Status:       "PENDING",
				},
				{
					ID:           StringToUUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
					UserID:       StringToUUID(userID),
					Title:        "Completed Goal",
					ReminderType: "GOAL_CONTRIBUTION",
					DueAt:        pgtype.Timestamptz{Time: now.Add(-24 * time.Hour), Valid: true},
					Status:       "COMPLETED",
				},
			},
		}),
	}

	ctx := context.WithValue(context.Background(), UserIDKey, userID)

	// Test full list
	res, err := service.ListReminders(ctx, connect.NewRequest(&pb.ListRemindersRequest{}))
	if err != nil {
		t.Fatalf("ListReminders() error = %v", err)
	}
	if len(res.Msg.Reminders) != 2 {
		t.Fatalf("list length = %d, want 2", len(res.Msg.Reminders))
	}

	// Test filtered list
	statusFilter := "PENDING"
	resFiltered, err := service.ListReminders(ctx, connect.NewRequest(&pb.ListRemindersRequest{Status: &statusFilter}))
	if err != nil {
		t.Fatalf("ListReminders() error = %v", err)
	}
	if len(resFiltered.Msg.Reminders) != 1 {
		t.Fatalf("filtered list length = %d, want 1", len(resFiltered.Msg.Reminders))
	}
	if resFiltered.Msg.Reminders[0].Status != "PENDING" {
		t.Fatalf("expected PENDING status")
	}
}

type reminderServiceDBTX struct {
	reminders []db.Reminder
}

func (f reminderServiceDBTX) Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, errors.New("not implemented")
}

func (f reminderServiceDBTX) QueryRow(_ context.Context, sql string, args ...interface{}) pgx.Row {
	if strings.Contains(sql, "CompleteReminder") || strings.Contains(sql, "DismissReminder") || strings.Contains(sql, "SnoozeReminder") || strings.Contains(sql, "GetReminder") {
		id := args[0].(pgtype.UUID)
		userID := args[1].(pgtype.UUID)
		for _, r := range f.reminders {
			if UUIDToString(r.ID) == UUIDToString(id) && UUIDToString(r.UserID) == UUIDToString(userID) {
				return fakeDBRow{values: reminderRowValues(r)}
			}
		}
		return fakeDBRow{err: pgx.ErrNoRows}
	}
	if strings.Contains(sql, "CreateReminder") {
		// Mock creation by returning a valid row
		now := time.Now().UTC()
		return fakeDBRow{values: reminderRowValues(db.Reminder{
			ID:           StringToUUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
			UserID:       args[0].(pgtype.UUID),
			Title:        args[1].(string),
			ReminderType: args[3].(string),
			DueAt:        args[4].(pgtype.Timestamptz),
			Status:       "PENDING",
			CreatedAt:    pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:    pgtype.Timestamptz{Time: now, Valid: true},
		})}
	}

	return fakeDBRow{err: errors.New("unexpected query")}
}

func (f reminderServiceDBTX) Query(_ context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	if !strings.Contains(sql, "ListReminders") && !strings.Contains(sql, "ListUpcomingReminders") {
		return nil, errors.New("unexpected query")
	}

	userID := args[0].(pgtype.UUID)

	filtered := make([]db.Reminder, 0)
	for _, r := range f.reminders {
		if UUIDToString(r.UserID) == UUIDToString(userID) {
			filtered = append(filtered, r)
		}
	}

	rows := make([][]any, 0, len(filtered))
	for _, r := range filtered {
		rows = append(rows, reminderRowValues(r))
	}
	return &fakeDBRows{rows: rows}, nil
}

func (f reminderServiceDBTX) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	return 0, errors.New("not implemented")
}

func reminderRowValues(r db.Reminder) []any {
	return []any{
		r.ID,
		r.UserID,
		r.Title,
		r.Description,
		r.ReminderType,
		r.Status,
		r.DueAt,
		r.SnoozedUntil,
		r.CompletedAt,
		r.DismissedAt,
		r.LinkedEntityType,
		r.LinkedEntityID,
		r.ChannelEmail,
		r.ChannelPush,
		r.ChannelInApp,
		r.CreatedAt,
		r.UpdatedAt,
	}
}
