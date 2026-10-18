-- name: GetUser :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (id, email, name, avatar_url)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateUser :one
UPDATE users
SET email = COALESCE(sqlc.narg('email'), email),
    name = COALESCE(sqlc.narg('name'), name),
    avatar_url = COALESCE(sqlc.narg('avatar_url'), avatar_url),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: CreateTransaction :one
INSERT INTO transactions (
    user_id, amount_paise, description, merchant_raw, merchant_norm, date, type, status, provenance, category_id, tags, payment_method, upi_id, upi_ref, bank_rrn, is_recurring, recurring_id, receipt_url, receipt_id, import_batch_id, account_id, refund_of_transaction_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
)
RETURNING *;

-- name: GetTransaction :one
SELECT * FROM transactions
WHERE id = $1 AND user_id = $2 LIMIT 1;

-- name: ListTransactions :many
SELECT * FROM transactions
WHERE user_id = sqlc.arg('user_id')
    AND (sqlc.narg('type')::TEXT IS NULL OR type = sqlc.narg('type'))
    AND (sqlc.narg('category_id')::UUID IS NULL OR category_id = sqlc.narg('category_id'))
    AND (sqlc.narg('start_date')::TIMESTAMPTZ IS NULL OR date >= sqlc.narg('start_date'))
    AND (sqlc.narg('end_date')::TIMESTAMPTZ IS NULL OR date < sqlc.narg('end_date'))
    AND (sqlc.narg('account_id')::UUID IS NULL OR account_id = sqlc.narg('account_id'))
    AND (sqlc.narg('search')::TEXT IS NULL OR description ILIKE '%' || sqlc.narg('search') || '%' OR merchant_norm ILIKE '%' || sqlc.narg('search') || '%')
    AND (
        sqlc.narg('cursor_date')::TIMESTAMPTZ IS NULL
        OR date < sqlc.narg('cursor_date')
        OR (date = sqlc.narg('cursor_date') AND id < sqlc.narg('cursor_id'))
    )
ORDER BY date DESC, id DESC
LIMIT sqlc.arg('limit_count');

-- name: FindTransactionDuplicate :one
SELECT id FROM transactions
WHERE user_id = $1
    AND date = sqlc.arg('date')
    AND amount_paise = sqlc.arg('amount_paise')
    AND description = sqlc.arg('description')
    AND (sqlc.narg('account_id')::UUID IS NULL OR account_id = sqlc.narg('account_id'))
LIMIT 1;

-- name: UpdateTransaction :one
UPDATE transactions
SET amount_paise = COALESCE(sqlc.narg('amount_paise'), amount_paise),
    description = COALESCE(sqlc.narg('description'), description),
    merchant_raw = COALESCE(sqlc.narg('merchant_raw'), merchant_raw),
    merchant_norm = COALESCE(sqlc.narg('merchant_norm'), merchant_norm),
    date = COALESCE(sqlc.narg('date'), date),
    type = COALESCE(sqlc.narg('type'), type),
    status = COALESCE(sqlc.narg('status'), status),
    provenance = COALESCE(sqlc.narg('provenance'), provenance),
    category_id = COALESCE(sqlc.narg('category_id'), category_id),
    payment_method = COALESCE(sqlc.narg('payment_method'), payment_method),
    upi_id = COALESCE(sqlc.narg('upi_id'), upi_id),
    upi_ref = COALESCE(sqlc.narg('upi_ref'), upi_ref),
    bank_rrn = COALESCE(sqlc.narg('bank_rrn'), bank_rrn),
    account_id = COALESCE(sqlc.narg('account_id'), account_id),
    refund_of_transaction_id = COALESCE(sqlc.narg('refund_of_transaction_id'), refund_of_transaction_id),
    refund_of_transaction_id = COALESCE(sqlc.narg('refund_of_transaction_id'), refund_of_transaction_id)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteTransaction :exec
DELETE FROM transactions
WHERE id = $1 AND user_id = $2;

