# Supabase Migration Guide for Vasoli

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Create a new project
3. Note down:
   - Project URL
   - Anon/Public Key
   - Service Role Key (for admin operations)

## Step 2: Install Supabase Packages

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm uninstall next-auth @prisma/client prisma bcryptjs
```

## Step 3: Update Environment Variables

Replace `.env` with:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Step 4: Database Schema Migration

Run this SQL in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (Supabase Auth handles this, but we add custom fields)
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  icon TEXT,
  color TEXT,
  type TEXT DEFAULT 'EXPENSE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  type TEXT DEFAULT 'EXPENSE',
  receipt_url TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_id UUID,
  category_id UUID REFERENCES categories,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  period TEXT DEFAULT 'MONTHLY',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  categories JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_amount DECIMAL(10,2) NOT NULL,
  current_amount DECIMAL(10,2) DEFAULT 0,
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'ACTIVE',
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal Contributions
CREATE TABLE goal_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID REFERENCES goals NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  note TEXT,
  transaction_id UUID REFERENCES transactions,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recurring Transactions
CREATE TABLE recurring_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  type TEXT DEFAULT 'EXPENSE',
  frequency TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  occurrences INT,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  category_id UUID REFERENCES categories,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'PENDING',
  snooze_until TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Health Scores
CREATE TABLE financial_health_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  score INT NOT NULL,
  components JSONB NOT NULL,
  factors JSONB NOT NULL,
  insights JSONB,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction Splits
CREATE TABLE transaction_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions NOT NULL,
  category_id UUID REFERENCES categories NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX idx_budgets_user ON budgets(user_id);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_reminders_user_status ON reminders(user_id, status);
CREATE INDEX idx_recurring_active ON recurring_transactions(is_active, next_run);

-- Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_splits ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own budgets" ON budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON budgets FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own recurring" ON recurring_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring" ON recurring_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring" ON recurring_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring" ON recurring_transactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own reminders" ON reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reminders" ON reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reminders" ON reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reminders" ON reminders FOR DELETE USING (auth.uid() = user_id);

-- Categories are public (read-only for users)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON categories FOR SELECT TO authenticated USING (true);

-- Insert default categories
INSERT INTO categories (name, icon, color, type) VALUES
  ('Food & Dining', '🍔', '#FF6B6B', 'EXPENSE'),
  ('Transportation', '🚗', '#4ECDC4', 'EXPENSE'),
  ('Shopping', '🛍️', '#FFE66D', 'EXPENSE'),
  ('Entertainment', '🎬', '#A8E6CF', 'EXPENSE'),
  ('Bills & Utilities', '💡', '#FF8B94', 'EXPENSE'),
  ('Healthcare', '🏥', '#C7CEEA', 'EXPENSE'),
  ('Education', '📚', '#B4A7D6', 'EXPENSE'),
  ('Salary', '💰', '#95E1D3', 'INCOME'),
  ('Freelance', '💼', '#F38181', 'INCOME'),
  ('Investment', '📈', '#AA96DA', 'INCOME'),
  ('Other', '📦', '#FCBAD3', 'EXPENSE');

-- Create demo user (run after creating user in Supabase Auth)
-- You'll need to create a user with email: demo@vasoli.com, password: demo123
-- Then run this to set up their profile:
-- INSERT INTO user_profiles (id, name) VALUES ('user-uuid-here', 'Demo User');
```

## Step 5: Create Supabase Client

Create `src/lib/supabase/client.ts`:
```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient()
```

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const createClient = () => {
  return createServerComponentClient({ cookies })
}
```

## Step 6: Update Middleware

Replace `src/middleware.ts`:
```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protected routes
  if (req.nextUrl.pathname.startsWith('/dashboard') ||
      req.nextUrl.pathname.startsWith('/transactions') ||
      req.nextUrl.pathname.startsWith('/budgets') ||
      req.nextUrl.pathname.startsWith('/goals') ||
      req.nextUrl.pathname.startsWith('/reminders') ||
      req.nextUrl.pathname.startsWith('/reports')) {
    if (!session) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/transactions/:path*',
    '/budgets/:path*',
    '/goals/:path*',
    '/reminders/:path*',
    '/reports/:path*',
  ],
}
```

## Step 7: Update Auth Pages

See separate files for:
- `src/app/auth/signin/page.tsx` (Supabase version)
- `src/components/sidebar.tsx` (Supabase signOut)

## Step 8: Update API Routes

All API routes need to:
1. Use Supabase client instead of Prisma
2. Get user from `supabase.auth.getUser()`
3. Use Supabase queries instead of Prisma

Example: `src/app/api/transactions/route.ts`

## Step 9: Create Demo User

1. In Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Email: demo@vasoli.com
4. Password: demo123
5. Note the UUID
6. Run SQL: `INSERT INTO user_profiles (id, name) VALUES ('uuid-here', 'Demo User');`

## Step 10: Clean Up

```bash
# Remove Prisma files
rm -rf prisma/
rm src/lib/prisma.ts

# Remove NextAuth files
rm -rf src/app/api/auth/

# Update package.json to remove unused deps
```

## Benefits of Supabase

✅ Built-in auth (no NextAuth complexity)
✅ Real-time subscriptions
✅ Row Level Security (automatic data isolation)
✅ PostgreSQL (more powerful than SQLite)
✅ Auto-generated REST API
✅ Storage for receipts
✅ Edge functions for serverless
✅ Free tier with generous limits

---

**Ready to migrate?** I can create all the updated files for you.
