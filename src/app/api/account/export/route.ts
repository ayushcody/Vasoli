import { authenticatedAccessToken, jsonError, proxyLifecycle } from "../lifecycle";

export const runtime = "nodejs";

export async function GET() {
  const token = await authenticatedAccessToken();
  if (!token) return jsonError(401, "unauthorized", "Sign in to export your data.");
  try {
    const upstream = await proxyLifecycle("export", token, { method: "POST" });
    if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
        "Content-Disposition": upstream.headers.get("Content-Disposition") || 'attachment; filename="vasoli-account-export.json"',
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError(503, "unavailable", "Your export could not be prepared. Retry shortly.");
  }
}