-- name: GetSummaryTotals :one
SELECT
    COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount_paise ELSE 0 END), 0)::BIGINT AS total_income,
    COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount_paise WHEN type = 'REFUND' THEN -amount_paise ELSE 0 END), 0)::BIGINT AS total_expenses,
    COALESCE(
        SUM(
            CASE
                WHEN type = 'INCOME' THEN amount_paise
                WHEN type = 'EXPENSE' THEN -amount_paise
                WHEN type = 'REFUND' THEN amount_paise
                ELSE 0
            END
        ),
        0
    )::BIGINT AS net_balance
FROM transactions
WHERE user_id = $1
    AND date >= sqlc.arg('start_date')
    AND date < sqlc.arg('end_date')
    AND status = 'POSTED'
    AND type IN ('INCOME', 'EXPENSE', 'REFUND');

-- name: GetTransactionCountInRange :one
SELECT COUNT(*)::INT AS transaction_count
FROM transactions
WHERE user_id = $1
    AND date >= sqlc.arg('start_date')
    AND date < sqlc.arg('end_date')
    AND status = 'POSTED'
    AND type IN ('INCOME', 'EXPENSE', 'REFUND');

-- name: ListTopExpenseCategories :many
SELECT
    COALESCE(categories.name, 'Uncategorised') AS category_name,
    COALESCE(categories.icon, '') AS category_icon,
    COALESCE(SUM(CASE WHEN transactions.type='REFUND' THEN -transactions.amount_paise ELSE transactions.amount_paise END), 0)::BIGINT AS total_paise
FROM transactions
LEFT JOIN categories ON categories.id = transactions.category_id
WHERE transactions.user_id = $1
    AND transactions.date >= sqlc.arg('start_date')
    AND transactions.date < sqlc.arg('end_date')
    AND transactions.type IN ('EXPENSE','REFUND')
GROUP BY COALESCE(categories.name, 'Uncategorised'), COALESCE(categories.icon, '')
ORDER BY total_paise DESC, category_name ASC
LIMIT sqlc.arg('limit_count');

-- name: GetBiggestSpendInRange :one
SELECT
    COALESCE(NULLIF(merchant_norm, ''), NULLIF(merchant_raw, ''), description) AS merchant,
    amount_paise,
    date
FROM transactions
WHERE user_id = $1
    AND date >= sqlc.arg('start_date')
    AND date < sqlc.arg('end_date')
    AND type = 'EXPENSE'
ORDER BY amount_paise DESC, date DESC
LIMIT 1;

-- name: GetTransactionDayStreak :one
WITH transaction_days AS (
    SELECT DISTINCT date::date AS tx_day
    FROM transactions
    WHERE user_id = $1
        AND date >= sqlc.arg('start_date')
        AND date < sqlc.arg('end_date')
        AND type IN ('INCOME', 'EXPENSE')
),
streak_groups AS (
    SELECT
        tx_day,
        tx_day - (ROW_NUMBER() OVER (ORDER BY tx_day))::INT AS group_key
    FROM transaction_days
),
streak_lengths AS (
    SELECT COUNT(*)::INT AS streak
    FROM streak_groups
    GROUP BY group_key
)
SELECT COALESCE(MAX(streak), 0)::INT AS longest_streak
FROM streak_lengths;

-- name: GetLeakCategoryIncrease :one
WITH current_period AS (
    SELECT
        transactions.category_id,
        SUM(transactions.amount_paise)::BIGINT AS total_paise
    FROM transactions
    WHERE transactions.user_id = $1
        AND transactions.date >= sqlc.arg('current_start_date')
        AND transactions.date < sqlc.arg('current_end_date')
        AND transactions.type = 'EXPENSE'
    GROUP BY transactions.category_id
),
previous_period AS (
    SELECT
        transactions.category_id,
        SUM(transactions.amount_paise)::BIGINT AS total_paise
    FROM transactions
    WHERE transactions.user_id = $1
        AND transactions.date >= sqlc.arg('previous_start_date')
        AND transactions.date < sqlc.arg('previous_end_date')
        AND transactions.type = 'EXPENSE'
    GROUP BY transactions.category_id
)
SELECT
    COALESCE(categories.name, 'Uncategorised') AS category_name,
    (current_period.total_paise - COALESCE(previous_period.total_paise, 0))::BIGINT AS increase_paise
