# Vasoli Phase 2 Implementation Plan

## Plan Summary

Phase 2 elevates Vasoli from MVP to production-ready by delivering new money-management capabilities, a polished interface, and a stronger platform foundation.

- **Feature expansion:** Recurring and split transactions, savings goals, analytics/insights, financial health scoring, and reminders.
- **UI/UX polish:** Motion-driven interactions, responsive refinements, and visual enhancements across core surfaces.
- **State and data management:** React Query for server state, Zustand for client state, plus caching strategies.
- **Backend hardening:** Auth improvements, audit logs, job queues, and structured background processing.
- **Phased delivery:** Foundation, features, intelligence, and polish milestones across an 8-week timeline.

## Executive Summary

Phase 2 focuses on expanding feature capabilities, polishing UI/UX, and strengthening the technical foundation for user/data storage/state management. This plan outlines the key initiatives to transform Vasoli from an MVP to a production-ready personal finance platform.

---

## 1. Feature Expansion

### 1.1 Recurring Transactions
**Current State:** Manual transaction entry only
**Target:** Automated recurring transaction support

#### Implementation:
- Add `RecurringTransaction` model to schema
- Support frequencies: DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY
- Create background job to generate transactions
- Add UI for managing recurring patterns
- Include end-date or occurrence count limits

