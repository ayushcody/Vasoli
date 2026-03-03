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
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  dueDate TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'PENDING',
  snoozeUntil TIMESTAMP WITH TIME ZONE,
  metadata TEXT,

  userId UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
