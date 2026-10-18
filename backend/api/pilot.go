package api

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
	"vasoli-backend/internal/payday"
)

type PilotService struct {
	Pool *pgxpool.Pool
	DB   *db.Queries
}

var indiaLocation = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		return time.FixedZone("Asia/Kolkata", 5*60*60+30*60)
	}
	return loc
}()

func indiaNow() time.Time { return time.Now().In(indiaLocation) }
func parseIndiaDate(value string) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", value, indiaLocation)
}
func validNextPayday(next, today time.Time) bool {
	d := indiaDayStart(next)
	start := indiaDayStart(today)
	return !d.Before(start) && !d.After(start.AddDate(0, 0, 366))
}
func transactionFlowIsIncome(typ, direction string) bool {
	return typ == "INCOME" || typ == "REFUND" || (typ == "TRANSFER" && direction == "IN")
}
func indiaDayStart(value time.Time) time.Time {
	y, m, d := value.In(indiaLocation).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, indiaLocation)
}

func (s *PilotService) GetPaydayPlan(ctx context.Context, req *connect.Request[pb.GetPaydayPlanRequest]) (*connect.Response[pb.GetPaydayPlanResponse], error) {
	user, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}
	if s.Pool == nil {
		return nil, ErrorInternal("payday plan is unavailable")
	}
	if req.Msg.ScenarioExtraOutflowPaise < 0 || req.Msg.ScenarioExtraOutflowPaise > 1_000_000_000_000_000 {
		return nil, ErrorInvalidArgument("scenario extra outflow is outside the supported range")
	}
	config := &pb.PaydayPlanConfig{}
	var payingIDs []pgtype.UUID
	var goalID pgtype.UUID
	err = s.Pool.QueryRow(ctx, `SELECT daily_allowance_paise,next_payday::text,minimum_reserve_paise,selected_goal_id,goal_reserved_paise,paying_account_ids FROM payday_plans WHERE user_id=$1`, user).Scan(&config.DailyAllowancePaise, &config.NextPayday, &config.MinimumReservePaise, &goalID, &config.GoalReservedPaise, &payingIDs)
	configured := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrorInternal("internal system error")
	}
	if goalID.Valid {
		id := UUIDToString(goalID)
		config.SelectedGoalId = &id
	}
	accounts := make([]*pb.AccountForecast, 0, len(payingIDs))
	engineAccounts := make([]payday.Account, 0, len(payingIDs))
	var stale bool
	forecastByAccount := make(map[string]*pb.AccountForecast, len(payingIDs))
	for _, id := range payingIDs {
		account, err := s.DB.GetFinancialAccount(ctx, db.GetFinancialAccountParams{ID: id, UserID: user})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				continue
			}
			return nil, ErrorInternal("internal system error")
		}
		config.PayingAccountIds = append(config.PayingAccountIds, UUIDToString(id))
		forecast := &pb.AccountForecast{AccountId: UUIDToString(account.ID), AccountName: account.AccountName, ConfirmedBalancePaise: account.BalancePaise, ProjectedBalancePaise: account.BalancePaise}
		if account.BalanceAsOf.Valid {
			forecast.BalanceAsOf = timestamppb.New(account.BalanceAsOf.Time)
			if time.Since(account.BalanceAsOf.Time) > 7*24*time.Hour || account.BalanceAsOf.Time.After(time.Now().Add(time.Minute)) {
				stale = true
			}
		} else {
			stale = true
		}
		accounts = append(accounts, forecast)
		forecastByAccount[forecast.AccountId] = forecast
		engineAccounts = append(engineAccounts, payday.Account{ID: forecast.AccountId, BalancePaise: account.BalancePaise})
	}
	warnings := make([]*pb.PaydayWarning, 0)
	if !configured {
		warnings = append(warnings, &pb.PaydayWarning{Code: "PLAN_NOT_CONFIGURED", Message: "Set your payday and daily allowance to build a personal plan."})
	}
	if len(accounts) == 0 {
		warnings = append(warnings, &pb.PaydayWarning{Code: "NO_PAYING_ACCOUNTS", Message: "Choose at least one account with a confirmed balance to build a payday plan."})
	}
	if stale {
		warnings = append(warnings, &pb.PaydayWarning{Code: "STALE_BALANCE", Message: "Confirm account balances updated within the last 7 days before relying on this forecast."})
	}
	obligationCutoff := indiaDayStart(indiaNow().AddDate(0, 0, 366))
	if configured {
		var e error
		obligationCutoff, e = parseIndiaDate(config.NextPayday)
		if e != nil {
			return nil, ErrorInternal("invalid saved payday")
		}
	}
	var unassignedObligations int64
	if err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM recurring_rules WHERE user_id=$1 AND active=true AND cancelled_at IS NULL AND type='EXPENSE' AND account_id IS NULL AND next_due_date < $2`, user, obligationCutoff).Scan(&unassignedObligations); err != nil {
		return nil, ErrorInternal("internal system error")
	}
	if unassignedObligations > 0 {
		warnings = append(warnings, &pb.PaydayWarning{Code: "UNASSIGNED_OBLIGATIONS", Message: fmt.Sprintf("%d active expenses need an account assignment before the forecast is reliable.", unassignedObligations)})
	}
	var unassigned int64
	if err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM transactions WHERE user_id=$1 AND account_id IS NULL AND type IN ('INCOME','EXPENSE') AND date >= NOW()-INTERVAL '30 days'`, user).Scan(&unassigned); err != nil {
		return nil, ErrorInternal("internal system error")
	}
	if unassigned > 0 {
		warnings = append(warnings, &pb.PaydayWarning{Code: "UNASSIGNED_TRANSACTIONS", Message: fmt.Sprintf("%d recent transactions are not assigned to an account.", unassigned)})
	}
	var projection []payday.Day
	var pooledLowest int64
	var pooledFirstShortfall *string
	if configured {
		paydayDate, parseErr := parseIndiaDate(config.NextPayday)
		if parseErr != nil {
			return nil, ErrorInternal("invalid saved payday")
		}
		flows, adjustments, flowErr := s.loadPaydayFlows(ctx, user, payingIDs, indiaNow(), paydayDate)
		if req.Msg.ScenarioExtraOutflowPaise > 0 {
			flows = append(flows, payday.Flow{Date: indiaDayStart(indiaNow()), AmountPaise: req.Msg.ScenarioExtraOutflowPaise, Income: false})
		}
		if flowErr != nil {
			return nil, ErrorInternal("internal system error")
		}
		for i := range engineAccounts {
			delta := adjustments[engineAccounts[i].ID]
			if delta > 0 && engineAccounts[i].BalancePaise > int64(^uint64(0)>>1)-delta {
				return nil, ErrorInternal("account balance overflow")
			}
			if delta < 0 && engineAccounts[i].BalancePaise < -int64(^uint64(0)>>1)-1-delta {
				return nil, ErrorInternal("account balance overflow")
			}
			engineAccounts[i].BalancePaise += delta
			forecastByAccount[engineAccounts[i].ID].ProjectedBalancePaise = engineAccounts[i].BalancePaise
			forecastByAccount[engineAccounts[i].ID].LowestProjectedBalancePaise = engineAccounts[i].BalancePaise
		}
		projection, err = payday.Project(indiaNow(), payday.Config{DailyAllowancePaise: config.DailyAllowancePaise, MinimumReservePaise: config.MinimumReservePaise, GoalReservedPaise: config.GoalReservedPaise, NextPayday: paydayDate}, engineAccounts, flows)
		if err != nil {
			warnings = append(warnings, &pb.PaydayWarning{Code: "INVALID_PLAN", Message: "Update the payday date and plan amounts to continue."})
		}
	}
	days := make([]*pb.DayProjection, 0, len(projection))
	for _, day := range projection {
		dateText := day.Date.Format("2006-01-02")
		days = append(days, &pb.DayProjection{Date: dateText, OpeningBalancePaise: day.OpeningPaise, ExpectedIncomePaise: day.IncomePaise, ExpectedObligationsPaise: day.ObligationsPaise, DailyAllowancePaise: day.AllowancePaise, ClosingBalancePaise: day.ClosingPaise, SafeToSpendPaise: day.SafeToSpendPaise, ExpectedTransferInPaise: day.TransferInPaise, ExpectedTransferOutPaise: day.TransferOutPaise})
		for accountID, amount := range day.AccountClosingPaise {
			if forecast := forecastByAccount[accountID]; forecast != nil {
				if amount < forecast.LowestProjectedBalancePaise {
					forecast.LowestProjectedBalancePaise = amount
				}
				forecast.ProjectedBalancePaise = amount
				if forecast.FirstShortfallDate == nil && amount < 0 {
					d := dateText
					forecast.FirstShortfallDate = &d
				}
			}
		}
	}
	reconciliationRows, reconciliationErr := s.Pool.Query(ctx, `SELECT batch_id,reconciliation_difference_paise FROM import_commit_idempotency WHERE user_id=$1 AND reconciliation_difference_paise IS NOT NULL AND reconciliation_difference_paise<>0 ORDER BY created_at DESC LIMIT 10`, user)
	if reconciliationErr != nil {
		return nil, ErrorInternal("internal system error")
	}
	for reconciliationRows.Next() {
		var batchID pgtype.UUID
		var difference int64
		if e := reconciliationRows.Scan(&batchID, &difference); e != nil {
			reconciliationRows.Close()
			return nil, ErrorInternal("internal system error")
		}
		code := "IMPORT_RECONCILIATION_" + strings.ToUpper(strings.ReplaceAll(UUIDToString(batchID), "-", ""))
		warnings = append(warnings, &pb.PaydayWarning{Code: code, Message: fmt.Sprintf("Review statement reconciliation difference of %d paise.", difference)})
	}
	if e := reconciliationRows.Err(); e != nil {
		reconciliationRows.Close()
		return nil, ErrorInternal("internal system error")
	}
	reconciliationRows.Close()
	pooledLowest, pooledFirstShortfall, err = pooledForecastMinimum(projection, config.MinimumReservePaise, config.GoalReservedPaise)
	if err != nil {
		return nil, ErrorInternal("invalid saved payday reserve")
	}
	shortfallBlocked := false
	if pooledFirstShortfall != nil {
		warnings = append(warnings, &pb.PaydayWarning{Code: "POOLED_SHORTFALL", Message: "Projected balance falls below your reserve before payday."})
		shortfallBlocked = true
	}
	for _, forecast := range accounts {
		if forecast.FirstShortfallDate != nil {
			warnings = append(warnings, &pb.PaydayWarning{Code: "ACCOUNT_SHORTFALL_" + strings.ToUpper(strings.ReplaceAll(forecast.AccountId, "-", "")), Message: forecast.AccountName + " is projected to go below zero by " + *forecast.FirstShortfallDate + "."})
			shortfallBlocked = true
		}
	}

	actions := make([]*pb.PaydayAction, 0, len(warnings))
	for _, warning := range warnings {
		actionID := "payday:" + strings.ToLower(warning.Code)
		action := &pb.PaydayAction{ActionId: actionID, Title: warning.Code, Description: warning.Message, State: "OPEN"}
		var state string
		var snooze pgtype.Timestamptz
		if e := s.Pool.QueryRow(ctx, `SELECT state,snoozed_until FROM payday_action_states WHERE user_id=$1 AND action_id=$2`, user, actionID).Scan(&state, &snooze); e == nil {
			action.State = state
			if snooze.Valid {
				action.SnoozedUntil = timestamppb.New(snooze.Time)
			}
		}
		actions = append(actions, action)
	}
	return connect.NewResponse(&pb.GetPaydayPlanResponse{Config: config, Accounts: accounts, DayProjections: days, Warnings: warnings, Actionable: configured && len(accounts) > 0 && !stale && unassigned == 0 && unassignedObligations == 0 && !shortfallBlocked && err == nil, Actions: actions, LowestPooledBalancePaise: pooledLowest, FirstPooledShortfallDate: pooledFirstShortfall}), nil
}