FROM current_period
LEFT JOIN previous_period ON previous_period.category_id = current_period.category_id
LEFT JOIN categories ON categories.id = current_period.category_id
WHERE current_period.total_paise > COALESCE(previous_period.total_paise, 0)
ORDER BY increase_paise DESC, category_name ASC
LIMIT 1;

-- name: GetWealthAnalytics :one
-- TODO(perf): Ensure idx_transactions_user_date covers this effectively on very large datasets
SELECT
    COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount_paise ELSE 0 END), 0)::BIGINT as saved,
    COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount_paise ELSE 0 END), 0)::BIGINT as spent,
    COALESCE(SUM(CASE WHEN type = 'INVESTMENT' THEN amount_paise ELSE 0 END), 0)::BIGINT as invested
FROM transactions
WHERE user_id = $1 AND status = 'POSTED' AND date >= sqlc.arg('start_date') AND date < sqlc.arg('end_date');

-- name: ListCategories :many
SELECT * FROM categories
WHERE user_id = $1 OR (user_id IS NULL AND is_default = true)
ORDER BY name ASC;

-- name: CreateCategoryRule :one
INSERT INTO category_rules (user_id, merchant_norm, category_id, confidence, last_used)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (user_id, merchant_norm)
DO UPDATE SET category_id = EXCLUDED.category_id, confidence = EXCLUDED.confidence, last_used = NOW()
RETURNING *;

-- name: GetCategoryRule :one
SELECT * FROM category_rules
WHERE user_id = $1 AND merchant_norm = $2 LIMIT 1;

-- name: ListCategoryRules :many
SELECT * FROM category_rules
WHERE user_id = $1;

-- name: CreateMerchantAlias :one
INSERT INTO merchant_aliases (user_id, raw_pattern, merchant_norm)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, raw_pattern)
DO UPDATE SET merchant_norm = EXCLUDED.merchant_norm
RETURNING *;

-- name: ListMerchantAliases :many
SELECT * FROM merchant_aliases
WHERE user_id = $1;

-- name: CreateImportBatch :one
INSERT INTO import_batches (user_id, file_hash, bank_format, parsed_count, created_count, matched_count, failed_count)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdateImportBatchCounts :one
UPDATE import_batches
SET parsed_count = sqlc.arg('parsed_count'),
    created_count = sqlc.arg('created_count'),
    matched_count = sqlc.arg('matched_count'),
    failed_count = sqlc.arg('failed_count')
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: BulkCreateTransactions :copyfrom
INSERT INTO transactions (
    user_id, amount_paise, description, merchant_raw, merchant_norm, date, type, status, provenance, category_id, tags, payment_method, upi_id, upi_ref, bank_rrn, is_recurring, recurring_id, receipt_url, receipt_id, import_batch_id, account_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
);

