-- name: GetUser :one
SELECT * FROM public.users
WHERE id = $1 LIMIT 1;

-- name: UpdateUser :one
UPDATE public.users
SET name = COALESCE(SQLC.arg(name), name),
    avatarurl = COALESCE(SQLC.arg(avatar_url), avatarurl),
    updatedat = NOW()
WHERE id = $1
RETURNING *;

-- name: CreateTransaction :one
INSERT INTO public.transactions (
    amount, description, date, type, receipturl,
    paymentmethod, upiid, bankrrn, 
    isrecurring, recurringid, userid, categoryid
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
)
RETURNING *;

-- name: GetTransaction :one
SELECT * FROM public.transactions
WHERE id = $1 LIMIT 1;

-- name: ListTransactions :many
SELECT * FROM public.transactions
WHERE userid = $1
ORDER BY date DESC
LIMIT $2 OFFSET $3;

-- name: DeleteTransaction :exec
DELETE FROM public.transactions
WHERE id = $1 AND userid = $2;

-- name: GetWealthAnalytics :one
SELECT 
    COALESCE(SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) as saved,
    COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) as spent,
    COALESCE(SUM(CASE WHEN t.type = 'INVESTMENT' THEN t.amount ELSE 0 END), 0) as invested
FROM public.transactions t
WHERE t.userid = $1;
