package api

import (
	"context"

	"connectrpc.com/connect"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type ReminderService struct {
	DB *db.Queries
}

func (s *ReminderService) CreateReminder(ctx context.Context, req *connect.Request[pb.CreateReminderRequest]) (*connect.Response[pb.CreateReminderResponse], error) {
	return connect.NewResponse(&pb.CreateReminderResponse{
		Reminder: &pb.Reminder{
			Id:          "mock-reminder-id",
			Title:       req.Msg.Title,
			Description: req.Msg.Description,
			Type:        req.Msg.Type,
			DueDate:     req.Msg.DueDate,
			Status:      "PENDING",
		},
	}), nil
}

func (s *ReminderService) ListReminders(ctx context.Context, req *connect.Request[pb.ListRemindersRequest]) (*connect.Response[pb.ListRemindersResponse], error) {
	return connect.NewResponse(&pb.ListRemindersResponse{
		Reminders: []*pb.Reminder{},
	}), nil
}

func (s *ReminderService) UpdateReminder(ctx context.Context, req *connect.Request[pb.UpdateReminderRequest]) (*connect.Response[pb.UpdateReminderResponse], error) {
	return connect.NewResponse(&pb.UpdateReminderResponse{
		Reminder: &pb.Reminder{
			Id: req.Msg.Id,
		},
	}), nil
}

func (s *ReminderService) DeleteReminder(ctx context.Context, req *connect.Request[pb.DeleteReminderRequest]) (*connect.Response[pb.DeleteReminderResponse], error) {
	return connect.NewResponse(&pb.DeleteReminderResponse{}), nil
}

func (s *ReminderService) CompleteReminder(ctx context.Context, req *connect.Request[pb.CompleteReminderRequest]) (*connect.Response[pb.CompleteReminderResponse], error) {
	return connect.NewResponse(&pb.CompleteReminderResponse{
		Reminder: &pb.Reminder{
			Id:     req.Msg.Id,
			Status: "COMPLETED",
		},
	}), nil
}

func (s *ReminderService) SnoozeReminder(ctx context.Context, req *connect.Request[pb.SnoozeReminderRequest]) (*connect.Response[pb.SnoozeReminderResponse], error) {
	return connect.NewResponse(&pb.SnoozeReminderResponse{
		Reminder: &pb.Reminder{
			Id:          req.Msg.Id,
			Status:      "SNOOZED",
			SnoozeUntil: req.Msg.Until,
		},
	}), nil
}

func (s *ReminderService) DismissReminder(ctx context.Context, req *connect.Request[pb.DismissReminderRequest]) (*connect.Response[pb.DismissReminderResponse], error) {
	return connect.NewResponse(&pb.DismissReminderResponse{
		Reminder: &pb.Reminder{
			Id:     req.Msg.Id,
			Status: "DISMISSED",
		},
	}), nil
}
