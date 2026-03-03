# Quick Start: Implementing the Refactored Architecture

## Overview

This guide will help you implement the new simplified architecture for Vasoli. The refactoring has already created the foundation - now you need to migrate the existing code.

## What's Already Done ✅

1. ✅ New directory structure created
2. ✅ Shared types and constants (`src/shared/`)
3. ✅ Server utilities and validation (`src/server/lib/`)
4. ✅ Example services (transaction, goal, budget)
5. ✅ Simplified API client (`src/client/lib/api.ts`)
6. ✅ Example hooks (transactions, goals)
7. ✅ Simplified UI store (`src/client/stores/ui-store.ts`)
8. ✅ Example API route (`src/app/api/transactions/route.new.ts`)

## Migration Strategy

### Option 1: Incremental (Recommended)
Migrate one feature at a time while keeping the app running.

### Option 2: Full Refactor
Stop development and refactor everything at once.

**Recommendation**: Use Option 1 for production apps.

---

## Step-by-Step Migration

### Phase 1: Setup (30 minutes)

#### 1. Update tsconfig.json paths
```json
{
  "compilerOptions": {
    "paths": {
      "@/client/*": ["./src/client/*"],
      "@/server/*": ["./src/server/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/*": ["./src/*"]
    }
  }
}
```

#### 2. Install any missing dependencies
```bash
npm install
```

#### 3. Move Prisma schema
```bash
mv prisma/schema.prisma src/server/db/schema.prisma
```

Update `prisma/schema.prisma` to point to the new location or keep it in `prisma/` and update imports.

---

### Phase 2: Migrate Transactions (2 hours)

#### Step 1: Create remaining services

**Create `src/server/services/recurring.service.ts`:**
```typescript
import { prisma } from '../db/prisma';
import type { RecurringTransaction, CreateRecurringInput } from '@/shared/types';

export class RecurringService {
  async getAll(userId: string) {
    return await prisma.recurringTransaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: CreateRecurringInput) {
    return await prisma.recurringTransaction.create({
      data: { ...data, userId },
    });
  }

  // ... other methods
}

export const recurringService = new RecurringService();
```

**Create `src/server/services/reminder.service.ts`:**
```typescript
import { prisma } from '../db/prisma';
import type { Reminder, CreateReminderInput } from '@/shared/types';

export class ReminderService {
  async getAll(userId: string, filters?: { upcoming?: boolean }) {
    const where: any = { userId };
    if (filters?.upcoming) {
      where.dueDate = { gte: new Date() };
      where.status = 'PENDING';
    }
    return await prisma.reminder.findMany({ where });
  }

  // ... other methods
}

export const reminderService = new ReminderService();
```

#### Step 2: Update API routes

**Replace `src/app/api/transactions/route.ts`:**
```typescript
import { NextRequest } from 'next/server';
import { transactionService } from '@/server/services/transaction.service';
import { createTransactionSchema } from '@/server/lib/validation';
import { requireAuth, successResponse, handleError, parseSearchParams } from '@/server/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const filters = parseSearchParams(request.url);
    const transactions = await transactionService.getAll(userId, filters);
    return successResponse(transactions);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const data = createTransactionSchema.parse(body);
    const transaction = await transactionService.create(userId, data);
    return successResponse(transaction, 201);
  } catch (error) {
    return handleError(error);
  }
}
```

**Create `src/app/api/transactions/[id]/route.ts`:**
```typescript
import { NextRequest } from 'next/server';
import { transactionService } from '@/server/services/transaction.service';
import { updateTransactionSchema } from '@/server/lib/validation';
import { requireAuth, successResponse, handleError } from '@/server/lib/utils';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireAuth();
    const transaction = await transactionService.getById(params.id, userId);
    if (!transaction) return handleError(new Error('Not found'));
    return successResponse(transaction);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const data = updateTransactionSchema.parse(body);
    const transaction = await transactionService.update(params.id, userId, data);
    return successResponse(transaction);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireAuth();
    await transactionService.delete(params.id, userId);
    return successResponse({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
```

#### Step 3: Update client hooks

**Move and update hooks:**
```bash
# Copy the new hooks
cp src/client/hooks/use-transactions.ts src/lib/hooks/use-transactions.ts.new

# Test the new hooks
# Once verified, replace the old file
mv src/lib/hooks/use-transactions.ts.new src/lib/hooks/use-transactions.ts
```

