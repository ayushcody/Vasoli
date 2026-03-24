import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: threads } = await supabase
            .from("marco_threads")
            .select("id, title, lastMessageAt, createdAt")
            .eq("userId", user.id)
            .order("lastMessageAt", { ascending: false })
            .limit(50);

        return NextResponse.json(threads || []);
    } catch (err) {
        console.error("[marco/threads GET]", err);
        return NextResponse.json([]);
    }
}

export async function POST() {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: thread, error } = await supabase
            .from("marco_threads")
            .insert({
                userId: user.id,
                title: "New chat",
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(thread, { status: 201 });
    } catch (err) {
        console.error("[marco/threads POST]", err);
        return NextResponse.json(
            { error: "Database unavailable. Please try again later." },
            { status: 503 }
        );
    }
}
