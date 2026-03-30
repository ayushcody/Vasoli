package api

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

var validRecurringCadences = map[string]struct{}{
	"daily":     {},
	"weekly":    {},
	"biweekly":  {},
	"monthly":   {},
	"quarterly": {},
	"yearly":    {},
}

var validRecurringTypes = map[string]struct{}{
	"EXPENSE": {},
	"INCOME":  {},
}

type RecurringService struct {
	DB *db.Queries
}

func (s *RecurringService) ListCandidates(ctx context.Context, req *connect.Request[pb.ListCandidatesRequest]) (*connect.Response[pb.ListCandidatesResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("not yet implemented"))
}

func (s *RecurringService) CreateRuleFromCandidate(ctx context.Context, req *connect.Request[pb.CreateRuleFromCandidateRequest]) (*connect.Response[pb.CreateRuleFromCandidateResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}
	if req.Msg.NextDueDate == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("next_due_date is required"))
	}

	cadence, err := normalizeRecurringCadence(req.Msg.Cadence)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	ruleType, err := normalizeRecurringType(req.Msg.GetType())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	if req.Msg.AmountPaise <= 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("amount must be greater than zero"))
	}

	categoryID, err := optionalRuleCategoryID(req.Msg.CategoryId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	rule, err := s.DB.CreateRecurringRule(ctx, db.CreateRecurringRuleParams{
		UserID:       userUUID,
		MerchantNorm: req.Msg.MerchantNorm,
		AmountPaise:  req.Msg.AmountPaise,
		Type:         ruleType,
		Cadence:      cadence,
		NextDueDate:  pgtype.Timestamptz{Time: req.Msg.NextDueDate.AsTime().UTC(), Valid: true},
		Active:       true,
		CategoryID:   categoryID,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.CreateRuleFromCandidateResponse{
		Rule: mapRecurringRule(rule, nil),
	}), nil
}

func (s *RecurringService) ListRules(ctx context.Context, req *connect.Request[pb.ListRecurringRulesRequest]) (*connect.Response[pb.ListRecurringRulesResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	rules, err := s.DB.ListRecurringRules(ctx, userUUID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	now := time.Now().UTC()
	items := make([]*pb.RecurringRule, 0, len(rules))
	for _, rule := range rules {
		nextDue := computedRuleDueDate(rule, now)
		items = append(items, mapRecurringRule(rule, nextDue))
	}

	return connect.NewResponse(&pb.ListRecurringRulesResponse{
		Rules: items,
	}), nil
}

func (s *RecurringService) GetRule(ctx context.Context, req *connect.Request[pb.GetRuleRequest]) (*connect.Response[pb.GetRuleResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	ruleUUID, err := parseUUID(req.Msg.Id, "rule id")
	if err != nil {
		return nil, err
	}

	rule, err := s.DB.GetRecurringRule(ctx, db.GetRecurringRuleParams{
		ID:     ruleUUID,
		UserID: userUUID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("recurring rule not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	nextDue := computedRuleDueDate(rule, time.Now().UTC())
	return connect.NewResponse(&pb.GetRuleResponse{
		Rule: mapRecurringRule(rule, nextDue),
	}), nil
}

func (s *RecurringService) UpdateRule(ctx context.Context, req *connect.Request[pb.UpdateRuleRequest]) (*connect.Response[pb.UpdateRuleResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	ruleUUID, err := parseUUID(req.Msg.Id, "rule id")
	if err != nil {
		return nil, err
	}

	if req.Msg.AmountPaise != nil && req.Msg.GetAmountPaise() <= 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("amount must be greater than zero"))
	}

	cadence := pgtype.Text{}
	if req.Msg.Cadence != nil {
		normalizedCadence, err := normalizeRecurringCadence(req.Msg.GetCadence())
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		cadence = pgtype.Text{String: normalizedCadence, Valid: true}
	}

	ruleType := pgtype.Text{}
	if req.Msg.Type != nil {
		normalizedType, err := normalizeRecurringType(req.Msg.GetType())
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		ruleType = pgtype.Text{String: normalizedType, Valid: true}
	}

	categoryID, err := optionalRuleCategoryID(req.Msg.CategoryId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	rule, err := s.DB.UpdateRecurringRule(ctx, db.UpdateRecurringRuleParams{
		ID:           ruleUUID,
		UserID:       userUUID,
		MerchantNorm: optionalText(req.Msg.MerchantNorm),
		AmountPaise:  optionalInt8(req.Msg.AmountPaise),
		Type:         ruleType,
		Cadence:      cadence,
		NextDueDate:  optionalTimestampValue(req.Msg.NextDueDate),
		CategoryID:   categoryID,
		Active:       optionalBool(req.Msg.Active),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("recurring rule not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	nextDue := computedRuleDueDate(rule, time.Now().UTC())
	return connect.NewResponse(&pb.UpdateRuleResponse{
		Rule: mapRecurringRule(rule, nextDue),
	}), nil
}

func (s *RecurringService) DeleteRule(ctx context.Context, req *connect.Request[pb.DeleteRuleRequest]) (*connect.Response[pb.DeleteRuleResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	ruleUUID, err := parseUUID(req.Msg.Id, "rule id")
	if err != nil {
		return nil, err
	}

	if _, err := s.DB.GetRecurringRule(ctx, db.GetRecurringRuleParams{
		ID:     ruleUUID,
		UserID: userUUID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("recurring rule not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if err := s.DB.DeleteRecurringRule(ctx, db.DeleteRecurringRuleParams{
		ID:     ruleUUID,
		UserID: userUUID,
	}); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.DeleteRuleResponse{}), nil
}

func (s *RecurringService) ListUpcoming(ctx context.Context, req *connect.Request[pb.ListUpcomingRequest]) (*connect.Response[pb.ListUpcomingResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	daysAhead := req.Msg.DaysAhead
	if daysAhead <= 0 {
		daysAhead = 30
	}

	now := time.Now().UTC()
	horizon := now.AddDate(0, 0, int(daysAhead))
	rules, err := s.DB.ListUpcomingRecurringRules(ctx, db.ListUpcomingRecurringRulesParams{
		UserID:      userUUID,
		NextDueDate: pgtype.Timestamptz{Time: horizon, Valid: true},
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	items := make([]*pb.RecurringRule, 0)
	for _, rule := range rules {
		occurrences := expandRecurringOccurrences(rule, now, horizon)
		for _, occurrence := range occurrences {
			items = append(items, mapRecurringRule(rule, &occurrence))
		}
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].GetNextDueDate().AsTime().Before(items[j].GetNextDueDate().AsTime())
	})

	return connect.NewResponse(&pb.ListUpcomingResponse{
		Rules: items,
	}), nil
}

func (s *RecurringService) SnoozeRule(ctx context.Context, req *connect.Request[pb.SnoozeRuleRequest]) (*connect.Response[pb.SnoozeRuleResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}
	if req.Msg.UntilDate == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("until_date is required"))
	}

	ruleUUID, err := parseUUID(req.Msg.RuleId, "rule id")
	if err != nil {
		return nil, err
	}

	rule, err := s.DB.UpdateRecurringRule(ctx, db.UpdateRecurringRuleParams{
		ID:           ruleUUID,
		UserID:       userUUID,
		SnoozedUntil: pgtype.Timestamptz{Time: req.Msg.UntilDate.AsTime().UTC(), Valid: true},
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("recurring rule not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	nextDue := computedRuleDueDate(rule, time.Now().UTC())
	return connect.NewResponse(&pb.SnoozeRuleResponse{
		Rule: mapRecurringRule(rule, nextDue),
	}), nil
}

func (s *RecurringService) CancelRule(ctx context.Context, req *connect.Request[pb.CancelRuleRequest]) (*connect.Response[pb.CancelRuleResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	ruleUUID, err := parseUUID(req.Msg.RuleId, "rule id")
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	rule, err := s.DB.UpdateRecurringRule(ctx, db.UpdateRecurringRuleParams{
		ID:          ruleUUID,
		UserID:      userUUID,
		CancelledAt: pgtype.Timestamptz{Time: now, Valid: true},
		Active:      pgtype.Bool{Bool: false, Valid: true},
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("recurring rule not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.CancelRuleResponse{
		Rule: mapRecurringRule(rule, nil),
	}), nil
}

func mapRecurringRule(rule db.RecurringRule, nextDue *time.Time) *pb.RecurringRule {
	mapped := &pb.RecurringRule{
		Id:           UUIDToString(rule.ID),
		UserId:       UUIDToString(rule.UserID),
		MerchantNorm: rule.MerchantNorm,
		AmountPaise:  rule.AmountPaise,
		Type:         rule.Type,
		Cadence:      rule.Cadence,
		Active:       rule.Active,
	}

	dueDate := rule.NextDueDate.Time
	if nextDue != nil {
		dueDate = nextDue.UTC()
	}
	if !dueDate.IsZero() {
		mapped.NextDueDate = timestamppb.New(dueDate)
	}
	if rule.SnoozedUntil.Valid {
		mapped.SnoozedUntil = timestamppb.New(rule.SnoozedUntil.Time)
	}
	if rule.CancelledAt.Valid {
		mapped.CancelledAt = timestamppb.New(rule.CancelledAt.Time)
	}
	if categoryID := UUIDToString(rule.CategoryID); categoryID != "" {
		mapped.CategoryId = &categoryID
	}

	return mapped
}

func normalizeRecurringCadence(value string) (string, error) {
	cadence := strings.ToLower(strings.TrimSpace(value))
	if _, ok := validRecurringCadences[cadence]; !ok {
		return "", errors.New("cadence must be one of daily, weekly, biweekly, monthly, quarterly, or yearly")
	}
	return cadence, nil
}

func normalizeRecurringType(value string) (string, error) {
	recurringType := strings.ToUpper(strings.TrimSpace(value))
	if recurringType == "" {
		recurringType = "EXPENSE"
	}
	if _, ok := validRecurringTypes[recurringType]; !ok {
		return "", errors.New("type must be either EXPENSE or INCOME")
	}
	return recurringType, nil
}

func optionalRuleCategoryID(value *string) (pgtype.UUID, error) {
	if value == nil || *value == "" {
		return pgtype.UUID{}, nil
	}
	return parseRawUUID(*value)
}

func computedRuleDueDate(rule db.RecurringRule, now time.Time) *time.Time {
	next := rule.NextDueDate.Time.UTC()
	if next.IsZero() {
		return nil
	}

	if rule.SnoozedUntil.Valid && rule.SnoozedUntil.Time.After(next) {
		next = rule.SnoozedUntil.Time.UTC()
	}

	for next.Before(startOfDay(now)) {
		next = advanceRecurringDate(next, rule.Cadence)
	}

	return &next
}

func expandRecurringOccurrences(rule db.RecurringRule, start time.Time, end time.Time) []time.Time {
	if !rule.Active || rule.CancelledAt.Valid {
		return nil
	}

	current := rule.NextDueDate.Time.UTC()
	if rule.SnoozedUntil.Valid && rule.SnoozedUntil.Time.After(current) {
		current = rule.SnoozedUntil.Time.UTC()
	}

	for current.Before(startOfDay(start)) {
		current = advanceRecurringDate(current, rule.Cadence)
	}

	occurrences := make([]time.Time, 0)
	for !current.After(end) {
		occurrences = append(occurrences, current)
		current = advanceRecurringDate(current, rule.Cadence)
	}
	return occurrences
}

func advanceRecurringDate(date time.Time, cadence string) time.Time {
	next := date
	switch cadence {
	case "daily":
		next = next.AddDate(0, 0, 1)
	case "weekly":
		next = next.AddDate(0, 0, 7)
	case "biweekly":
		next = next.AddDate(0, 0, 14)
	case "monthly":
		next = next.AddDate(0, 1, 0)
	case "quarterly":
		next = next.AddDate(0, 3, 0)
	case "yearly":
		next = next.AddDate(1, 0, 0)
	default:
		next = next.AddDate(0, 1, 0)
	}
	return next
}

func startOfDay(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}

func optionalBool(value *bool) pgtype.Bool {
	if value == nil {
		return pgtype.Bool{}
	}
	return pgtype.Bool{Bool: *value, Valid: true}
}
