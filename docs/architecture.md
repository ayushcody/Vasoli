# Vasoli Architecture Diagram

## Current (Complex) Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
├─────────────────────────────────────────────────────────────┤
│  Pages (Mixed Client/Server)                                │
│  ├─ dashboard/page.tsx (Client Component)                   │
│  ├─ transactions/page.tsx (Server Component)                │
│  └─ goals/page.tsx (Client Component)                       │
│                                                              │
│  Components (Scattered)                                      │
│  ├─ components/sidebar.tsx                                  │
│  ├─ components/ui/*.tsx                                     │
│  └─ components/motion/*.tsx                                 │
│                                                              │
│  Hooks (Complex)                                            │
│  ├─ lib/hooks/use-transactions.ts (150 lines)              │
│  ├─ lib/hooks/use-goals.ts                                 │
│  └─ lib/hooks/use-budgets.ts                               │
│                                                              │
│  API Client (Over-engineered)                               │
│  └─ lib/api/client.ts (200+ lines)                         │
│      ├─ Retry logic                                         │
│      ├─ Token refresh                                       │
│      ├─ Request deduplication                               │
│      └─ Timeout handling                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Server                          │
├─────────────────────────────────────────────────────────────┤
│  API Routes (Business Logic Mixed In)                       │
│  ├─ api/transactions/route.ts (150 lines)                  │
│  │   ├─ Auth check                                          │
│  │   ├─ Validation                                          │
│  │   ├─ Database queries                                    │
│  │   ├─ Business logic                                      │
│  │   └─ Response formatting                                 │
│  ├─ api/goals/route.ts                                     │
│  └─ api/budgets/route.ts                                   │
│                                                              │
│  Utilities (Scattered)                                       │
│  ├─ lib/prisma.ts                                           │
│  ├─ lib/audit/audit-logger.ts                              │
│  ├─ lib/jobs/job-queue.ts                                  │
│  └─ lib/stores/ui-store.ts (???)                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       Database                               │
│                      SQLite + Prisma                         │
└─────────────────────────────────────────────────────────────┘
```

**Problems:**
- ❌ Mixed client/server code
- ❌ Business logic in API routes
- ❌ Over-engineered API client
- ❌ Scattered files
- ❌ Hard to test
- ❌ Hard to maintain

---

## New (Simple) Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                          │
├─────────────────────────────────────────────────────────────┤
│  Pages (Thin Routing Layer)                                 │
│  └─ app/(dashboard)/*/page.tsx                              │
│                                                              │
│  Components                                                  │
│  ├─ client/components/ui/                                   │
│  ├─ client/components/layout/                               │
│  └─ client/components/features/                             │
│                                                              │
│  Hooks (Simple)                                             │
│  ├─ client/hooks/use-transactions.ts (50 lines)            │
│  ├─ client/hooks/use-goals.ts                              │
│  └─ client/hooks/use-budgets.ts                            │
│                                                              │
│  Stores (UI Only)                                           │
│  └─ client/stores/ui-store.ts                              │
│                                                              │
│  API Client (Simple)                                        │
│  └─ client/lib/api.ts (50 lines)                           │
│      └─ Basic fetch wrapper                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Node.js)                          │
├─────────────────────────────────────────────────────────────┤
│  API Routes (Thin Layer)                                    │
│  ├─ app/api/transactions/route.ts (20 lines)               │
│  │   ├─ Auth check                                          │
│  │   ├─ Validation                                          │
│  │   └─ Call service                                        │
│  ├─ app/api/goals/route.ts                                 │
│  └─ app/api/budgets/route.ts                               │
│                            ↓
│  Services (Business Logic) ⭐ NEW!                          │
│  ├─ server/services/transaction.service.ts                 │
│  │   ├─ getAll()                                            │
│  │   ├─ getById()                                           │
│  │   ├─ create()                                            │
│  │   ├─ update()                                            │
│  │   ├─ delete()                                            │
│  │   └─ getSummary()                                        │
│  ├─ server/services/goal.service.ts                        │
│  ├─ server/services/budget.service.ts                      │
│  └─ server/services/health-score.service.ts                │
│                            ↓
│  Database Layer                                             │
│  └─ server/db/prisma.ts                                    │
│                                                              │
│  Utilities                                                   │
│  ├─ server/lib/validation.ts (Zod schemas)                 │
│  ├─ server/lib/utils.ts                                    │
│  └─ server/jobs/job-queue.ts                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       Database                               │
│                      SQLite + Prisma                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SHARED (Both)                             │
├─────────────────────────────────────────────────────────────┤
│  ├─ shared/types.ts (TypeScript interfaces)                │
│  └─ shared/constants.ts (App constants)                    │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Clear separation of concerns
- ✅ Business logic in services
- ✅ Simple API client
- ✅ Organized files
- ✅ Easy to test
- ✅ Easy to maintain

