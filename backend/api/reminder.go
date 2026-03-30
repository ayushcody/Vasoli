package api

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type ReminderService struct {
	DB *db.Queries
}

func (s *ReminderService) CreateReminder(ctx context.Context, req *connect.Request[pb.CreateReminderRequest]) (*connect.Response[pb.CreateReminderResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("not yet implemented"))
}

func (s *ReminderService) ListReminders(ctx context.Context, req *connect.Request[pb.ListRemindersRequest]) (*connect.Response[pb.ListRemindersResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("not yet implemented"))
}

func (s *ReminderService) UpdateReminder(ctx context.Context, req *connect.Request[pb.UpdateReminderRequest]) (*connect.Response[pb.UpdateReminderResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("not yet implemented"))
}

func (s *ReminderService) DeleteReminder(ctx context.Context, req *connect.Request[pb.DeleteReminderRequest]) (*connect.Response[pb.DeleteReminderResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("not yet implemented"))
}

func (s *ReminderService) CompleteReminder(ctx context.Context, req *connect.Request[pb.CompleteReminderRequest]) (*connect.Response[pb.CompleteReminderResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("not yet implemented"))
}

func (s *ReminderService) SnoozeReminder(ctx context.Context, req *connect.Request[pb.SnoozeReminderRequest]) (*connect.Response[pb.SnoozeReminderResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("not yet implemented"))
}

func (s *ReminderService) DismissReminder(ctx context.Context, req *connect.Request[pb.DismissReminderRequest]) (*connect.Response[pb.DismissReminderResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("not yet implemented"))
}
