package api

import (
	"context"
	"errors"
	"math"
	"sort"
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
	DB   *db.Queries
	Pool *pgxpool.Pool
}

func (s *RecurringService) ListCandidates(ctx context.Context, req *connect.Request[pb.ListCandidatesRequest]) (*connect.Response[pb.ListCandidatesResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	rows, err := s.DB.GetRecurringCandidates(ctx, userUUID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var candidates []*pb.RecurringCandidate

	for _, row := range rows {
		firstDate := row.FirstDate.Time
		lastDate := row.LastDate.Time

		if row.FOccurrenceCount < 3 {
			continue
		}

		diffDays := lastDate.Sub(firstDate).Hours() / 24.0
		avgIntervalDays := diffDays / float64(row.FOccurrenceCount-1)

		var inferredCadence string
		var cadencePenalty float64

		if avgIntervalDays >= 5.6 && avgIntervalDays <= 8.4 {
			inferredCadence = "weekly"
			cadencePenalty = math.Abs(avgIntervalDays-7) / 7.0
		} else if avgIntervalDays >= 11.2 && avgIntervalDays <= 16.8 {
			inferredCadence = "biweekly"
			cadencePenalty = math.Abs(avgIntervalDays-14) / 14.0
		} else if avgIntervalDays >= 24.0 && avgIntervalDays <= 36.0 {
			inferredCadence = "monthly"
			cadencePenalty = math.Abs(avgIntervalDays-30) / 30.0
		} else if avgIntervalDays >= 72.0 && avgIntervalDays <= 108.0 {
			inferredCadence = "quarterly"
			cadencePenalty = math.Abs(avgIntervalDays-90) / 90.0
		} else if avgIntervalDays >= 292.0 && avgIntervalDays <= 438.0 {
			inferredCadence = "yearly"
			cadencePenalty = math.Abs(avgIntervalDays-365) / 365.0
		} else {
			continue
		}

		amountPenalty := 0.0
		if row.AvgAmount > 0 {
			amountPenalty = row.StddevAmount / float64(row.AvgAmount)
		}

		confidenceScore := 100.0 - (amountPenalty * 100.0) - (cadencePenalty * 100.0)
		if confidenceScore < 0 {
			confidenceScore = 0
		} else if confidenceScore > 100 {
			confidenceScore = 100
		}

		if confidenceScore < 50.0 {
			continue
		}

		nextDueDate := advanceRecurringDate(lastDate, inferredCadence)

		candidates = append(candidates, &pb.RecurringCandidate{
			MerchantNorm:      row.MerchantNorm,
			AmountPaiseBucket: row.AvgAmount,
			InferredCadence:   inferredCadence,
			ConfidenceScore:   confidenceScore,
			SuggestedNextDue:  timestamppb.New(nextDueDate),
			OccurrenceCount:   row.FOccurrenceCount,
		})
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].ConfidenceScore > candidates[j].ConfidenceScore
	})

	return connect.NewResponse(&pb.ListCandidatesResponse{
		Candidates: candidates,
	}), nil
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
	if categoryID.Valid {
		if err = requireOwnedCategory(ctx, s.Pool, userUUID, categoryID); err != nil {
			if errors.Is(err, errCategoryNotOwned) {
				return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("category is not available to this user"))
			}
			return nil, connect.NewError(connect.CodeInternal, errors.New("internal system error"))
		}
	}
	accountID, err := optionalRuleAccountID(ctx, s.DB, userUUID, req.Msg.AccountId)
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
		AccountID:    accountID,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// Trigger achievement
	go func(u pgtype.UUID) {
		_ = awardAchievementIfEligible(context.Background(), s.DB, u, "SUB_SPOTTER")
	}(userUUID)

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
	if categoryID.Valid {
		if err = requireOwnedCategory(ctx, s.Pool, userUUID, categoryID); err != nil {
			if errors.Is(err, errCategoryNotOwned) {
				return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("category is not available to this user"))
			}
			return nil, connect.NewError(connect.CodeInternal, errors.New("internal system error"))
		}
	}
	accountID, err := optionalRuleAccountID(ctx, s.DB, userUUID, req.Msg.AccountId)
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
		AccountID:    accountID,
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
	if daysAhead > 366 {
		return nil, ErrorInvalidArgument("forecast horizon must not exceed 366 days")
	}
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
		if isMockMode() {
			return connect.NewResponse(&pb.ListUpcomingResponse{
				Rules: getMockRecurringRules(),
			}), nil
		}
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
	if accountID := UUIDToString(rule.AccountID); accountID != "" {
		mapped.AccountId = &accountID
	}

	return mapped
}

func optionalRuleAccountID(ctx context.Context, queries *db.Queries, userID pgtype.UUID, raw *string) (pgtype.UUID, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return pgtype.UUID{}, nil
	}
	id, err := parseRawUUID(strings.TrimSpace(*raw))
	if err != nil {
		return pgtype.UUID{}, errors.New("account_id must be a valid UUID")
	}
	if _, err := queries.GetFinancialAccount(ctx, db.GetFinancialAccountParams{ID: id, UserID: userID}); err != nil {
		return pgtype.UUID{}, errors.New("account not found")
	}
	return id, nil
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
	if rule.NextDueDate.Time.IsZero() {
		return nil
	}
	anchor := indiaCalendarAsUTC(rule.NextDueDate.Time)

	lowerBound := indiaCalendarAsUTC(now)
	if rule.SnoozedUntil.Valid && indiaCalendarAsUTC(rule.SnoozedUntil.Time).After(lowerBound) {
		lowerBound = indiaCalendarAsUTC(rule.SnoozedUntil.Time)
	}
	index := recurringIndexAtOrAfter(anchor, rule.Cadence, lowerBound)
	next := recurringDateAt(anchor, rule.Cadence, index)
	result := indiaCalendarFromUTC(next)
	return &result
}

