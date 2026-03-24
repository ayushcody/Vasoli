# Connect-RPC vs Next.js REST — Benchmark Results

## Environment

| Component | Details |
|-----------|---------|
| Machine | MacBook (Apple Silicon) |
| OS | macOS Sequoia |
| Go | 1.25.0 |
| Node.js | Next.js 14.2.35 |
| Connect-RPC | `connectrpc.com/connect` v1.19.1 |
| Benchmark tool | `hey` v0.1.5 |
| Test config | 1,000 requests, 50 concurrent |
| Date | 2026-03-04 |

## Test Design

### What's being compared

| Layer | Connect-RPC (Go) | Next.js REST (Node.js) |
|-------|-------------------|------------------------|
| Runtime | Go binary (compiled) | Node.js (V8 JIT) |
| Transport | HTTP/2 via h2c | HTTP/1.1 via Next.js dev server |
| Serialization | JSON (Connect protocol) | JSON |
| Auth | JWT interceptor (in-memory) | Supabase `getUser()` (external call) or none |
| Data source | Mock (in-memory) | Prisma (static data) |

> [!NOTE]
> This is **not** a pure serialization benchmark. The comparison includes the full stack: runtime, framework overhead, and auth mechanism. The Connect-RPC handlers return mock data from memory, while the Next.js API route returns a static category list from Prisma. Both cases involve minimal computation.

---

## Raw Results

### Benchmark 1: Connect-RPC JSON — `UserService.GetProfile`

```
POST http://localhost:8080/vasoli.v1.UserService/GetProfile
Body: {"id":"bench-user"}
Auth: JWT Bearer token (HMAC-SHA256 verification)
```

| Metric | Value |
|--------|-------|
| **Requests/sec** | **28,196** |
| p50 latency | 1.1 ms |
| p95 latency | 4.5 ms |
| p99 latency | 7.5 ms |
| Fastest | 0.1 ms |
| Slowest | 10.5 ms |
| Response size | 74 bytes |
| Status codes | 1000 × 200 |

### Benchmark 2: Connect-RPC JSON — `TransactionService.ListTransactions`

```
POST http://localhost:8080/vasoli.v1.TransactionService/ListTransactions
Body: {}
Auth: JWT Bearer token
```

| Metric | Value |
|--------|-------|
| **Requests/sec** | **26,152** |
| p50 latency | 1.2 ms |
| p95 latency | 5.9 ms |
| p99 latency | 9.9 ms |
| Fastest | 0.1 ms |
| Slowest | 11.7 ms |
| Response size | ~20 bytes (empty list) |
| Status codes | 1000 × 200 |

### Benchmark 3: Next.js REST — `GET /api/categories`

```
GET http://localhost:3000/api/categories
Auth: None (static data endpoint)
```

| Metric | Value |
|--------|-------|
| **Requests/sec** | **754** |
| p50 latency | 40.7 ms |
| p95 latency | 225 ms |
| p99 latency | 433 ms |
| Fastest | 15 ms |
| Slowest | 439 ms |
| Response size | 4,010 bytes |
| Status codes | 1000 × 200 |

---

## Comparison Scores

Scores compare Connect-RPC GetProfile (with JWT auth) vs Next.js REST categories (without auth).

| Score | Formula | Value | Interpretation |
|-------|---------|-------|----------------|
| **Latency Score** | REST_p95 ÷ gRPC_p95 × 100 | **5,000** | Connect-RPC p95 is 50× faster |
| **Throughput Score** | gRPC_rps ÷ REST_rps × 100 | **3,740** | Connect-RPC handles 37× more requests/sec |
| **Payload Score** | REST_payload ÷ gRPC_payload × 100 | **5,419** | REST response is 54× larger (different data) |

> [!IMPORTANT]
> The Payload Score is misleading — the endpoints return different data (74-byte user profile vs 4,010-byte category list). Ignore it for the gRPC-vs-REST comparison.

---

## Honest Interpretation

### Why the gap is so large

The 37× throughput difference is real but needs context:

1. **Runtime difference**: Go's goroutine scheduler handles 50 concurrent connections with near-zero overhead. Node.js single-threaded event loop has higher per-request cost, especially in a dev server.
2. **Framework overhead**: Next.js dev server adds webpack HMR, middleware chain, and RSC rendering overhead. A production `next build` + `next start` would narrow the gap significantly.
3. **Auth overhead**: The Next.js benchmark has no auth, but other API routes call `supabase.auth.getUser()` — an external HTTP call per request. Connect-RPC validates JWT locally (pure crypto, no network).
4. **Apples-to-oranges**: Connect-RPC returns a 74-byte mock response from memory. Next.js returns 4KB from Prisma. These are not equivalent workloads.

### What this means for Vasoli

| Use Case | Better With |
|----------|-------------|
| High-volume reads (transaction list, analytics) | Connect-RPC (Go) — pre-compiled, no cold start |
| CRUD with Prisma validation | Next.js API routes — collocated with ORM, simpler |
| Real-time sync / streaming | Connect-RPC — supports server streaming natively |
| Auth-heavy flows (signup, OAuth) | Next.js — Supabase SSR integration is seamless |

### What would make this a fairer benchmark

1. Run Next.js in **production mode** (`next build && next start`)
2. Both endpoints should return **identical data**
3. Both should include **the same auth mechanism** (JWT verify vs external call)
4. Use binary protobuf encoding in Connect-RPC (estimated ~30% smaller payloads)

---

## Commands to Reproduce

```bash
# 1. Generate test JWT
node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({sub:'bench-user',role:'authenticated',exp:9999999999})).toString('base64url');
const sig = crypto.createHmac('sha256','D952C8E6-6027-4DF5-896A-0B511265E325').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
"

# 2. Run Connect-RPC benchmark
TOKEN="<paste-jwt-here>"
hey -n 1000 -c 50 -m POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"id":"bench-user"}' \
  http://localhost:8080/vasoli.v1.UserService/GetProfile

# 3. Run Next.js REST benchmark
hey -n 1000 -c 50 http://localhost:3000/api/categories
```
