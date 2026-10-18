package payday

import (
	"errors"
	"math"
	"time"
)

// Inputs are already restricted to the user's selected accounts and use integer paise.
type Config struct {
	DailyAllowancePaise int64
	MinimumReservePaise int64
	GoalReservedPaise   int64
	NextPayday          time.Time
}
type Account struct {
	ID           string
	BalancePaise int64
}
type Flow struct {
	Date             time.Time
	AmountPaise      int64
	Income           bool
	AccountID        string
	Transfer         bool
	InternalTransfer bool
}
type Day struct {
	Date                                                                                        time.Time
	OpeningPaise, IncomePaise, ObligationsPaise, AllowancePaise, ClosingPaise, SafeToSpendPaise int64
	AccountClosingPaise                                                                         map[string]int64
	TransferInPaise, TransferOutPaise                                                           int64
}

func Project(today time.Time, config Config, accounts []Account, flows []Flow) ([]Day, error) {
	today = day(today)
	payday := day(config.NextPayday)
	if config.DailyAllowancePaise < 0 || config.MinimumReservePaise < 0 || config.GoalReservedPaise < 0 {
		return nil, errors.New("plan amounts cannot be negative")
	}
	if _, ok := checkedAdd(config.MinimumReservePaise, config.GoalReservedPaise); !ok {
		return nil, errors.New("combined reserve exceeds supported range")
	}
	if payday.Before(today) || payday.After(today.AddDate(0, 0, 366)) {
		return nil, errors.New("next payday must be within 366 days")
	}
	if len(accounts) == 0 {
		return nil, errors.New("at least one paying account is required")
	}
	balances := make(map[string]int64, len(accounts))
	var balance int64
	for _, account := range accounts {
		var ok bool
		balance, ok = checkedAdd(balance, account.BalancePaise)
		if !ok {
			return nil, errors.New("combined account balance exceeds supported range")
		}
		balances[account.ID] = account.BalancePaise
	}
	byDate := make(map[string][]Flow)
	for _, flow := range flows {
		byDate[day(flow.Date).Format("2006-01-02")] = append(byDate[day(flow.Date).Format("2006-01-02")], flow)
	}
	days := make([]Day, 0, int(payday.Sub(today).Hours()/24))
	for date := today; date.Before(payday); date = date.AddDate(0, 0, 1) {
		opening := balance
		var income, obligations, transferIn, transferOut int64
		for _, flow := range byDate[date.Format("2006-01-02")] {
			ok := true
			if flow.Transfer {
				if !flow.InternalTransfer {
					if flow.Income {
						transferIn, ok = checkedAdd(transferIn, flow.AmountPaise)
					} else {
						transferOut, ok = checkedAdd(transferOut, flow.AmountPaise)
					}
					if !ok {
						return nil, errors.New("daily projected transfers exceed supported range")
					}
				}
			} else if flow.Income {
				income, ok = checkedAdd(income, flow.AmountPaise)
			} else {
				obligations, ok = checkedAdd(obligations, flow.AmountPaise)
			}
			if !ok {
				return nil, errors.New("daily projected flows exceed supported range")
			}
			accountID := flow.AccountID
			if accountID == "" && len(accounts) == 1 {
				accountID = accounts[0].ID
			}
			if accountID != "" {
				if _, exists := balances[accountID]; !exists {
					return nil, errors.New("flow references an unselected account")
				}
				delta := flow.AmountPaise
				if flow.Transfer {
					if !flow.Income {
						delta = -delta
					}
				} else if !flow.Income {
					delta = -delta
				}
				balances[accountID], ok = checkedAdd(balances[accountID], delta)
				if !ok {
					return nil, errors.New("account projected balance exceeds supported range")
				}
			}
		}
		allowance := int64(0)
		if date.Before(payday) {
			allowance = config.DailyAllowancePaise
		}
		outflow, ok := checkedAdd(obligations, allowance)
		if ok {
			outflow, ok = checkedAdd(outflow, transferOut)
		}
		if !ok {
			return nil, errors.New("daily outflows exceed supported range")
		}
		balance, ok = checkedAdd(balance, income)
		if ok {
			balance, ok = checkedAdd(balance, transferIn)
		}
		if !ok {
			return nil, errors.New("projected balance exceeds supported range")
		}
		balance, ok = checkedAdd(balance, -outflow)
		if !ok {
			return nil, errors.New("projected balance exceeds supported range")
		}
		accountClosing := make(map[string]int64, len(balances))
		for id, value := range balances {
			accountClosing[id] = value
		}
		days = append(days, Day{Date: date, OpeningPaise: opening, IncomePaise: income, ObligationsPaise: obligations, AllowancePaise: allowance, ClosingPaise: balance, AccountClosingPaise: accountClosing, TransferInPaise: transferIn, TransferOutPaise: transferOut})
	}
	// Future income is deliberately excluded: today's safe amount is bounded by
	// today's confirmed opening balance minus every remaining planned outflow.
	futureOutflow := int64(0)
	for i := len(days) - 1; i >= 0; i-- {
		outflow, ok := checkedAdd(days[i].ObligationsPaise, days[i].AllowancePaise)
		if ok {
			outflow, ok = checkedAdd(outflow, days[i].TransferOutPaise)
		}
		if !ok {
			return nil, errors.New("daily outflows exceed supported range")
		}
		futureOutflow, ok = checkedAdd(futureOutflow, outflow)
		if !ok {
			return nil, errors.New("projected outflows exceed supported range")
		}
		spendable, ok := checkedAdd(days[i].OpeningPaise, -futureOutflow)
		if !ok {
			return nil, errors.New("safe to spend exceeds supported range")
		}
		spendable, ok = checkedAdd(spendable, -config.MinimumReservePaise)
		if !ok {
			return nil, errors.New("safe to spend exceeds supported range")
		}
		spendable, ok = checkedAdd(spendable, -config.GoalReservedPaise)
		if !ok {
			return nil, errors.New("safe to spend exceeds supported range")
		}
		if spendable < 0 {
			spendable = 0
		}
		days[i].SafeToSpendPaise = spendable
	}
	return days, nil
}

func checkedAdd(a, b int64) (int64, bool) {
	if b > 0 && a > math.MaxInt64-b {
		return 0, false
	}
	if b < 0 && a < math.MinInt64-b {
		return 0, false
	}
	return a + b, true
}

func day(value time.Time) time.Time {
	y, m, d := value.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, value.Location())
}
