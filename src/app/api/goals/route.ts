import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { goalService } from "@/server/services/goal.service";

export async function GET(req: NextRequest) {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;

    try {
        const goals = await goalService.getAll(user.id, { status });
        return NextResponse.json(goals);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const data = await req.json();
        const goal = await goalService.create(user.id, data);
        return NextResponse.json(goal);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
