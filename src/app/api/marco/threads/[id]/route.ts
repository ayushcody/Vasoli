import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: thread, error } = await supabase
            .from("marco_threads")
            .select("*, marco_messages(*)")
            .eq("id", params.id)
            .eq("userId", user.id)
            .order("createdAt", { foreignTable: "marco_messages", ascending: true })
            .single();

        if (error || !thread) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        // Map Supabase response to expected format (rename marco_messages to messages)
        const formattedThread = {
            ...thread,
            messages: thread.marco_messages,
        };
        delete (formattedThread as any).marco_messages;

        return NextResponse.json(formattedThread);
    } catch (err) {
        logError("[marco/threads/[id] GET]", err);
        return NextResponse.json(
            { error: "Failed to fetch thread" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: thread, error } = await supabase
            .from("marco_threads")
            .select("id")
            .eq("id", params.id)
            .eq("userId", user.id)
            .single();

        if (error || !thread) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        await supabase.from("marco_threads").delete().eq("id", params.id);

        return NextResponse.json({ deleted: true });
    } catch (err) {
        logError("[marco/threads/[id] DELETE]", err);
        return NextResponse.json(
            { error: "Failed to delete thread" },
            { status: 500 }
        );
    }
}
