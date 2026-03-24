import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
    if (
        !user &&
        request.nextUrl.pathname.startsWith("/app")
    ) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/signin";
        url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
        return NextResponse.redirect(url);
    }

    // If user is authenticated and tries to access auth pages, redirect to dashboard
    if (
        user &&
        request.nextUrl.pathname.startsWith("/auth")
    ) {
        const url = request.nextUrl.clone();
        url.pathname = "/app/dashboard";
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

