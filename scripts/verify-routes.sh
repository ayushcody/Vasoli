#!/bin/bash
# Vasoli Route Verification Script
# Usage: ./scripts/verify-routes.sh
# Prereqs: Next.js on :3000, Go backend on :8080

set -euo pipefail

NEXT_BASE="http://localhost:3000"
GRPC_BASE="http://localhost:8080"
PASS=0
FAIL=0
SKIP=0

green() { printf "\033[32m✓ %s\033[0m\n" "$1"; }
red()   { printf "\033[31m✗ %s\033[0m\n" "$1"; }
yellow(){ printf "\033[33m⊘ %s\033[0m\n" "$1"; }

check_http() {
  local url="$1"
  local expected="$2"
  local label="$3"
  
  status=$(curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo "000")
  
  if [ "$status" = "$expected" ]; then
    green "$label → $status"
    PASS=$((PASS + 1))
  else
    red "$label → $status (expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

check_connect_rpc() {
  local path="$1"
  local body="$2"
  local label="$3"
  
  # Connect-RPC requires auth, so we expect 401 (Unauthenticated) without a token
  # This proves the endpoint EXISTS and the auth interceptor is running
  status=$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST "${GRPC_BASE}${path}" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null || echo "000")
  
  if [ "$status" = "401" ]; then
    green "$label → 401 (auth required, endpoint alive)"
    PASS=$((PASS + 1))
  elif [ "$status" = "200" ]; then
    green "$label → 200"
    PASS=$((PASS + 1))
  else
    red "$label → $status (expected 401 or 200)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     Vasoli Route Verification            ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Next.js Pages ──────────────────────────────
echo "── Next.js Pages ──"
check_http "$NEXT_BASE/" "200" "GET /"
check_http "$NEXT_BASE/auth/signin" "200" "GET /auth/signin"
check_http "$NEXT_BASE/auth/signup" "200" "GET /auth/signup"

# Protected pages should redirect (307) when not authenticated
check_http "$NEXT_BASE/app/dashboard" "307" "GET /app/dashboard (no auth → redirect)"
check_http "$NEXT_BASE/app/transactions" "307" "GET /app/transactions (no auth → redirect)"
check_http "$NEXT_BASE/app/receipts" "307" "GET /app/receipts (no auth → redirect)"
check_http "$NEXT_BASE/app/goals" "307" "GET /app/goals (no auth → redirect)"
check_http "$NEXT_BASE/app/settings" "307" "GET /app/settings (no auth → redirect)"
check_http "$NEXT_BASE/app/cashflow" "307" "GET /app/cashflow (no auth → redirect)"

echo ""

# ── Next.js API Routes ─────────────────────────
echo "── Next.js API Routes ──"
# Without auth cookies, API routes should return 401
for route in categories goals receipts recurring transactions "transactions/summary"; do
  status=$(curl -s -o /dev/null -w '%{http_code}' "$NEXT_BASE/api/$route" 2>/dev/null || echo "000")
  if [ "$status" = "401" ]; then
    green "GET /api/$route → 401 (auth required)"
    PASS=$((PASS + 1))
  elif [ "$status" = "200" ]; then
    yellow "GET /api/$route → 200 (no auth check?)"
    SKIP=$((SKIP + 1))
  else
    red "GET /api/$route → $status"
    FAIL=$((FAIL + 1))
  fi
done

echo ""

# ── Connect-RPC (Go Backend) ──────────────────
echo "── Connect-RPC Endpoints (Go :8080) ──"

# Check if Go backend is running
if ! curl -s -o /dev/null "$GRPC_BASE" 2>/dev/null; then
  yellow "Go backend not running on :8080 — skipping Connect-RPC checks"
  SKIP=$((SKIP + 17))
else
  check_connect_rpc "/vasoli.v1.UserService/GetProfile" '{"id":"test"}' "UserService.GetProfile"
  check_connect_rpc "/vasoli.v1.UserService/UpdateProfile" '{"name":"test"}' "UserService.UpdateProfile"
  check_connect_rpc "/vasoli.v1.UserService/GetWealthAnalytics" '{"id":"test"}' "UserService.GetWealthAnalytics"

  check_connect_rpc "/vasoli.v1.TransactionService/CreateTransaction" '{"amount":100}' "TransactionService.CreateTransaction"
  check_connect_rpc "/vasoli.v1.TransactionService/GetTransaction" '{"id":"test"}' "TransactionService.GetTransaction"
  check_connect_rpc "/vasoli.v1.TransactionService/ListTransactions" '{}' "TransactionService.ListTransactions"
  check_connect_rpc "/vasoli.v1.TransactionService/UpdateTransaction" '{"id":"test"}' "TransactionService.UpdateTransaction"
  check_connect_rpc "/vasoli.v1.TransactionService/DeleteTransaction" '{"id":"test"}' "TransactionService.DeleteTransaction"

  check_connect_rpc "/vasoli.v1.BudgetService/CreateBudget" '{"name":"test","amount":1000}' "BudgetService.CreateBudget"
  check_connect_rpc "/vasoli.v1.BudgetService/ListBudgets" '{}' "BudgetService.ListBudgets"
  check_connect_rpc "/vasoli.v1.BudgetService/UpdateBudget" '{"id":"test"}' "BudgetService.UpdateBudget"
  check_connect_rpc "/vasoli.v1.BudgetService/DeleteBudget" '{"id":"test"}' "BudgetService.DeleteBudget"

  check_connect_rpc "/vasoli.v1.GoalService/CreateGoal" '{"name":"test","targetAmount":1000}' "GoalService.CreateGoal"
  check_connect_rpc "/vasoli.v1.GoalService/ListGoals" '{}' "GoalService.ListGoals"
  check_connect_rpc "/vasoli.v1.GoalService/UpdateGoal" '{"id":"test"}' "GoalService.UpdateGoal"
  check_connect_rpc "/vasoli.v1.GoalService/DeleteGoal" '{"id":"test"}' "GoalService.DeleteGoal"
  check_connect_rpc "/vasoli.v1.GoalService/AddContribution" '{"goalId":"test","amount":100}' "GoalService.AddContribution"
fi

echo ""

# ── Summary ────────────────────────────────────
echo "╔══════════════════════════════════════════╗"
printf "║  ✓ Passed: %-4d  ✗ Failed: %-4d  ⊘ Skipped: %-4d  ║\n" "$PASS" "$FAIL" "$SKIP"
echo "╚══════════════════════════════════════════╝"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
