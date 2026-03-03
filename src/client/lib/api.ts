import { createClient, Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { UserService } from "../../gen/vasoli/v1/user_connect";
import { TransactionService } from "../../gen/vasoli/v1/transaction_connect";
import { BudgetService } from "../../gen/vasoli/v1/budget_connect";
import { GoalService } from "../../gen/vasoli/v1/goal_connect";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

// Auth Interceptor for gRPC Requests
const authInterceptor: Interceptor = (next) => async (req) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    req.header.set("Authorization", `Bearer ${session.access_token}`);
  }
  return await next(req);
};

// gRPC Web Transport
const transport = createConnectTransport({
  baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080",
  interceptors: [authInterceptor],
});

// Export typed clients
export const userClient = createClient(UserService, transport);
export const transactionClient = createClient(TransactionService, transport);
export const budgetClient = createClient(BudgetService, transport);
export const goalClient = createClient(GoalService, transport);
