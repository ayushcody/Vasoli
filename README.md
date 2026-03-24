# Vasoli - Smart Personal Finance

AI-powered personal finance management application.

> [!NOTE]
> Detailed documentation is now available in the [docs](./docs) directory.

## Features

### Phase 1 (MVP)
- User authentication with email/password
- Transaction tracking (income/expenses)
- Budget management
- Basic reporting and analytics
- Receipt OCR scanning
- AI-powered insights

### Phase 2 Enhancements

#### Feature Expansion
- **Recurring Transactions**: Automate regular income and expenses with flexible scheduling (daily, weekly, biweekly, monthly, quarterly, yearly)
- **Split Transactions**: Divide transactions across multiple categories for accurate tracking
- **Financial Goals**: Set savings targets with progress tracking and milestone notifications
- **Financial Health Score**: Comprehensive wellness score based on savings rate, budget adherence, goal progress, spending consistency, and emergency fund coverage
- **Reminders & Notifications**: Multi-channel reminder system for bills, goals, budgets, and recurring transactions

#### UI/UX Polish
- **Motion & Animations**: Framer Motion-powered page transitions, staggered list animations, and micro-interactions
- **Storytelling Dashboard**: Empty states with guided onboarding flows
- **Animated Components**: Progress bars with smooth transitions, circular progress indicators, number counters
- **Responsive Design**: Collapsible sidebar, mobile-optimized navigation, touch-friendly interactions
- **Toast Notifications**: Rich toast system with Sonner

#### State Management
- **React Query**: Server state management with caching, background refetching, and optimistic updates
- **Zustand Stores**: Client state for UI, chat sessions, form drafts, and filter preferences
- **Centralized API Client**: Retry logic, automatic token refresh, request deduplication

#### Backend Hardening
- **Authentication Enhancements**: 
  - Account lockout after failed attempts
  - Refresh token system for session management
  - Rate limiting on auth endpoints
  - Comprehensive password strength requirements
- **Audit Logging**: Immutable activity logs for all CRUD operations with before/after snapshots
- **Job Queue System**: Background processing for recurring transactions, OCR, health score calculations, and notifications
- **Caching Layer**: React Query client-side caching with strategic invalidation

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with class-variance-authority
- **Database**: SQLite (Prisma ORM)
- **Authentication**: NextAuth.js with credentials provider
- **State Management**: React Query + Zustand
- **Animations**: Framer Motion
- **Form Validation**: Zod
- **Date Utilities**: date-fns

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd vasoli-mvp
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables locally:
```bash
# Copy the example environment files
cp .env.example .env
cp backend/.env.example backend/.env

# Open .env and backend/.env to fill in your actual configuration values
```

4. Initialize the database:
```bash
npx prisma migrate dev
npx prisma generate
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Environment Variables

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

## Database Schema

The application uses the following main entities:

- **User**: Core user accounts with auth metadata
- **Transaction**: Individual income/expense records
- **TransactionSplit**: Multi-category allocations
- **RecurringTransaction**: Scheduled transaction templates
- **Goal**: Savings targets with contributions tracking
- **GoalContribution**: Individual contributions to goals
- **Budget**: Spending limits with category associations
- **Reminder**: User notifications and alerts
- **FinancialHealthScore**: Historical health score records
- **Session**: Active user sessions
- **AuditLog**: Activity tracking for compliance
- **JobQueue**: Background job processing
- **Category**: Transaction categorization

## API Routes

### Authentication
- `POST /api/auth/signin` - User login
- `POST /api/auth/register` - User registration
- `POST /api/user/refresh-token` - Refresh access token

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `PATCH /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Recurring Transactions
- `GET /api/recurring` - List recurring
- `POST /api/recurring` - Create recurring
- `PATCH /api/recurring/:id` - Update recurring
- `DELETE /api/recurring/:id` - Delete recurring

### Goals
- `GET /api/goals` - List goals
- `POST /api/goals` - Create goal
- `GET /api/goals/:id` - Get goal details
- `PATCH /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal
- `POST /api/goals/:id/contributions` - Add contribution

### Reminders
- `GET /api/reminders` - List reminders
- `POST /api/reminders` - Create reminder
- `PATCH /api/reminders/:id` - Update reminder
- `DELETE /api/reminders/:id` - Delete reminder
- `PATCH /api/reminders/:id/complete` - Mark complete
- `PATCH /api/reminders/:id/snooze` - Snooze reminder

### Health Score
- `GET /api/health-score` - Get current score
- `POST /api/health-score` - Calculate new score
- `GET /api/health-score/history` - Score history

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

### Project Structure

```
src/
├── app/                 # Next.js app router pages
│   ├── api/            # API routes
│   ├── auth/           # Authentication pages
│   ├── dashboard/      # Dashboard page
│   ├── goals/          # Goals management
│   ├── reminders/      # Reminders management
│   └── ...
├── components/         # React components
│   ├── motion/         # Animation components
│   ├── ui/             # UI primitives
│   └── ...
├── lib/                # Utility functions
│   ├── api/            # API client
│   ├── audit/          # Audit logging
│   ├── hooks/          # React Query hooks
│   ├── jobs/           # Job queue system
│   └── stores/         # Zustand stores
└── ...
```

## Deployment

### Build for Production

```bash
npm run build
```

### Environment Variables for Production

Ensure all environment variables are set for production:
- `DATABASE_URL`
- `NEXTAUTH_SECRET` (generate a strong random string)
- `NEXTAUTH_URL` (your production URL)

## Documentation

The project documentation is organized in the [`docs/`](./docs) directory:

- [**Architecture**](./docs/architecture.md): Overview of the system design and request flow.
- [**Phase 2 Plan**](./docs/phase2-plan.md): Detailed implementation plan for the current phase.
- [**Phase 2 Summary**](./docs/phase2-summary.md): Summary of implemented features in Phase 2.
- [**Design System**](./docs/design-system.md): Documentation for the Neo-Brutal design system.
- [**Project Summary**](./docs/project-summary.md): High-level overview and refactoring metrics.

### Guides
- [**Quick Start Guide**](./docs/guides/quick-start.md)
- [**Supabase Migration**](./docs/guides/supabase-migration.md)

## License


MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
