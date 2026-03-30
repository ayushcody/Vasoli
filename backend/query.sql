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
    user_id, amount_paise, description, merchant_raw, merchant_norm, date, type, status, provenance, category_id, tags, payment_method, upi_id, upi_ref, bank_rrn, is_recurring, recurring_id, receipt_url, receipt_id, import_batch_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
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
    bank_rrn = COALESCE(sqlc.narg('bank_rrn'), bank_rrn)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteTransaction :exec
DELETE FROM transactions
WHERE id = $1 AND user_id = $2;

-- name: GetSummaryTotals :one
SELECT
    COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount_paise ELSE 0 END), 0)::BIGINT AS total_income,
    COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount_paise ELSE 0 END), 0)::BIGINT AS total_expenses,
    COALESCE(
        SUM(
            CASE
                WHEN type = 'INCOME' THEN amount_paise
                WHEN type = 'EXPENSE' THEN -amount_paise
                ELSE 0
            END
        ),
        0
    )::BIGINT AS net_balance
FROM transactions
WHERE user_id = $1
    AND date >= sqlc.arg('start_date')
    AND date < sqlc.arg('end_date')
    AND type IN ('INCOME', 'EXPENSE');

-- name: GetTransactionCountInRange :one
SELECT COUNT(*)::INT AS transaction_count
FROM transactions
WHERE user_id = $1
    AND date >= sqlc.arg('start_date')
    AND date < sqlc.arg('end_date')
    AND type IN ('INCOME', 'EXPENSE');

-- name: ListTopExpenseCategories :many
SELECT
    COALESCE(categories.name, 'Uncategorised') AS category_name,
    COALESCE(categories.icon, '') AS category_icon,
    COALESCE(SUM(transactions.amount_paise), 0)::BIGINT AS total_paise
FROM transactions
LEFT JOIN categories ON categories.id = transactions.category_id
WHERE transactions.user_id = $1
    AND transactions.date >= sqlc.arg('start_date')
    AND transactions.date < sqlc.arg('end_date')
    AND transactions.type = 'EXPENSE'
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
SELECT 
    COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount_paise ELSE 0 END), 0)::BIGINT as saved,
    COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount_paise ELSE 0 END), 0)::BIGINT as spent,
    COALESCE(SUM(CASE WHEN type = 'INVESTMENT' THEN amount_paise ELSE 0 END), 0)::BIGINT as invested
FROM transactions
WHERE user_id = $1 AND date >= sqlc.arg('start_date') AND date < sqlc.arg('end_date');

-- name: ListCategories :many
SELECT * FROM categories
WHERE user_id = $1 OR is_default = true
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
    user_id, amount_paise, description, merchant_raw, merchant_norm, date, type, status, provenance, category_id, tags, payment_method, upi_id, upi_ref, bank_rrn, is_recurring, recurring_id, receipt_url, receipt_id, import_batch_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
);

-- name: CreateRecurringRule :one
INSERT INTO recurring_rules (user_id, merchant_norm, amount_paise, type, cadence, next_due_date, active, category_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
    user_id, name, amount_paise, period, start_date, end_date, categories
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
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
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteBudget :exec
DELETE FROM budgets
WHERE id = $1 AND user_id = $2;

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
