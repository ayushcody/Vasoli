import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json([
        { id: "1", title: "Electricity Bill", dueDate: new Date(Date.now() + 86400000 * 2).toISOString(), daysUntil: 2, status: "PENDING" },
        { id: "2", title: "Rent Due", dueDate: new Date(Date.now() + 86400000 * 5).toISOString(), daysUntil: 5, status: "PENDING" }
    ]);
}