---

## Request Flow Example

### Before (Complex)
```
User clicks "Add Transaction"
    ↓
Component calls useCreateTransaction()
    ↓
Hook calls apiClient.post()
    ↓
API Client (200 lines):
  - Adds request ID
  - Sets up retry logic
  - Handles token refresh
  - Manages timeout
  - Deduplicates requests
    ↓
API Route (150 lines):
  - Checks auth
  - Parses request
  - Validates data
  - Checks splits
  - Creates transaction
  - Creates splits
  - Fetches result
  - Formats response
    ↓
Database
```

### After (Simple)
```
User clicks "Add Transaction"
    ↓
Component calls useCreateTransaction()
    ↓
Hook calls api.post() (simple fetch)
    ↓
API Route (20 lines):
  - requireAuth()
  - validate(data)
  - transactionService.create()
    ↓
Service (100 lines):
  - All business logic
  - Database operations
    ↓
Database
```

---

## File Organization

### Before
```
src/
├── app/
│   ├── api/
│   │   ├── transactions/route.ts (150 lines)
│   │   ├── goals/route.ts (120 lines)
│   │   └── budgets/route.ts (130 lines)
│   ├── dashboard/page.tsx (Client)
│   └── transactions/page.tsx (Server)
├── components/
│   ├── sidebar.tsx
│   ├── ui/
│   └── motion/
└── lib/
    ├── api/client.ts (200 lines)
    ├── hooks/
    ├── stores/
    ├── audit/
    ├── jobs/
    └── prisma.ts

Total: ~80 files, scattered
```

### After
```
src/
├── client/                    # Frontend
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   └── lib/
├── server/                    # Backend
│   ├── services/             # ⭐ NEW!
│   ├── db/
│   ├── jobs/
│   └── lib/
├── shared/                    # Both
│   ├── types.ts
│   └── constants.ts
└── app/                       # Routing
    ├── (dashboard)/
    └── api/

Total: ~50 files, organized
```

---

## Code Comparison

### API Route

**Before (150 lines):**
```typescript
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const categoryId = searchParams.get("categoryId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const where: any = { userId: (session.user as any).id }
    if (type) where.type = type
    if (categoryId) where.categoryId = categoryId
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        splits: { include: { category: true } },
      },
      orderBy: { date: "desc" },
    })
    return NextResponse.json(transactions)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

**After (20 lines):**
```typescript
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
```

### Service (NEW!)

```typescript
class TransactionService {
  async getAll(userId: string, filters?: {...}): Promise<Transaction[]> {
    const where: any = { userId };
    if (filters?.type) where.type = filters.type;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }
    return await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        splits: { include: { category: true } },
      },
      orderBy: { date: 'desc' },
    });
  }
}
```

---

## Summary

The new architecture is:
- **Simpler**: 30% less code
- **Clearer**: Know exactly where code belongs
- **Testable**: Services are independent
- **Maintainable**: Easy to modify
- **Scalable**: Easy to add features

**Key Principle**: Separate Client, Server, and Shared code clearly!