func pooledForecastMinimum(days []payday.Day, reserve, goal int64) (int64, *string, error) {
	threshold, ok := checkedMoneyAdd(reserve, goal)
	if !ok {
		return 0, nil, errors.New("reserve exceeds supported range")
	}
	if len(days) == 0 {
		return 0, nil, nil
	}
	lowest := days[0].OpeningPaise
	var first *string
	if lowest < threshold {
		d := days[0].Date.Format("2006-01-02")
		first = &d
	}
	for _, day := range days {
		if day.ClosingPaise < lowest {
			lowest = day.ClosingPaise
		}
		if first == nil && day.ClosingPaise < threshold {
			d := day.Date.Format("2006-01-02")
			first = &d
		}
	}
	return lowest, first, nil
}

func (s *PilotService) loadPaydayFlows(ctx context.Context, user pgtype.UUID, accountIDs []pgtype.UUID, start, paydayDate time.Time) ([]payday.Flow, map[string]int64, error) {
	flows := make([]payday.Flow, 0)
	adjustments := make(map[string]int64)
	if len(accountIDs) == 0 {
		return flows, adjustments, nil
	}
	rows, err := s.Pool.Query(ctx, `SELECT t.account_id,t.date,t.amount_paise,t.type,COALESCE(t.transfer_direction,''),CASE WHEN t.type='TRANSFER' THEN EXISTS(SELECT 1 FROM transactions peer WHERE peer.user_id=t.user_id AND peer.transfer_group_id=t.transfer_group_id AND peer.id<>t.id AND peer.account_id=ANY($2::uuid[])) ELSE false END FROM transactions t JOIN financial_accounts a ON a.id=t.account_id AND a.user_id=t.user_id WHERE t.user_id=$1 AND t.account_id=ANY($2::uuid[]) AND t.status='POSTED' AND t.type IN ('INCOME','EXPENSE','REFUND','TRANSFER') AND a.balance_as_of IS NOT NULL AND t.date > a.balance_as_of AND t.date < $3`, user, accountIDs, paydayDate)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var accountID pgtype.UUID
		var date time.Time
		var amount int64
		var typ, transferDirection string
		var internalTransfer bool
		if err := rows.Scan(&accountID, &date, &amount, &typ, &transferDirection, &internalTransfer); err != nil {
			return nil, nil, err
		}
		id := UUIDToString(accountID)
		income := transactionFlowIsIncome(typ, transferDirection)
		if date.Before(indiaDayStart(start)) {
			delta := amount
			if !income {
				delta = -amount
			}
			next, ok := checkedMoneyAdd(adjustments[id], delta)
			if !ok {
				return nil, nil, errors.New("snapshot transaction delta overflow")
			}
			adjustments[id] = next
		} else {
			flows = append(flows, payday.Flow{Date: date.In(indiaLocation), AmountPaise: amount, Income: income, AccountID: id, Transfer: typ == "TRANSFER", InternalTransfer: internalTransfer})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	rules, err := s.DB.ListUpcomingRecurringRules(ctx, db.ListUpcomingRecurringRulesParams{UserID: user, NextDueDate: pgtype.Timestamptz{Time: paydayDate, Valid: true}})
	if err != nil {
		return nil, nil, err
	}
	selected := make(map[string]bool, len(accountIDs))
	for _, id := range accountIDs {
		selected[UUIDToString(id)] = true
	}
	paidRows, err := s.Pool.Query(ctx, `SELECT recurring_rule_id,occurrence_date::text FROM recurring_payments WHERE user_id=$1 AND occurrence_date >= $2::date AND occurrence_date < $3::date`, user, indiaDayStart(start).Format("2006-01-02"), indiaDayStart(paydayDate).Format("2006-01-02"))
	if err != nil {
		return nil, nil, err
	}
	paid := make(map[string]bool)
	for paidRows.Next() {
		var ruleID pgtype.UUID
		var occurrence string
		if err := paidRows.Scan(&ruleID, &occurrence); err != nil {
			paidRows.Close()
			return nil, nil, err
		}
		paid[UUIDToString(ruleID)+":"+occurrence] = true
	}
	if err := paidRows.Err(); err != nil {
		paidRows.Close()
		return nil, nil, err
	}
	paidRows.Close()
	for _, rule := range rules {
		if !rule.AccountID.Valid || !selected[UUIDToString(rule.AccountID)] {
			continue
		}
		for _, date := range expandRecurringOccurrences(rule, start, paydayDate.AddDate(0, 0, -1)) {
			if paid[UUIDToString(rule.ID)+":"+date.Format("2006-01-02")] {
				continue
			}
			flows = append(flows, payday.Flow{Date: date.In(indiaLocation), AmountPaise: rule.AmountPaise, Income: rule.Type == "INCOME", AccountID: UUIDToString(rule.AccountID)})
		}
	}
	return flows, adjustments, nil
}

func (s *PilotService) UpdatePaydayPlan(ctx context.Context, req *connect.Request[pb.UpdatePaydayPlanRequest]) (*connect.Response[pb.UpdatePaydayPlanResponse], error) {
	user, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}
	if s.Pool == nil || req.Msg.Config == nil {
		return nil, ErrorInvalidArgument("config is required")
	}
	c := req.Msg.Config
	next, err := parseIndiaDate(c.NextPayday)
	if err != nil {
		return nil, ErrorInvalidArgument("next_payday must use YYYY-MM-DD")
	}
	today := indiaNow()
	if !validNextPayday(next, today) {
		return nil, ErrorInvalidArgument("next_payday must be today or within 366 days")
	}
	if c.DailyAllowancePaise < 0 || c.MinimumReservePaise < 0 || c.GoalReservedPaise < 0 || c.DailyAllowancePaise > 1_000_000_000_000_000 || c.MinimumReservePaise > 1_000_000_000_000_000 || c.GoalReservedPaise > 1_000_000_000_000_000 {
		return nil, ErrorInvalidArgument("plan amounts are outside the supported range")
	}
	ids := make([]pgtype.UUID, 0, len(c.PayingAccountIds))
	seen := map[string]bool{}
	for _, raw := range c.PayingAccountIds {
		id, e := parseUUID(raw, "paying_account_id")
		if e != nil {
			return nil, e
		}
		if seen[raw] {
			return nil, ErrorInvalidArgument("paying account ids must be unique")
		}
		seen[raw] = true
		account, accountErr := s.DB.GetFinancialAccount(ctx, db.GetFinancialAccountParams{ID: id, UserID: user})
		if accountErr != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("paying account not found"))
		}
		if account.Currency != "INR" {
			return nil, ErrorInvalidArgument("payday forecasts currently require INR accounts")
		}
		ids = append(ids, id)
	}
	var goal pgtype.UUID
	if c.SelectedGoalId != nil && strings.TrimSpace(*c.SelectedGoalId) != "" {
		goal, err = parseUUID(*c.SelectedGoalId, "selected_goal_id")
		if err != nil {
			return nil, err
		}
		var exists bool
		if err = s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM goals WHERE id=$1 AND user_id=$2)`, goal, user).Scan(&exists); err != nil {
			return nil, ErrorInternal("internal system error")
		}
		if !exists {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("selected goal not found"))
		}
	}
	_, err = s.Pool.Exec(ctx, `INSERT INTO payday_plans(user_id,daily_allowance_paise,next_payday,minimum_reserve_paise,selected_goal_id,goal_reserved_paise,paying_account_ids) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET daily_allowance_paise=EXCLUDED.daily_allowance_paise,next_payday=EXCLUDED.next_payday,minimum_reserve_paise=EXCLUDED.minimum_reserve_paise,selected_goal_id=EXCLUDED.selected_goal_id,goal_reserved_paise=EXCLUDED.goal_reserved_paise,paying_account_ids=EXCLUDED.paying_account_ids,updated_at=NOW()`, user, c.DailyAllowancePaise, next, c.MinimumReservePaise, goal, c.GoalReservedPaise, ids)
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}
	plan, err := s.GetPaydayPlan(ctx, connect.NewRequest(&pb.GetPaydayPlanRequest{}))
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(&pb.UpdatePaydayPlanResponse{Plan: plan.Msg}), nil
}

func (s *PilotService) SetActionState(ctx context.Context, req *connect.Request[pb.SetActionStateRequest]) (*connect.Response[pb.SetActionStateResponse], error) {
	user, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}
	state := strings.ToUpper(strings.TrimSpace(req.Msg.State))
	if len(req.Msg.ActionId) == 0 || len(req.Msg.ActionId) > 160 {
		return nil, ErrorInvalidArgument("action_id must be 1-160 characters")
	}
	if state != "COMPLETED" && state != "DISMISSED" && state != "SNOOZED" {
		return nil, ErrorInvalidArgument("state must be COMPLETED, DISMISSED, or SNOOZED")
	}
	var snooze any
	if state == "SNOOZED" {
		if req.Msg.SnoozeUntil == nil {
			return nil, ErrorInvalidArgument("snooze_until is required")
		}
		t := req.Msg.SnoozeUntil.AsTime()
		if !t.After(time.Now()) || t.After(time.Now().AddDate(0, 0, 366)) {
			return nil, ErrorInvalidArgument("snooze_until must be within the next year")
		}
		snooze = t
	} else if req.Msg.SnoozeUntil != nil {
		return nil, ErrorInvalidArgument("snooze_until only applies to SNOOZED")
	}
	if s.Pool == nil {
		return nil, ErrorInternal("action state is unavailable")
	}
	_, err = s.Pool.Exec(ctx, `INSERT INTO payday_action_states(user_id,action_id,state,snoozed_until) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,action_id) DO UPDATE SET state=EXCLUDED.state,snoozed_until=EXCLUDED.snoozed_until,updated_at=NOW()`, user, req.Msg.ActionId, state, snooze)
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}
	response := &pb.SetActionStateResponse{ActionId: req.Msg.ActionId, State: state}
	if state == "SNOOZED" {
		response.SnoozedUntil = req.Msg.SnoozeUntil
	}
	return connect.NewResponse(response), nil
}

func (s *PilotService) ConfirmAccountBalance(ctx context.Context, req *connect.Request[pb.ConfirmAccountBalanceRequest]) (*connect.Response[pb.ConfirmAccountBalanceResponse], error) {
	user, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}
	id, err := parseUUID(req.Msg.AccountId, "account_id")
	if err != nil {
		return nil, err
	}
	confirmed := time.Now().UTC()
	if req.Msg.ConfirmedAt != nil {
		confirmed = req.Msg.ConfirmedAt.AsTime().UTC()
	}
	if confirmed.After(time.Now().UTC().Add(time.Minute)) {
		return nil, ErrorInvalidArgument("confirmed_at cannot be in the future")
	}
	if req.Msg.BalancePaise > 1_000_000_000_000_000 || req.Msg.BalancePaise < -1_000_000_000_000_000 {
		return nil, ErrorInvalidArgument("balance is outside the supported range")
	}
	var balance int64
	var asOf time.Time
	var source string
	err = s.Pool.QueryRow(ctx, `UPDATE financial_accounts SET balance_paise=$1,balance_as_of=$2,balance_source='USER_CONFIRMED',updated_at=NOW() WHERE id=$3 AND user_id=$4 RETURNING balance_paise,balance_as_of,balance_source`, req.Msg.BalancePaise, confirmed, id, user).Scan(&balance, &asOf, &source)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("account not found"))
	}
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}
	return connect.NewResponse(&pb.ConfirmAccountBalanceResponse{AccountId: req.Msg.AccountId, BalancePaise: balance, BalanceAsOf: timestamppb.New(asOf), BalanceSource: source}), nil
}

func (s *PilotService) RecordObligationPayment(ctx context.Context, req *connect.Request[pb.RecordObligationPaymentRequest]) (*connect.Response[pb.RecordObligationPaymentResponse], error) {
	user, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}
	ruleID, err := parseUUID(req.Msg.RecurringRuleId, "recurring_rule_id")
	if err != nil {
		return nil, err
	}
	occurrence, err := parseIndiaDate(req.Msg.OccurrenceDate)
	if err != nil {
		return nil, ErrorInvalidArgument("occurrence_date must use YYYY-MM-DD")
	}
	today := indiaNow()
	if occurrence.After(indiaDayStart(today).AddDate(0, 0, 366)) {
		return nil, ErrorInvalidArgument("occurrence_date must be within the next 366 days")
	}
	paidAt := today
	if req.Msg.PaidAt != nil {
		paidAt = req.Msg.PaidAt.AsTime().UTC()
	}
	if paidAt.After(time.Now().Add(time.Minute)) {
		return nil, ErrorInvalidArgument("paid_at cannot be in the future")
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}
	defer tx.Rollback(ctx)
	var merchant, typ, cadence string
	var amount int64
	var acct pgtype.UUID
	var category pgtype.UUID
	var anchor time.Time
	var snoozed pgtype.Timestamptz
	err = tx.QueryRow(ctx, `SELECT merchant_norm,type,amount_paise,account_id,category_id,cadence,next_due_date,snoozed_until FROM recurring_rules WHERE id=$1 AND user_id=$2 AND active=true AND cancelled_at IS NULL`, ruleID, user).Scan(&merchant, &typ, &amount, &acct, &category, &cadence, &anchor, &snoozed)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("obligation not found"))
	}
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}
	if !recurringDateMatchesIndia(anchor, cadence, snoozed, occurrence) {
		return nil, ErrorInvalidArgument("occurrence_date does not match a scheduled obligation date")
	}
	occurrenceDate := occurrence.Format("2006-01-02")
	// Serialize the check/create path even when no payment row exists yet. This
	// keeps concurrent retries from creating orphan duplicate transactions.
	lockKey := UUIDToString(user) + ":" + UUIDToString(ruleID) + ":" + occurrenceDate
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, lockKey); err != nil {
		return nil, ErrorInternal("internal system error")
	}
	var existingID, existingTransactionID pgtype.UUID
	var existingPaidAt time.Time
	err = tx.QueryRow(ctx, `SELECT id,paid_at,transaction_id FROM recurring_payments WHERE user_id=$1 AND recurring_rule_id=$2 AND occurrence_date=$3::date FOR UPDATE`, user, ruleID, occurrenceDate).Scan(&existingID, &existingPaidAt, &existingTransactionID)
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return nil, ErrorInternal("internal system error")
		}
		var txID *string
		if existingTransactionID.Valid {
			value := UUIDToString(existingTransactionID)
			txID = &value
		}
		return connect.NewResponse(&pb.RecordObligationPaymentResponse{PaymentId: UUIDToString(existingID), RecurringRuleId: req.Msg.RecurringRuleId, OccurrenceDate: occurrenceDate, TransactionId: txID, PaidAt: timestamppb.New(existingPaidAt)}), nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrorInternal("internal system error")
	}
	var transactionID pgtype.UUID
	if req.Msg.TransactionId != nil && strings.TrimSpace(req.Msg.GetTransactionId()) != "" {
		transactionID, err = parseUUID(req.Msg.GetTransactionId(), "transaction_id")
		if err != nil {
			return nil, err
		}
		var transactionType, transactionStatus string
		var transactionAmount int64
		var transactionAccount pgtype.UUID
		var transactionDate time.Time
		err = tx.QueryRow(ctx, `SELECT type,status,amount_paise,account_id,date FROM transactions WHERE id=$1 AND user_id=$2 FOR UPDATE`, transactionID, user).Scan(&transactionType, &transactionStatus, &transactionAmount, &transactionAccount, &transactionDate)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("transaction not found"))
		}
		if err != nil {
			return nil, ErrorInternal("internal system error")
		}
		if err := validateObligationTransaction(transactionType, transactionStatus, transactionAmount, amount, transactionAccount, acct, transactionDate, paidAt); err != nil {
			return nil, ErrorInvalidArgument(err.Error())
		}
		var alreadyLinked bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM recurring_payments WHERE user_id=$1 AND transaction_id=$2)`, user, transactionID).Scan(&alreadyLinked)
		if err != nil {
			return nil, ErrorInternal("internal system error")
		}
		if alreadyLinked {
			return nil, ErrorInvalidArgument("transaction is already linked to a paid obligation")
		}
	} else {
		created, e := createTransactionRecord(ctx, db.New(tx), user, transactionCreateInput{AmountPaise: amount, Description: merchant, Date: paidAt, Type: typ, AccountID: acct, CategoryID: nil, MerchantRaw: merchant, MerchantNorm: merchant, Status: "POSTED", Provenance: "OBLIGATION_PAYMENT"})
		if e != nil {
			return nil, e
		}
		transactionID = created.ID
	}
	var paymentID pgtype.UUID
	err = tx.QueryRow(ctx, `INSERT INTO recurring_payments(user_id,recurring_rule_id,occurrence_date,paid_at,transaction_id) VALUES($1,$2,$3::date,$4,$5) ON CONFLICT(user_id,recurring_rule_id,occurrence_date) DO NOTHING RETURNING id`, user, ruleID, occurrence.Format("2006-01-02"), paidAt, transactionID).Scan(&paymentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("this obligation occurrence is already marked paid"))
	}
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, ErrorInternal("internal system error")
	}
	var txID *string
	if transactionID.Valid {
		v := UUIDToString(transactionID)
		txID = &v
	}
	return connect.NewResponse(&pb.RecordObligationPaymentResponse{PaymentId: UUIDToString(paymentID), RecurringRuleId: req.Msg.RecurringRuleId, OccurrenceDate: occurrence.Format("2006-01-02"), TransactionId: txID, PaidAt: timestamppb.New(paidAt)}), nil
}

