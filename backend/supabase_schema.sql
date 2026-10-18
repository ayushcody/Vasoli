-- Supabase PostgreSQL Schema Migration from Vasoli Prisma
-- Run this in the Supabase SQL Editor

-- Users table extension (Supabase handles core Auth, but we need our profile data)
-- In Supabase, auth.users is the source of truth for auth. 
-- We map our 'User' app data to public.users associated with auth.users.id
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatarUrl TEXT,
  twoFactorEnabled BOOLEAN DEFAULT false,
  
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  icon TEXT,
  color TEXT,
  type TEXT DEFAULT 'EXPENSE',
  
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: We skip the User sessions and tokens tables since Supabase Auth handles that inherently.

CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  type TEXT DEFAULT 'EXPENSE',
  frequency TEXT NOT NULL, -- DAILY, WEEKLY, MONTHLY, etc.
  startDate TIMESTAMP WITH TIME ZONE NOT NULL,
  endDate TIMESTAMP WITH TIME ZONE,
  occurrences INTEGER,
  lastRun TIMESTAMP WITH TIME ZONE,
  nextRun TIMESTAMP WITH TIME ZONE,
  isActive BOOLEAN DEFAULT true,

  userId UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  categoryId UUID REFERENCES public.categories(id) ON DELETE SET NULL,

  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  type TEXT DEFAULT 'EXPENSE',
  receiptUrl TEXT,
  paymentMethod TEXT DEFAULT 'CASH', -- UPI, CREDIT_CARD, CASH
  upiId TEXT,                        -- Virtual Payment Address (VPA)
  bankRrn TEXT,                      -- Bank Reference Number for reconciliation

  isRecurring BOOLEAN DEFAULT false,
  recurringId UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL,

  userId UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  categoryId UUID REFERENCES public.categories(id) ON DELETE SET NULL,

  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transaction_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DOUBLE PRECISION NOT NULL,
  description TEXT,

  transactionId UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  categoryId UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  userId UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  period TEXT DEFAULT 'MONTHLY',
  startDate TIMESTAMP WITH TIME ZONE NOT NULL,
  endDate TIMESTAMP WITH TIME ZONE NOT NULL,
  categories TEXT NOT NULL, -- JSON string or comma separated

  userId UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  targetAmount DOUBLE PRECISION NOT NULL,
  currentAmount DOUBLE PRECISION DEFAULT 0,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'ACTIVE',
  color TEXT,
  icon TEXT,

  userId UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DOUBLE PRECISION NOT NULL,
  note TEXT,

  goalId UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  transactionId UUID REFERENCES public.transactions(id) ON DELETE SET NULL,

  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  snoozed_until TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  linked_entity_type TEXT,
  linked_entity_id UUID,
  channel_email BOOLEAN DEFAULT false,
  channel_push BOOLEAN DEFAULT false,
  channel_in_app BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('PENDING', 'SNOOZED', 'COMPLETED', 'DISMISSED')),
  CONSTRAINT valid_reminder_type CHECK (reminder_type IN ('BILL_DUE', 'GOAL_CONTRIBUTION', 'RECEIPT_RETURN', 'WARRANTY_EXPIRY', 'REIMBURSEMENT', 'CUSTOM'))
);

CREATE INDEX IF NOT EXISTS idx_reminders_user_due_at ON public.reminders(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_user_status ON public.reminders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_reminders_user_type ON public.reminders(user_id, reminder_type);
CREATE INDEX IF NOT EXISTS idx_reminders_linked_entity ON public.reminders(linked_entity_type, linked_entity_id);

CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  masked_account_number TEXT,
  balance_paise BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  is_manual BOOLEAN NOT NULL DEFAULT true,
  provider_name TEXT,
  provider_account_id TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_account_type CHECK (account_type IN ('CASH', 'SAVINGS', 'CURRENT', 'CREDIT_CARD', 'LOAN', 'BROKERAGE', 'MUTUAL_FUND', 'EPF', 'PPF', 'NPS', 'WALLET', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_user ON public.financial_accounts(user_id);

CREATE TABLE IF NOT EXISTS public.liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  liability_type TEXT NOT NULL,
  principal_paise BIGINT NOT NULL DEFAULT 0,
  outstanding_paise BIGINT NOT NULL DEFAULT 0,
  interest_rate_bps INTEGER,
  emi_paise BIGINT,
  due_day INTEGER,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_liability_type CHECK (liability_type IN ('CREDIT_CARD', 'PERSONAL_LOAN', 'EDUCATION_LOAN', 'HOME_LOAN', 'VEHICLE_LOAN', 'BNPL', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_liabilities_user ON public.liabilities(user_id);

CREATE TABLE IF NOT EXISTS public.financial_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score INTEGER NOT NULL,
  components TEXT NOT NULL,
  factors TEXT NOT NULL,
  insights TEXT,

  userId UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Handle automatic user profiling on Supabase Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatarUrl)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Achievements
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
