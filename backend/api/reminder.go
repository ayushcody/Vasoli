package api

import (
	"context"
	"errors"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

var validReminderTypes = map[string]struct{}{
	"BILL_DUE":          {},
	"GOAL_CONTRIBUTION": {},
	"RECEIPT_RETURN":    {},
	"WARRANTY_EXPIRY":   {},
	"REIMBURSEMENT":     {},
	"CUSTOM":            {},
}

type ReminderService struct {
	DB   *db.Queries
	Pool *pgxpool.Pool
}

func (s *ReminderService) CreateReminder(ctx context.Context, req *connect.Request[pb.CreateReminderRequest]) (*connect.Response[pb.CreateReminderResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	title := strings.TrimSpace(req.Msg.Title)
	if title == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("title is required"))
	}

	if req.Msg.DueDate == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("due_date is required"))
	}

	reminderType := strings.ToUpper(strings.TrimSpace(req.Msg.Type))
	if _, ok := validReminderTypes[reminderType]; !ok {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("invalid reminder type"))
	}

	reminder, err := s.DB.CreateReminder(ctx, db.CreateReminderParams{
		UserID:       userUUID,
		Title:        title,
		Description:  optionalText(req.Msg.Description),
		ReminderType: reminderType,
		DueAt:        pgtype.Timestamptz{Time: req.Msg.DueDate.AsTime().UTC(), Valid: true},
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.CreateReminderResponse{
		Reminder: mapReminder(reminder),
	}), nil
}

func (s *ReminderService) ListReminders(ctx context.Context, req *connect.Request[pb.ListRemindersRequest]) (*connect.Response[pb.ListRemindersResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var reminders []db.Reminder

	if req.Msg.Upcoming != nil && *req.Msg.Upcoming {
		now := time.Now().UTC()
		horizon := now.AddDate(0, 0, 30) // Show next 30 days of upcoming reminders
		r, err := s.DB.ListUpcomingReminders(ctx, db.ListUpcomingRemindersParams{
			UserID: userUUID,
			DueAt:  pgtype.Timestamptz{Time: horizon, Valid: true},
		})
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		reminders = r
	} else {
		r, err := s.DB.ListReminders(ctx, userUUID)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		reminders = r
	}

	// Filter by status if provided
	targetStatus := ""
	if req.Msg.Status != nil && *req.Msg.Status != "" {
		targetStatus = strings.ToUpper(*req.Msg.Status)
	}

	items := make([]*pb.Reminder, 0, len(reminders))
	for _, r := range reminders {
		if targetStatus != "" && r.Status != targetStatus {
			continue
		}
		items = append(items, mapReminder(r))
	}

	return connect.NewResponse(&pb.ListRemindersResponse{
		Reminders: items,
	}), nil
}

func (s *ReminderService) UpdateReminder(ctx context.Context, req *connect.Request[pb.UpdateReminderRequest]) (*connect.Response[pb.UpdateReminderResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	reminderUUID, err := parseUUID(req.Msg.Id, "reminder id")
	if err != nil {
		return nil, err
	}

	_, err = s.DB.GetReminder(ctx, db.GetReminderParams{
		ID:     reminderUUID,
		UserID: userUUID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("reminder not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	params := db.UpdateReminderParams{
		ID:     reminderUUID,
		UserID: userUUID,
	}

	if req.Msg.Title != nil {
		title := strings.TrimSpace(*req.Msg.Title)
		if title == "" {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("title cannot be empty"))
		}
		params.Title = pgtype.Text{String: title, Valid: true}
	}
	if req.Msg.Description != nil {
		params.Description = pgtype.Text{String: *req.Msg.Description, Valid: true}
	}
	if req.Msg.DueDate != nil {
		params.DueAt = pgtype.Timestamptz{Time: req.Msg.DueDate.AsTime().UTC(), Valid: true}
	}

	updated, err := s.DB.UpdateReminder(ctx, params)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UpdateReminderResponse{
		Reminder: mapReminder(updated),
	}), nil
}

func (s *ReminderService) DeleteReminder(ctx context.Context, req *connect.Request[pb.DeleteReminderRequest]) (*connect.Response[pb.DeleteReminderResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	reminderUUID, err := parseUUID(req.Msg.Id, "reminder id")
	if err != nil {
		return nil, err
	}

	err = s.DB.DeleteReminder(ctx, db.DeleteReminderParams{
		ID:     reminderUUID,
		UserID: userUUID,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.DeleteReminderResponse{}), nil
}

func (s *ReminderService) CompleteReminder(ctx context.Context, req *connect.Request[pb.CompleteReminderRequest]) (*connect.Response[pb.CompleteReminderResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	reminderUUID, err := parseUUID(req.Msg.Id, "reminder id")
	if err != nil {
		return nil, err
	}

	updated, err := s.DB.CompleteReminder(ctx, db.CompleteReminderParams{
		ID:     reminderUUID,
		UserID: userUUID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("reminder not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.CompleteReminderResponse{
		Reminder: mapReminder(updated),
	}), nil
}

func (s *ReminderService) SnoozeReminder(ctx context.Context, req *connect.Request[pb.SnoozeReminderRequest]) (*connect.Response[pb.SnoozeReminderResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	reminderUUID, err := parseUUID(req.Msg.Id, "reminder id")
	if err != nil {
		return nil, err
	}

	if req.Msg.Until == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("snooze until date is required"))
	}

	updated, err := s.DB.SnoozeReminder(ctx, db.SnoozeReminderParams{
		ID:           reminderUUID,
		UserID:       userUUID,
		SnoozedUntil: pgtype.Timestamptz{Time: req.Msg.Until.AsTime().UTC(), Valid: true},
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("reminder not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.SnoozeReminderResponse{
		Reminder: mapReminder(updated),
	}), nil
}

func (s *ReminderService) DismissReminder(ctx context.Context, req *connect.Request[pb.DismissReminderRequest]) (*connect.Response[pb.DismissReminderResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	reminderUUID, err := parseUUID(req.Msg.Id, "reminder id")
	if err != nil {
		return nil, err
	}

	updated, err := s.DB.DismissReminder(ctx, db.DismissReminderParams{
		ID:     reminderUUID,
		UserID: userUUID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("reminder not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.DismissReminderResponse{
		Reminder: mapReminder(updated),
	}), nil
}

func mapReminder(reminder db.Reminder) *pb.Reminder {
	mapped := &pb.Reminder{
		Id:        UUIDToString(reminder.ID),
		UserId:    UUIDToString(reminder.UserID),
		Title:     reminder.Title,
		Type:      reminder.ReminderType,
		Status:    reminder.Status,
		DueDate:   timestamppb.New(reminder.DueAt.Time),
		CreatedAt: timestamppb.New(reminder.CreatedAt.Time),
		UpdatedAt: timestamppb.New(reminder.UpdatedAt.Time),
	}

	if reminder.Description.Valid {
		mapped.Description = &reminder.Description.String
	}
	if reminder.SnoozedUntil.Valid {
		mapped.SnoozeUntil = timestamppb.New(reminder.SnoozedUntil.Time)
	}

	return mapped
}