#### Schema Addition:
```prisma
model RecurringTransaction {
  id          String   @id @default(cuid())
  amount      Float
  description String
  type        String   @default("EXPENSE")
  frequency   String   // DAILY, WEEKLY, MONTHLY, etc.
  startDate   DateTime
  endDate     DateTime?
  occurrences Int?     // Alternative to endDate
  lastRun     DateTime?
  
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id])
  
  transactions Transaction[] @relation("RecurringSource")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 1.2 Split Transactions
**Current State:** Single-category transactions only
**Target:** Multi-category split support

#### Implementation:
- Add `TransactionSplit` model for partial allocations
- Modify transaction form to support splits
- Ensure total split amounts equal transaction amount
- Update reporting to account for splits

#### Schema Addition:
```prisma
model TransactionSplit {
  id            String      @id @default(cuid())
  amount        Float
  description   String?
  
  transactionId String
  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  categoryId    String
  category      Category    @relation(fields: [categoryId], references: [id])
  
  createdAt     DateTime    @default(now())
}
```

### 1.3 Financial Goals
**Current State:** Budget tracking only
**Target:** Goal-based savings with progress tracking

#### Implementation:
- Create `Goal` model with target amounts and deadlines
- Link transactions to goals for contributions
- Visual progress indicators
- Milestone notifications

#### Schema Addition:
```prisma
model Goal {
  id          String   @id @default(cuid())
  name        String
  description String?
  targetAmount Float
  currentAmount Float @default(0)
  deadline    DateTime?
  status      String   @default("ACTIVE") // ACTIVE, COMPLETED, PAUSED
  
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  contributions GoalContribution[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model GoalContribution {
  id          String   @id @default(cuid())
  amount      Float
  note        String?
  
  goalId      String
  goal        Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  transactionId String?
  transaction  Transaction? @relation(fields: [transactionId], references: [id])
  
  createdAt   DateTime @default(now())
}
```

### 1.4 Insights & Analytics
**Current State:** Basic spending reports
**Target:** AI-powered insights with actionable recommendations

#### Implementation:
- Expand DailyInsight model with structured data
- Add trend analysis (spending velocity, anomalies)
- Category comparison and benchmarking
- Predictive forecasts

### 1.5 Financial Health Score
**Current State:** No holistic health metric
**Target:** Comprehensive financial wellness score

#### Implementation:
- Create scoring algorithm based on:
  - Savings rate
  - Debt-to-income ratio
  - Budget adherence
  - Emergency fund coverage
  - Spending diversification
- Historical score tracking
- Personalized improvement tips

#### Schema Addition:
```prisma
model FinancialHealthScore {
  id          String   @id @default(cuid())
  score       Int      // 0-100
  components  String   // JSON of score breakdown
  factors     String   // JSON of influencing factors
  
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date        DateTime @default(now())
}
```

### 1.6 Reminders & Notifications
**Current State:** No reminder system
**Target:** Multi-channel reminder framework

#### Implementation:
- Create `Reminder` model with flexible triggers
- Support types: BILL_DUE, GOAL_MILESTONE, BUDGET_ALERT, RECURRING_REVIEW
- In-app and (future) email/push notifications
- Snooze and dismiss actions

#### Schema Addition:
```prisma
model Reminder {
  id          String   @id @default(cuid())
  title       String
  description String?
  type        String   // BILL_DUE, GOAL_MILESTONE, BUDGET_ALERT
  dueDate     DateTime
  status      String   @default("PENDING") // PENDING, SNOOZED, COMPLETED, DISMISSED
  snoozeUntil DateTime?
  
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## 2. UI/UX Polish & Motion

### 2.1 Animation Framework
- Add Framer Motion for declarative animations
- Implement page transitions
- Add micro-interactions (button states, form validation)
- Loading skeletons for async content

### 2.2 Enhanced Components
- Animated number counters for financial displays
- Progress bars with smooth transitions
- Toast notification system
- Modal/dialog transitions
- Staggered list animations

### 2.3 Responsive Improvements
- Mobile-first refinements
- Touch-friendly gesture support
- Collapsible sidebar for smaller screens
- Bottom navigation for mobile

### 2.4 Visual Polish
- Gradient backgrounds and cards
- Glass morphism effects
- Hover state enhancements
- Focus ring improvements for accessibility

---

## 3. State Management Overhaul

### 3.1 Server State Management
**Current State:** Direct server-side data fetching
**Target:** React Query for server state

#### Implementation:
- Install @tanstack/react-query
- Create query hooks for:
  - useTransactions()
  - useBudgets()
  - useCategories()
  - useGoals()
  - useInsights()
- Implement optimistic updates
- Add automatic background refetching
- Cache invalidation strategies

### 3.2 Client State Management
**Current State:** React useState/useContext only
**Target:** Zustand for complex client state

#### Implementation:
- Install zustand
- Create stores for:
  - UI state (sidebar, modals, toasts)
  - Filter/sort preferences
  - Form drafts
  - Chat session state
- Implement persistence where needed

### 3.3 Migration Strategy
1. Identify all data fetching patterns
2. Create query hooks layer
3. Migrate pages incrementally
4. Add error boundaries
5. Implement loading states

---

## 4. Backend Hardening

### 4.1 Authentication Enhancements
**Current State:** Basic NextAuth credentials provider

#### Improvements:
- Rate limiting on auth endpoints
- Account lockout after failed attempts
- Password strength requirements
- Session management (revoke all sessions)
- Email verification flow
- OAuth provider support (Google, GitHub)
- Two-factor authentication (2FA)

#### Schema Addition:
```prisma
model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token        String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  lastUsedAt   DateTime?
  ipAddress    String?
  userAgent    String?
}

model VerificationToken {
  id         String   @id @default(cuid())
  email      String
  token      String   @unique
  type       String   // EMAIL_VERIFICATION, PASSWORD_RESET
  expiresAt  DateTime
  createdAt  DateTime @default(now())
}
```

### 4.2 Audit Logging
**Current State:** No audit trail
**Target:** Comprehensive activity logging

#### Implementation:
- Create `AuditLog` model
- Log all CRUD operations
- Track data changes (before/after)
- Immutable log entries
- Admin/self audit viewing

#### Schema Addition:
```prisma
model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  action      String   // CREATE, UPDATE, DELETE, LOGIN, LOGOUT
  entityType  String   // Transaction, Budget, Goal, etc.
  entityId    String?
  before      String?  // JSON snapshot
  after       String?  // JSON snapshot
  metadata    String?  // Additional context
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([entityType, entityId])
}
```

### 4.3 Job Queue System
**Current State:** Synchronous processing only
**Target:** Background job processing

#### Implementation:
- Implement using Bull/BullMQ with Redis
- Or: Inngest for serverless-friendly jobs
- Jobs needed:
  - Recurring transaction generation
  - Daily insight generation
  - Health score calculation
  - Email notifications
  - Receipt OCR processing
  - Report generation

#### Schema Addition:
```prisma
model JobQueue {
  id          String   @id @default(cuid())
  type        String
  payload     String   // JSON
  status      String   @default("PENDING") // PENDING, PROCESSING, COMPLETED, FAILED
  attempts    Int      @default(0)
  maxAttempts Int      @default(3)
  error       String?
  runAt       DateTime @default(now())
  processedAt DateTime?
  completedAt DateTime?
  createdAt   DateTime @default(now())
  
  @@index([status, runAt])
  @@index([type])
}
```

### 4.4 Caching Layer
**Current State:** No caching
**Target:** Multi-tier caching strategy

#### Implementation:
- React Query caching (client-side)
- Redis caching for:
  - User sessions
  - Aggregated reports
  - Daily insights
  - Category lookups
- Prisma query result caching
- Cache invalidation hooks

---

## 5. Database Schema Updates

### Complete Schema Changes:

```prisma
// Updated User model
model User {
  id                    String    @id @default(cuid())
  email                 String    @unique
  emailVerified         DateTime?
  password              String
  name                  String?
  avatarUrl             String?
  twoFactorEnabled      Boolean   @default(false)
  twoFactorSecret       String?
  failedLoginAttempts   Int       @default(0)
  lockedUntil           DateTime?
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  // Relations
  transactions          Transaction[]
  budgets               Budget[]
  onboarding            Onboarding?
  recurringTransactions RecurringTransaction[]
  goals                 Goal[]
  reminders             Reminder[]
  healthScores          FinancialHealthScore[]
  sessions              Session[]
  auditLogs             AuditLog[]
}

// Updated Transaction model
model Transaction {
  id                String   @id @default(cuid())
  amount            Float
  description       String
  date              DateTime
  type              String   @default("EXPENSE")
  receiptUrl        String?
  
  // Recurring support
  isRecurring       Boolean  @default(false)
  recurringId       String?
  recurringSource   RecurringTransaction? @relation("RecurringSource", fields: [recurringId], references: [id])
  
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  categoryId        String?
  category          Category? @relation(fields: [categoryId], references: [id])
  
  // Split support
  splits            TransactionSplit[]
  goalContributions GoalContribution[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId, date])
  @@index([userId, type])
  @@index([categoryId])
}

// ... (other models from above)
```

---

## 6. Implementation Phases

### Phase 2A: Foundation (Weeks 1-2)
1. Set up React Query and Zustand
2. Implement audit logging middleware
3. Add caching layer (Redis)
4. Create job queue infrastructure
5. Database schema migrations

### Phase 2B: Features (Weeks 3-4)
1. Recurring transactions UI and API
2. Split transactions support
3. Goals module (CRUD + contributions)
4. Reminders system

### Phase 2C: Intelligence (Weeks 5-6)
1. Enhanced insights engine
2. Financial health score calculation
3. Trend analysis
4. Background jobs for data processing

### Phase 2D: Polish (Weeks 7-8)
1. Framer Motion animations
2. UI component enhancements
3. Mobile responsiveness
4. Auth hardening

---

## 7. Dependencies to Add

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x",
    "zustand": "^4.x",
    "framer-motion": "^11.x",
    "bull": "^4.x", // or @inngest
    "ioredis": "^5.x",
    "rate-limiter-flexible": "^5.x",
    "speakeasy": "^2.x" // For 2FA
  }
}
```

---

## 8. Success Metrics

- **User Engagement:** 30% increase in daily active users
- **Feature Adoption:** 50% of users create at least one goal
- **Performance:** <100ms average API response time
- **Reliability:** 99.9% uptime with background job processing
- **Security:** Zero auth-related security incidents

---

## 9. Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Schema migration complexity | Create comprehensive rollback scripts |
| State management migration | Incremental adoption, maintain backward compatibility |
| Job queue reliability | Implement dead letter queues, alerting |
| Performance degradation | Load testing, query optimization |
| Security vulnerabilities | Security audit, penetration testing |

---

## 10. Next Steps

1. Review and approve this plan
2. Create detailed technical specifications
3. Set up development environment with new dependencies
4. Begin Phase 2A implementation
5. Weekly progress reviews and adjustments

---

*Document generated based on Phase 2 exploration findings*
*Date: Generated upon completion of exploration*
