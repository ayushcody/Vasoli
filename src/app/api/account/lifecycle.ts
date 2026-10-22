import { createClient } from "@/lib/supabase/server";

// Vercel injects this binding at runtime. RPC_BACKEND_URL remains the local-dev fallback.
const backendURL = (process.env.VASOLI_BACKEND_URL || process.env.RPC_BACKEND_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");

export async function authenticatedAccessToken() {
  const supabase = createClient();
  const [{ data: userData, error: userError }, { data: sessionData, error: sessionError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if (userError || sessionError || !userData.user || !sessionData.session?.access_token) return null;
  return sessionData.session.access_token;
}

export async function proxyLifecycle(path: string, token: string, init?: RequestInit) {
  return fetch(`${backendURL}/lifecycle/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function requestHasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const parsedOrigin = new URL(origin);
    const requestURL = new URL(request.url);
    const requestHost = request.headers.get("host") || requestURL.host;
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
    const requestProtocol = forwardedProtocol ? `${forwardedProtocol}:` : requestURL.protocol;
    return parsedOrigin.host === requestHost && parsedOrigin.protocol === requestProtocol;
  } catch { return false; }
}
