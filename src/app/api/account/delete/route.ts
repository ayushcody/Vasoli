import { authenticatedAccessToken, jsonError, proxyLifecycle, requestHasSameOrigin } from "../lifecycle";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return jsonError(403, "forbidden", "Cross-origin account changes are not allowed.");
  const token = await authenticatedAccessToken();
  if (!token) return jsonError(401, "unauthorized", "Sign in to delete your account.");
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError(400, "invalid_request", "Deletion request is invalid."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "invalid_request", "Deletion request is invalid.");
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["idempotencyKey", "confirm"].includes(key)) || typeof value.idempotencyKey !== "string" || !UUID.test(value.idempotencyKey) || value.confirm !== "DELETE") {
    return jsonError(400, "invalid_request", "Confirm account deletion and retry.");
  }
  try {
    const upstream = await proxyLifecycle("delete", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return jsonError(503, "unavailable", "Deletion could not be started. Retry safely.");
  }
}

export async function GET(request: Request) {
  const token = await authenticatedAccessToken();
  if (!token) return jsonError(401, "unauthorized", "Sign in to check deletion status.");
  const requestId = new URL(request.url).searchParams.get("requestId") || "";
  if (!UUID.test(requestId)) return jsonError(400, "invalid_request", "Deletion request id is invalid.");
  try {
    const upstream = await proxyLifecycle(`delete/${encodeURIComponent(requestId)}`, token, { method: "GET" });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return jsonError(503, "unavailable", "Deletion status is temporarily unavailable.");
  }
}