func expandRecurringOccurrences(rule db.RecurringRule, start time.Time, end time.Time) []time.Time {
	if !rule.Active || rule.CancelledAt.Valid {
		return nil
	}

	if rule.NextDueDate.Time.IsZero() {
		return nil
	}
	anchor := indiaCalendarAsUTC(rule.NextDueDate.Time)
	end = indiaCalendarAsUTC(end)
	lowerBound := indiaCalendarAsUTC(start)
	if rule.SnoozedUntil.Valid && indiaCalendarAsUTC(rule.SnoozedUntil.Time).After(lowerBound) {
		lowerBound = indiaCalendarAsUTC(rule.SnoozedUntil.Time)
	}
	index := recurringIndexAtOrAfter(anchor, rule.Cadence, lowerBound)
	current := recurringDateAt(anchor, rule.Cadence, index)

	occurrences := make([]time.Time, 0)
	for !current.After(end) {
		occurrences = append(occurrences, indiaCalendarFromUTC(current))
		index++
		current = recurringDateAt(anchor, rule.Cadence, index)
	}
	return occurrences
}

// Recurring rules are calendar dates in India. PostgreSQL timestamptz stores
// instants, so normalize their India-local date/time to a UTC calendar carrier
// while expanding, then map occurrences back to India-local timestamps.
func indiaCalendarAsUTC(value time.Time) time.Time {
	local := value.In(indiaLocation)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
}

func indiaCalendarFromUTC(value time.Time) time.Time {
	local := value.UTC()
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, indiaLocation)
}

func recurringOccurrenceOnIndiaDate(rule db.RecurringRule, occurrence time.Time) bool {
	if !rule.Active || rule.CancelledAt.Valid || rule.NextDueDate.Time.IsZero() {
		return false
	}
	anchor := indiaCalendarAsUTC(rule.NextDueDate.Time)
	target := indiaCalendarAsUTC(occurrence)
	if rule.SnoozedUntil.Valid && target.Before(indiaCalendarAsUTC(rule.SnoozedUntil.Time)) {
		return false
	}
	index := recurringIndexAtOrAfter(anchor, rule.Cadence, target)
	return recurringDateAt(anchor, rule.Cadence, index).Equal(target)
}

func recurringDateMatchesIndia(anchor time.Time, cadence string, snoozed pgtype.Timestamptz, occurrence time.Time) bool {
	if anchor.IsZero() {
		return false
	}
	anchorDate := indiaCalendarAsUTC(anchor)
	target := indiaCalendarAsUTC(occurrence)
	if snoozed.Valid && target.Before(indiaCalendarAsUTC(snoozed.Time)) {
		return false
	}
	index := recurringIndexAtOrAfter(anchorDate, cadence, target)
	return recurringDateAt(anchorDate, cadence, index).Equal(target)
}

func advanceRecurringDate(date time.Time, cadence string) time.Time {
	return recurringDateAt(date.UTC(), cadence, 1)
}

func recurringDateAt(anchor time.Time, cadence string, index int) time.Time {
	anchor = anchor.UTC()
	if index < 0 {
		index = 0
	}
	switch cadence {
	case "daily":
		return anchor.AddDate(0, 0, index)
	case "weekly":
		return anchor.AddDate(0, 0, index*7)
	case "biweekly":
		return anchor.AddDate(0, 0, index*14)
	case "monthly":
		return anchoredMonthDate(anchor, index)
	case "quarterly":
		return anchoredMonthDate(anchor, index*3)
	case "yearly":
		return anchoredMonthDate(anchor, index*12)
	default:
		return anchoredMonthDate(anchor, index)
	}
}

func anchoredMonthDate(anchor time.Time, monthOffset int) time.Time {
	monthStart := time.Date(anchor.Year(), anchor.Month(), 1, anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC).AddDate(0, monthOffset, 0)
	lastDay := time.Date(monthStart.Year(), monthStart.Month()+1, 0, 0, 0, 0, 0, time.UTC).Day()
	day := anchor.Day()
	if day > lastDay {
		day = lastDay
	}
	return time.Date(monthStart.Year(), monthStart.Month(), day, anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC)
}

func recurringIndexAtOrAfter(anchor time.Time, cadence string, lowerBound time.Time) int {
	anchor = anchor.UTC()
	lowerBound = lowerBound.UTC()
	if !lowerBound.After(anchor) {
		return 0
	}

	index := 0
	switch cadence {
	case "daily", "weekly", "biweekly":
		stepDays := 1
		if cadence == "weekly" {
			stepDays = 7
		} else if cadence == "biweekly" {
			stepDays = 14
		}
		days := int(startOfDay(lowerBound).Sub(startOfDay(anchor)).Hours() / 24)
		index = days / stepDays
	case "monthly", "quarterly", "yearly":
		stepMonths := 1
		if cadence == "quarterly" {
			stepMonths = 3
		} else if cadence == "yearly" {
			stepMonths = 12
		}
		months := (lowerBound.Year()-anchor.Year())*12 + int(lowerBound.Month()-anchor.Month())
		index = months / stepMonths
	}
	for recurringDateAt(anchor, cadence, index).Before(lowerBound) {
		index++
	}
	for index > 0 && !recurringDateAt(anchor, cadence, index-1).Before(lowerBound) {
		index--
	}
	return index
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
