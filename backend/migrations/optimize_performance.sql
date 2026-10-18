-- Optimization for Dashboard Analytics and Transaction Listing
-- This index significantly speeds up GetWealthAnalytics and ListTransactions queries.

CREATE INDEX IF NOT EXISTS idx_transactions_user_date_type 
ON public.transactions (user_id, date DESC, type);

-- Metadata for grouping and filtering performance
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_norm 
ON public.transactions (merchant_norm);

-- Index for Goal contributions
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_id 
ON public.goal_contributions (goal_id, created_at DESC);

-- New indexes for Dashboard analytics and recurring rules
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON transactions(user_id, type, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date ON transactions(user_id, category_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_user_return_warranty ON receipts(user_id, return_by, warranty_until);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_active_due ON recurring_rules(user_id, active, next_due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status_due ON reminders(user_id, status, due_at);
