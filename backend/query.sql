-- name: GetUser :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: UpdateUser :one
UPDATE users
SET email = COALESCE(sqlc.narg('email'), email)
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
WHERE user_id = $1
ORDER BY date DESC
LIMIT $2 OFFSET $3;

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
INSERT INTO import_batches (user_id, file_hash, bank_format, parsed_count, created_count, matched_count)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: BulkCreateTransactions :copyfrom
INSERT INTO transactions (
    user_id, amount_paise, description, merchant_raw, merchant_norm, date, type, status, provenance, category_id, tags, payment_method, upi_id, upi_ref, bank_rrn, is_recurring, recurring_id, receipt_url, receipt_id, import_batch_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
);

-- name: CreateRecurringRule :one
INSERT INTO recurring_rules (user_id, merchant_norm, amount_paise, cadence, next_due_date, active)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListUpcomingRecurringRules :many
SELECT * FROM recurring_rules
WHERE user_id = $1 AND active = true AND cancelled_at IS NULL AND next_due_date <= $2;

-- name: GetRecurringRule :one
SELECT * FROM recurring_rules 
WHERE id = $1 AND user_id = $2;

-- name: UpdateRecurringRule :one
UPDATE recurring_rules
SET snoozed_until = COALESCE(sqlc.narg('snoozed_until'), snoozed_until),
    cancelled_at = COALESCE(sqlc.narg('cancelled_at'), cancelled_at),
    active = COALESCE(sqlc.narg('active'), active)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

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
