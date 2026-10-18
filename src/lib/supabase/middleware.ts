import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function redirectOnRequestHost(request: NextRequest, response: NextResponse, pathname: string) {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = "";

    // Next dev can canonicalize loopback hosts (127.0.0.1 ↔ localhost). Keep
    // redirects on the incoming loopback host so Supabase cookies stay scoped
    // to the same origin. In production, accept only Next's trusted URL host.
    if (process.env.NODE_ENV !== "production") {
        const incomingHost = request.headers.get("host");
        if (incomingHost) {
            const hostname = incomingHost.split(":")[0].replace(/^\[|\]$/g, "");
            const requestIsLoopback = ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname);
            const incomingIsLoopback = ["localhost", "127.0.0.1", "::1"].includes(hostname);
            if (requestIsLoopback && incomingIsLoopback) target.host = incomingHost;
        }
    }

    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Wrap getUser in try/catch — if Supabase is unreachable or token
    // validation fails, treat the request as unauthenticated instead of
    // crashing the entire middleware with an unhandled 500.
    let user = null;
    try {
        const { data, error } = await supabase.auth.getUser();
        if (!error) {
            user = data.user;
        }
    } catch (err) {
        console.error("[middleware] supabase.auth.getUser() failed:", err);
        // Continue as unauthenticated — route-level checks will handle 401/redirect
    }

    // Protect /app/* routes — redirect to signin if unauthenticated
    const bypassAuth = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";
    if (
        !bypassAuth &&
        !user &&
        request.nextUrl.pathname.startsWith("/app")
    ) {
        const redirect = redirectOnRequestHost(request, supabaseResponse, "/auth/signin");
        const url = new URL(redirect.headers.get("location")!);
        url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
        redirect.headers.set("location", url.toString());
        return redirect;
    }

    // If user is authenticated and tries to access auth pages, redirect to dashboard
    if (
        user &&
        request.nextUrl.pathname.startsWith("/auth")
    ) {
        return redirectOnRequestHost(request, supabaseResponse, "/app/dashboard");
    }

    return supabaseResponse;
}

