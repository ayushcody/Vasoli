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