#### Step 4: Update imports in pages

**Update `src/app/dashboard/page.tsx`:**
```typescript
// Before
import { useTransactions } from '@/lib/hooks/use-transactions';

// After
import { useTransactions } from '@/client/hooks/use-transactions';
```

Or keep the old import path and update `tsconfig.json` paths.

---

### Phase 3: Migrate Other Features (4 hours)

Repeat the same process for:
1. Goals
2. Budgets
3. Recurring Transactions
4. Reminders
5. Health Score

For each feature:
1. Create service in `src/server/services/`
2. Update API routes to use service
3. Create/update hooks in `src/client/hooks/`
4. Update page imports

---

### Phase 4: Move Components (1 hour)

```bash
# Move UI components
mv src/components/ui src/client/components/ui

# Move layout components
mkdir -p src/client/components/layout
mv src/components/sidebar.tsx src/client/components/layout/

# Move feature components
mkdir -p src/client/components/features
# Move feature-specific components here
```

Update imports in all files.

---

### Phase 5: Cleanup (30 minutes)

#### 1. Remove old files
```bash
# Remove old API client
rm src/lib/api/client.ts

# Remove old hooks (after migration)
rm -rf src/lib/hooks

# Remove old stores (after migration)
rm -rf src/lib/stores

# Remove old utilities
rm src/lib/prisma.ts
```

#### 2. Update imports
Search and replace across the codebase:
- `@/lib/prisma` → `@/server/db/prisma`
- `@/lib/hooks` → `@/client/hooks`
- `@/lib/stores` → `@/client/stores`
- `@/components` → `@/client/components`

#### 3. Test everything
```bash
npm run dev
# Test all features
# Check for console errors
# Verify API calls work
```

---

## Testing Checklist

After migration, test:

- [ ] User can sign in/sign up
- [ ] Dashboard loads with data
- [ ] Can create/edit/delete transactions
- [ ] Can create/edit/delete goals
- [ ] Can create/edit/delete budgets
- [ ] Can create/edit/delete recurring transactions
- [ ] Can create/edit/delete reminders
- [ ] Health score calculates correctly
- [ ] Reports page works
- [ ] All animations work
- [ ] Mobile responsive works
- [ ] No console errors

---

## Common Issues & Solutions

### Issue 1: Import errors
**Error:** `Cannot find module '@/server/services/...'`

**Solution:** Update `tsconfig.json` paths:
```json
{
  "compilerOptions": {
    "paths": {
      "@/server/*": ["./src/server/*"]
    }
  }
}
```

### Issue 2: Prisma client not found
**Error:** `Cannot find module '@prisma/client'`

**Solution:**
```bash
npx prisma generate
```

### Issue 3: API routes return 500
**Error:** Internal server error

**Solution:** Check server logs, ensure:
- Services are exported correctly
- Database connection works
- Auth is configured

### Issue 4: Hooks not working
**Error:** `useQuery is not defined`

**Solution:** Ensure `QueryProvider` wraps your app in `layout.tsx`

---

## Performance Optimization

After migration:

1. **Add React Query caching:**
```typescript
export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get('/transactions'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

2. **Add service-level caching:**
```typescript
class TransactionService {
  private cache = new Map();

  async getSummary(userId: string) {
    const cacheKey = `summary:${userId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    const summary = await this.calculateSummary(userId);
    this.cache.set(cacheKey, summary);
    return summary;
  }
}
```

3. **Add database indexes:**
Already defined in Prisma schema with `@@index`

---

## Next Steps

1. **Add Tests:**
   - Unit tests for services
   - Integration tests for API routes
   - E2E tests for critical flows

2. **Add Documentation:**
   - API documentation
   - Service documentation
   - Component documentation

3. **Add Monitoring:**
   - Error tracking (Sentry)
   - Performance monitoring
   - User analytics

4. **Deploy:**
   - Set up CI/CD
   - Deploy to Vercel/AWS
   - Set up production database

---

## Need Help?

Refer to:
- `PROJECT_SUMMARY.md` - What the project does
- `ARCHITECTURE_DIAGRAM.md` - Visual architecture
- `MIGRATION_GUIDE.md` - Detailed migration steps
- `REFACTORING_PLAN.md` - Refactoring plan

Good luck with the migration! 🚀