func validateObligationTransaction(transactionType, transactionStatus string, amount, expectedAmount int64, transactionAccount, obligationAccount pgtype.UUID, transactionDate, paidAt time.Time) error {
	if transactionType != "EXPENSE" || transactionStatus != "POSTED" {
		return errors.New("transaction must be a posted expense")
	}
	if !obligationAccount.Valid || !transactionAccount.Valid || transactionAccount != obligationAccount {
		return errors.New("transaction account must match the obligation account")
	}
	if expectedAmount <= 0 || amount != expectedAmount {
		return errors.New("transaction amount must match the obligation amount")
	}
	if transactionDate.In(indiaLocation).Format("2006-01-02") > paidAt.In(indiaLocation).Format("2006-01-02") {
		return errors.New("transaction date cannot be after the payment date")
	}
	return nil
}

func (s *PilotService) CreateTransfer(ctx context.Context, req *connect.Request[pb.CreateTransferRequest]) (*connect.Response[pb.CreateTransferResponse], error) {
	user, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}
	if req.Msg.AmountPaise <= 0 || req.Msg.AmountPaise > 1_000_000_000_000_000 {
		return nil, ErrorInvalidArgument("amount must be within the supported positive range")
	}
	from, err := parseUUID(req.Msg.FromAccountId, "from_account_id")
	if err != nil {
		return nil, err
	}
	to, err := parseUUID(req.Msg.ToAccountId, "to_account_id")
	if err != nil {
		return nil, err
	}
	if from.Bytes == to.Bytes {
		return nil, ErrorInvalidArgument("source and destination accounts must differ")
	}
	key := strings.TrimSpace(req.Msg.IdempotencyKey)
	if key == "" || len(key) > 128 {
		return nil, ErrorInvalidArgument("idempotency_key is required and must be at most 128 characters")
	}
	transferDate := time.Now().UTC()
	if req.Msg.Date != nil {
		transferDate = req.Msg.Date.AsTime().UTC()
		if err = validateTransactionDate(transferDate); err != nil {
			return nil, ErrorInvalidArgument(err.Error())
		}
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}
	defer tx.Rollback(ctx)
	var priorGroup, priorDebit, priorCredit pgtype.UUID
	err = tx.QueryRow(ctx, `SELECT id,debit_transaction_id,credit_transaction_id FROM transfer_groups WHERE user_id=$1 AND idempotency_key=$2`, user, key).Scan(&priorGroup, &priorDebit, &priorCredit)
	if err == nil {
		return connect.NewResponse(&pb.CreateTransferResponse{TransferGroupId: UUIDToString(priorGroup), DebitTransactionId: UUIDToString(priorDebit), CreditTransactionId: UUIDToString(priorCredit)}), nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrorInternal("internal system error")
	}
	var fromCurrency, toCurrency string
	err = tx.QueryRow(ctx, `SELECT currency FROM financial_accounts WHERE id=$1 AND user_id=$2`, from, user).Scan(&fromCurrency)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("source account not found"))
	}
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}
	err = tx.QueryRow(ctx, `SELECT currency FROM financial_accounts WHERE id=$1 AND user_id=$2`, to, user).Scan(&toCurrency)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("destination account not found"))
	}
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}
	if fromCurrency != toCurrency {
		return nil, ErrorInvalidArgument("transfer accounts must use the same currency")
	}
	groupID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
	err = tx.QueryRow(ctx, `INSERT INTO transfer_groups(id,user_id,idempotency_key,from_account_id,to_account_id,amount_paise) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, groupID, user, key, from, to, req.Msg.AmountPaise).Scan(&groupID)
	if err != nil {
		return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("transfer idempotency key already exists"))
	}
	description := strings.TrimSpace(req.Msg.Description)
	if description == "" {
		description = "Transfer"
	}
	debitID, err := insertTransferTransaction(ctx, tx, user, from, groupID, "OUT", req.Msg.AmountPaise, description, transferDate)
	if err != nil {
		return nil, ErrorInternal("could not record transfer")
	}
	creditID, err := insertTransferTransaction(ctx, tx, user, to, groupID, "IN", req.Msg.AmountPaise, description, transferDate)
	if err != nil {
		return nil, ErrorInternal("could not record transfer")
	}
	_, err = tx.Exec(ctx, `UPDATE transfer_groups SET debit_transaction_id=$1,credit_transaction_id=$2 WHERE id=$3`, debitID, creditID, groupID)
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, ErrorInternal("internal system error")
	}
	return connect.NewResponse(&pb.CreateTransferResponse{TransferGroupId: UUIDToString(groupID), DebitTransactionId: UUIDToString(debitID), CreditTransactionId: UUIDToString(creditID)}), nil
}

func insertTransferTransaction(ctx context.Context, tx pgx.Tx, user, account, group pgtype.UUID, direction string, amount int64, description string, at time.Time) (pgtype.UUID, error) {
	var id pgtype.UUID
	err := tx.QueryRow(ctx, `INSERT INTO transactions(user_id,amount_paise,description,merchant_raw,merchant_norm,date,type,status,provenance,account_id,transfer_group_id,transfer_direction) VALUES($1,$2,$3,$3,$3,$4,'TRANSFER','POSTED','TRANSFER',$5,$6,$7) RETURNING id`, user, amount, description, at, account, group, direction).Scan(&id)
	return id, err
}

func (s *PilotService) ExportTransactions(ctx context.Context, req *connect.Request[pb.ExportTransactionsRequest], stream *connect.ServerStream[pb.ExportTransactionsResponse]) error {
	user, err := authenticatedUserUUID(ctx)
	if err != nil {
		return ErrorUnauthenticated(err.Error())
	}
	if len(req.Msg.Search) > 200 {
		return ErrorInvalidArgument("search is too long")
	}
	var account any
	if req.Msg.AccountId != nil {
		parsed, e := parseUUID(req.Msg.GetAccountId(), "account_id")
		if e != nil {
			return e
		}
		if _, e = s.DB.GetFinancialAccount(ctx, db.GetFinancialAccountParams{ID: parsed, UserID: user}); e != nil {
			return connect.NewError(connect.CodeNotFound, errors.New("account not found"))
		}
		account = parsed
	}
	var category any
	if req.Msg.CategoryId != nil {
		parsed, e := parseUUID(req.Msg.GetCategoryId(), "category_id")
		if e != nil {
			return e
		}
		if e = requireOwnedCategory(ctx, s.Pool, user, parsed); e != nil {
			return e
		}
		category = parsed
	}
	var start, end any
	if req.Msg.StartDate != nil {
		start = req.Msg.StartDate.AsTime()
	}
	if req.Msg.EndDate != nil {
		end = req.Msg.EndDate.AsTime()
	}
	var typ any
	if req.Msg.Type != nil {
		if e := validateTransactionType(req.Msg.GetType()); e != nil {
			return ErrorInvalidArgument(e.Error())
		}
		typ = req.Msg.GetType()
	}
	rows, err := s.Pool.Query(ctx, `SELECT date,description,type,amount_paise,account_id,merchant_norm FROM transactions WHERE user_id=$1 AND ($2::timestamptz IS NULL OR date >= $2) AND ($3::timestamptz IS NULL OR date < $3) AND ($4::uuid IS NULL OR account_id=$4) AND ($5::text IS NULL OR type=$5) AND ($6='' OR description ILIKE '%'||$6||'%' OR merchant_norm ILIKE '%'||$6||'%') AND ($7::uuid IS NULL OR category_id=$7) ORDER BY date DESC,id DESC`, user, start, end, account, typ, strings.TrimSpace(req.Msg.Search), category)
	if err != nil {
		return ErrorInternal("internal system error")
	}
	defer rows.Close()
	if err = stream.Send(&pb.ExportTransactionsResponse{CsvChunk: []byte("date,description,type,amount_paise,account_id,merchant\r\n")}); err != nil {
		return err
	}
	for rows.Next() {
		var date time.Time
		var desc, kind, merchant string
		var amount int64
		var accountID pgtype.UUID
		if err = rows.Scan(&date, &desc, &kind, &amount, &accountID, &merchant); err != nil {
			return ErrorInternal("internal system error")
		}
		record := []string{date.UTC().Format(time.RFC3339), safeCSVText(desc), kind, fmt.Sprint(amount), UUIDToString(accountID), safeCSVText(merchant)}
		var b strings.Builder
		w := csv.NewWriter(&b)
		if err = w.Write(record); err != nil {
			return err
		}
		w.Flush()
		if err = w.Error(); err != nil {
			return err
		}
		if err = stream.Send(&pb.ExportTransactionsResponse{CsvChunk: []byte(b.String())}); err != nil {
			return err
		}
	}
	if err = rows.Err(); err != nil {
		return ErrorInternal("internal system error")
	}
	return nil
}

func safeCSVText(value string) string {
	trimmed := strings.TrimLeft(value, " \t\r\n\v\f\x00")
	if trimmed != "" && strings.ContainsRune("=+-@", rune(trimmed[0])) {
		return "'" + value
	}
	return value
}
