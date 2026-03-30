// ARCHITECTURE CONTRACT
// All finance domain data is fetched exclusively via ConnectRPC clients (src/gen/vasoli/v1/).
// No component or page may import Prisma, Supabase table queries, or the legacy REST client
// for finance data. Supabase is used only for auth token management.
// Hooks in src/lib/hooks/ are the only permitted data-fetching layer for page components.

export * from './query-provider';
export * from './use-transactions';
export * from './use-goals';
export * from './use-budgets';
export * from './use-categories';
export * from './use-recurring';
export * from './use-reminders';
export * from './use-health-score';
export * from './use-receipts';