-- name: CreateRecurringRule :one
INSERT INTO recurring_rules (user_id, merchant_norm, amount_paise, type, cadence, next_due_date, active, category_id, account_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ListRecurringRules :many
SELECT * FROM recurring_rules
WHERE user_id = $1
ORDER BY next_due_date ASC, created_at ASC;

-- name: ListUpcomingRecurringRules :many
SELECT * FROM recurring_rules
WHERE user_id = $1 AND active = true AND cancelled_at IS NULL AND next_due_date <= $2;

-- name: GetRecurringRule :one
SELECT * FROM recurring_rules
WHERE id = $1 AND user_id = $2;

-- name: UpdateRecurringRule :one
UPDATE recurring_rules
SET merchant_norm = COALESCE(sqlc.narg('merchant_norm'), merchant_norm),
    amount_paise = COALESCE(sqlc.narg('amount_paise'), amount_paise),
    type = COALESCE(sqlc.narg('type'), type),
    cadence = COALESCE(sqlc.narg('cadence'), cadence),
    next_due_date = COALESCE(sqlc.narg('next_due_date'), next_due_date),
    category_id = COALESCE(sqlc.narg('category_id'), category_id),
    account_id = COALESCE(sqlc.narg('account_id'), account_id),
    snoozed_until = COALESCE(sqlc.narg('snoozed_until'), snoozed_until),
    cancelled_at = COALESCE(sqlc.narg('cancelled_at'), cancelled_at),
    active = COALESCE(sqlc.narg('active'), active),
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteRecurringRule :exec
DELETE FROM recurring_rules
WHERE id = $1 AND user_id = $2;

-- name: CreateReceipt :one
INSERT INTO receipts (
    user_id, merchant, amount_paise, purchase_date, return_by, warranty_until, reimbursable, ocr_payload_encrypted
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING *;

-- name: ListReceipts :many
SELECT * FROM receipts
WHERE user_id = $1
ORDER BY purchase_date DESC;

-- name: ListExpiringReceipts :many
SELECT * FROM receipts
WHERE user_id = $1
    AND (
        (return_by IS NOT NULL AND return_by <= $2 AND return_by >= NOW())
        OR
        (warranty_until IS NOT NULL AND warranty_until <= $2 AND warranty_until >= NOW())
    )
ORDER BY return_by ASC, warranty_until ASC;

-- name: UpdateReceipt :one
UPDATE receipts
SET reimbursable = COALESCE(sqlc.narg('reimbursable'), reimbursable),
    return_by = COALESCE(sqlc.narg('return_by'), return_by),
    warranty_until = COALESCE(sqlc.narg('warranty_until'), warranty_until),
    snoozed_until = COALESCE(sqlc.narg('snoozed_until'), snoozed_until)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: MarkTransactionsPosted :exec
UPDATE transactions
SET status = 'POSTED'
WHERE user_id = $1 AND merchant_norm = $2 AND amount_paise = $3 AND type = $4 AND status = 'PENDING';

-- name: CreateBudget :one
INSERT INTO budgets (
    user_id, name, amount_paise, period, start_date, end_date, categories, roll_unused_funds, deduct_overspend
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING *;

-- name: ListBudgets :many
SELECT * FROM budgets
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetBudget :one
SELECT * FROM budgets
WHERE id = $1 AND user_id = $2
LIMIT 1;

-- name: UpdateBudget :one
UPDATE budgets
SET name = COALESCE(sqlc.narg('name'), name),
    amount_paise = COALESCE(sqlc.narg('amount_paise'), amount_paise),
    period = COALESCE(sqlc.narg('period'), period),
    start_date = COALESCE(sqlc.narg('start_date'), start_date),
    end_date = COALESCE(sqlc.narg('end_date'), end_date),
    categories = COALESCE(sqlc.narg('categories'), categories),
    roll_unused_funds = COALESCE(sqlc.narg('roll_unused_funds'), roll_unused_funds),
    deduct_overspend = COALESCE(sqlc.narg('deduct_overspend'), deduct_overspend),
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteBudget :exec
DELETE FROM budgets
WHERE id = $1 AND user_id = $2;

-- name: GetEmergencyFundProgress :one
SELECT
    COALESCE(SUM(amount_paise), 0)::bigint as total_expenses
FROM transactions
WHERE user_id = $1
  AND type = 'EXPENSE'
  AND date >= sqlc.arg('start_date')
  AND date < sqlc.arg('end_date');

-- name: CreateFinancialAccount :one
INSERT INTO financial_accounts (
    user_id, account_type, institution_name, account_name, masked_account_number,
    balance_paise, currency, is_manual, provider_name, provider_account_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING *;

-- name: GetFinancialAccount :one
SELECT * FROM financial_accounts
WHERE id = $1 AND user_id = $2 LIMIT 1;

-- name: ListFinancialAccounts :many
SELECT * FROM financial_accounts
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: UpdateFinancialAccount :one
UPDATE financial_accounts
SET
    account_type = COALESCE(sqlc.narg('account_type'), account_type),
    institution_name = COALESCE(sqlc.narg('institution_name'), institution_name),
    account_name = COALESCE(sqlc.narg('account_name'), account_name),
    masked_account_number = COALESCE(sqlc.narg('masked_account_number'), masked_account_number),
    balance_paise = COALESCE(sqlc.narg('balance_paise'), balance_paise),
    currency = COALESCE(sqlc.narg('currency'), currency),
    balance_as_of = COALESCE(sqlc.narg('balance_as_of'), balance_as_of),
    balance_source = COALESCE(sqlc.narg('balance_source'), balance_source),
    last_synced_at = COALESCE(sqlc.narg('last_synced_at'), last_synced_at),
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteFinancialAccount :exec
DELETE FROM financial_accounts
WHERE id = $1 AND user_id = $2;

-- name: CreateLiability :one
INSERT INTO liabilities (
    user_id, account_id, liability_type, principal_paise, outstanding_paise,
    interest_rate_bps, emi_paise, due_day, start_date, end_date
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING *;

-- name: GetLiability :one
SELECT * FROM liabilities
WHERE id = $1 AND user_id = $2 LIMIT 1;

-- name: ListLiabilities :many
SELECT * FROM liabilities
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: UpdateLiability :one
UPDATE liabilities
SET
    account_id = COALESCE(sqlc.narg('account_id'), account_id),
    liability_type = COALESCE(sqlc.narg('liability_type'), liability_type),
    principal_paise = COALESCE(sqlc.narg('principal_paise'), principal_paise),
    outstanding_paise = COALESCE(sqlc.narg('outstanding_paise'), outstanding_paise),
    interest_rate_bps = COALESCE(sqlc.narg('interest_rate_bps'), interest_rate_bps),
    emi_paise = COALESCE(sqlc.narg('emi_paise'), emi_paise),
    due_day = COALESCE(sqlc.narg('due_day'), due_day),
    start_date = COALESCE(sqlc.narg('start_date'), start_date),
    end_date = COALESCE(sqlc.narg('end_date'), end_date),
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteLiability :exec
DELETE FROM liabilities
WHERE id = $1 AND user_id = $2;

-- name: GetNetWorthSummary :one
SELECT
    (SELECT COALESCE(SUM(fa.balance_paise), 0)::bigint FROM financial_accounts fa WHERE fa.user_id = sqlc.arg('user_id')::uuid AND fa.account_type NOT IN ('CREDIT_CARD', 'LOAN')) AS total_assets_paise,
    (SELECT COALESCE(SUM(l.outstanding_paise), 0)::bigint FROM liabilities l WHERE l.user_id = sqlc.arg('user_id')::uuid) AS total_liabilities_paise;

-- name: SumBudgetSpentByCategories :one
SELECT COALESCE(SUM(amount_paise), 0)::BIGINT AS spent_paise
FROM transactions
WHERE user_id = $1
    AND type = 'EXPENSE'
    AND date >= sqlc.arg('start_date')
    AND date < sqlc.arg('end_date')
    AND category_id::TEXT = ANY(sqlc.arg('category_ids')::TEXT[]);

-- name: SumBudgetSpentAllCategories :one
SELECT COALESCE(SUM(amount_paise), 0)::BIGINT AS spent_paise
FROM transactions
WHERE user_id = $1
    AND type = 'EXPENSE'
    AND date >= sqlc.arg('start_date')
    AND date < sqlc.arg('end_date');

-- name: CreateGoal :one
INSERT INTO goals (
    user_id, name, description, target_amount_paise, due_date, color, icon, cadence, active
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING *;

-- name: GetGoal :one
SELECT * FROM goals
WHERE id = $1 AND user_id = $2 LIMIT 1;

-- name: ListGoals :many
SELECT * FROM goals
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: UpdateGoal :one
UPDATE goals
SET name = COALESCE(sqlc.narg('name'), name),
    description = COALESCE(sqlc.narg('description'), description),
    target_amount_paise = COALESCE(sqlc.narg('target_amount_paise'), target_amount_paise),
    due_date = COALESCE(sqlc.narg('due_date'), due_date),
    status = COALESCE(sqlc.narg('status'), status),
    color = COALESCE(sqlc.narg('color'), color),
    icon = COALESCE(sqlc.narg('icon'), icon),
    cadence = COALESCE(sqlc.narg('cadence'), cadence),
    active = COALESCE(sqlc.narg('active'), active),
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteGoal :exec
DELETE FROM goals
WHERE id = $1 AND user_id = $2;

-- name: AddGoalContribution :one
INSERT INTO goal_contributions (
    goal_id, amount_paise, note
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: GetGoalContributions :many
SELECT * FROM goal_contributions
WHERE goal_id = $1
ORDER BY created_at DESC;

-- name: UpdateGoalCurrentAmount :one
UPDATE goals
SET current_amount_paise = current_amount_paise + $1,
    updated_at = NOW()
WHERE id = $2 AND user_id = $3
RETURNING *;

-- name: CreateReminder :one
INSERT INTO reminders (
    user_id, title, description, reminder_type, due_at, linked_entity_type, linked_entity_id, channel_email, channel_push, channel_in_app
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING *;

-- name: ListReminders :many
SELECT * FROM reminders
WHERE user_id = $1
ORDER BY due_at ASC;

-- name: ListUpcomingReminders :many
SELECT * FROM reminders
WHERE user_id = $1 AND status = 'PENDING' AND due_at <= $2
ORDER BY due_at ASC;

-- name: GetReminder :one
SELECT * FROM reminders
WHERE id = $1 AND user_id = $2 LIMIT 1;

-- name: UpdateReminder :one
UPDATE reminders
SET title = COALESCE(sqlc.narg('title'), title),
    description = COALESCE(sqlc.narg('description'), description),
    reminder_type = COALESCE(sqlc.narg('reminder_type'), reminder_type),
    due_at = COALESCE(sqlc.narg('due_at'), due_at),
    channel_email = COALESCE(sqlc.narg('channel_email'), channel_email),
    channel_push = COALESCE(sqlc.narg('channel_push'), channel_push),
    channel_in_app = COALESCE(sqlc.narg('channel_in_app'), channel_in_app),
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: SnoozeReminder :one
UPDATE reminders
SET status = 'SNOOZED',
    snoozed_until = sqlc.arg('snoozed_until'),
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: CompleteReminder :one
UPDATE reminders
SET status = 'COMPLETED',
    completed_at = NOW(),
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DismissReminder :one
UPDATE reminders
SET status = 'DISMISSED',
    dismissed_at = NOW(),
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteReminder :exec
DELETE FROM reminders
WHERE id = $1 AND user_id = $2;

-- name: GetRecurringCandidates :many
WITH merchant_stats AS (
    SELECT
        merchant_norm,
        type,
        COUNT(*) as occurrence_count,
        MIN(date)::TIMESTAMPTZ as first_date,
        MAX(date)::TIMESTAMPTZ as last_date,
        AVG(amount_paise) as avg_amount,
        STDDEV(amount_paise) as stddev_amount
    FROM transactions
    WHERE transactions.user_id = sqlc.arg('user_id')
      AND transactions.merchant_norm IS NOT NULL
      AND transactions.merchant_norm != ''
    GROUP BY transactions.merchant_norm, transactions.type
    HAVING COUNT(*) >= 3
),
existing_rules AS (
    SELECT merchant_norm FROM recurring_rules WHERE recurring_rules.user_id = sqlc.arg('user_id') AND active = true
)
SELECT
    f.merchant_norm,
    f.type,
    f.occurrence_count::INT,
    f.first_date,
    f.last_date,
    f.avg_amount::BIGINT as avg_amount,
    COALESCE(f.stddev_amount, 0)::FLOAT as stddev_amount
FROM merchant_stats f
LEFT JOIN existing_rules r ON f.merchant_norm = r.merchant_norm
WHERE r.merchant_norm IS NULL
  AND (f.stddev_amount IS NULL OR (f.stddev_amount / f.avg_amount) <= 0.10);

-- name: ListTopMerchants :many
SELECT
    COALESCE(NULLIF(merchant_norm, ''), NULLIF(merchant_raw, ''), description) AS merchant,
    SUM(amount_paise)::BIGINT AS total_paise
FROM transactions
WHERE user_id = $1
    AND date >= sqlc.arg('start_date')
    AND date < sqlc.arg('end_date')
    AND type = 'EXPENSE'
GROUP BY merchant
ORDER BY total_paise DESC
LIMIT sqlc.arg('limit_count');

-- name: GetCategoryTrends :many
WITH current_period AS (
    SELECT
        transactions.category_id,
        SUM(transactions.amount_paise)::BIGINT AS total_paise
    FROM transactions
    WHERE transactions.user_id = $1
        AND transactions.date >= sqlc.arg('current_start_date')
        AND transactions.date < sqlc.arg('current_end_date')
        AND transactions.type = 'EXPENSE'
    GROUP BY transactions.category_id
),
previous_period AS (
    SELECT
        transactions.category_id,
        SUM(transactions.amount_paise)::BIGINT AS total_paise
    FROM transactions
    WHERE transactions.user_id = $1
        AND transactions.date >= sqlc.arg('previous_start_date')
        AND transactions.date < sqlc.arg('previous_end_date')
        AND transactions.type = 'EXPENSE'
    GROUP BY transactions.category_id
)
SELECT
    COALESCE(categories.name, 'Uncategorised') AS category_name,
    COALESCE(categories.icon, '') AS category_icon,
    COALESCE(current_period.total_paise, 0)::BIGINT AS current_paise,
    COALESCE(previous_period.total_paise, 0)::BIGINT AS previous_paise,
    (COALESCE(current_period.total_paise, 0) - COALESCE(previous_period.total_paise, 0))::BIGINT AS difference_paise
FROM current_period
FULL OUTER JOIN previous_period ON previous_period.category_id = current_period.category_id
LEFT JOIN categories ON categories.id = COALESCE(current_period.category_id, previous_period.category_id)
ORDER BY current_paise DESC, category_name ASC;

-- name: GetMerchantTrends :many
WITH current_period AS (
    SELECT
        COALESCE(NULLIF(merchant_norm, ''), NULLIF(merchant_raw, ''), description) AS merchant,
        SUM(amount_paise)::BIGINT AS total_paise,
        COUNT(*)::INT AS transaction_count
    FROM transactions
    WHERE transactions.user_id = $1
        AND transactions.date >= sqlc.arg('current_start_date')
        AND transactions.date < sqlc.arg('current_end_date')
        AND transactions.type = 'EXPENSE'
    GROUP BY merchant
),
previous_period AS (
    SELECT
        COALESCE(NULLIF(merchant_norm, ''), NULLIF(merchant_raw, ''), description) AS merchant,
        SUM(amount_paise)::BIGINT AS total_paise,
        COUNT(*)::INT AS transaction_count
    FROM transactions
    WHERE transactions.user_id = $1
        AND transactions.date >= sqlc.arg('previous_start_date')
        AND transactions.date < sqlc.arg('previous_end_date')
        AND transactions.type = 'EXPENSE'
    GROUP BY merchant
)
SELECT
    COALESCE(current_period.merchant, previous_period.merchant) AS merchant,
    COALESCE(current_period.total_paise, 0)::BIGINT AS current_paise,
    COALESCE(previous_period.total_paise, 0)::BIGINT AS previous_paise,
    COALESCE(current_period.transaction_count, 0)::INT AS current_count,
    (COALESCE(current_period.total_paise, 0) - COALESCE(previous_period.total_paise, 0))::BIGINT AS difference_paise
FROM current_period
FULL OUTER JOIN previous_period ON previous_period.merchant = current_period.merchant
ORDER BY current_paise DESC, COALESCE(current_period.merchant, previous_period.merchant) ASC;

-- name: GetAverageMonthlyExpense :one
WITH monthly_expenses AS (
    SELECT
        DATE_TRUNC('month', date) AS month,
        SUM(amount_paise)::BIGINT AS total_paise
    FROM transactions
    WHERE user_id = $1
        AND date >= sqlc.arg('start_date')
        AND date < sqlc.arg('end_date')
        AND type = 'EXPENSE'
    GROUP BY DATE_TRUNC('month', date)
)
SELECT
    COALESCE(AVG(total_paise), 0)::BIGINT AS average_paise
FROM monthly_expenses;

-- name: ListAchievements :many
SELECT * FROM achievements ORDER BY created_at ASC;

-- name: ListUserAchievements :many
SELECT a.*, ua.awarded_at
FROM user_achievements ua
JOIN achievements a ON ua.achievement_id = a.id
WHERE ua.user_id = $1
ORDER BY ua.awarded_at DESC;

-- name: GetNotificationPreferences :one
SELECT * FROM notification_preferences
WHERE user_id = $1 LIMIT 1;

-- name: UpsertNotificationPreferences :one
INSERT INTO notification_preferences (
    user_id, email_enabled, in_app_enabled, push_enabled, lead_days, updated_at
) VALUES (
    $1, $2, $3, $4, $5, NOW()
)
ON CONFLICT (user_id) DO UPDATE SET
    email_enabled = EXCLUDED.email_enabled,
    in_app_enabled = EXCLUDED.in_app_enabled,
    push_enabled = EXCLUDED.push_enabled,
    lead_days = EXCLUDED.lead_days,
    updated_at = NOW()
RETURNING *;

-- name: GetDueRemindersForNotifications :many
SELECT r.*, np.email_enabled, np.in_app_enabled, np.push_enabled, np.lead_days, u.email as user_email
FROM reminders r
JOIN notification_preferences np ON r.user_id = np.user_id
JOIN users u ON r.user_id = u.id
WHERE r.status = 'PENDING'
  AND (r.snoozed_until IS NULL OR r.snoozed_until <= NOW())
  AND (r.due_at - (np.lead_days || ' days')::interval) <= NOW();

-- name: CheckReminderNotificationExists :one
SELECT EXISTS (
    SELECT 1 FROM reminder_notifications
    WHERE reminder_id = $1 AND channel = $2 AND (sent_at IS NOT NULL OR failed_at IS NULL)
);

-- name: LogReminderNotification :one
INSERT INTO reminder_notifications (
    reminder_id, user_id, channel, scheduled_for, sent_at, failed_at, error_message
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING *;

-- name: ListProviderConnections :many
SELECT * FROM provider_connections
WHERE user_id = $1 ORDER BY created_at DESC;

-- name: CreateProviderConnection :one
INSERT INTO provider_connections (
    user_id, provider_type, provider_name, connection_status, consent_id, expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: RevokeProviderConnection :one
UPDATE provider_connections
SET connection_status = 'REVOKED', updated_at = NOW()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: AwardAchievement :one
INSERT INTO user_achievements (user_id, achievement_id)
SELECT $1, id FROM achievements WHERE code = $2
ON CONFLICT (user_id, achievement_id) DO NOTHING
RETURNING *;

-- name: CheckAchievementAwarded :one
SELECT EXISTS (
    SELECT 1 FROM user_achievements ua
    JOIN achievements a ON ua.achievement_id = a.id
    WHERE ua.user_id = $1 AND a.code = $2
);
