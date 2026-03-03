import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { healthScoreService } from "@/server/services/health-score.service";

export async function GET(req: NextRequest) {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await healthScoreService.getHealthScoreInsights(user.id);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching health score:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
