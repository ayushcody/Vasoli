import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/app/dashboard";

    if (code) {
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
                return NextResponse.redirect(`${origin}${next}`);
            }
            console.error("[auth/callback] Code exchange failed:", error.message);
        } catch (err) {
            console.error("[auth/callback] Unexpected error:", err);
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/signin?error=auth_callback_error`);
}

