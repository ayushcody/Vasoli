import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { recurringService } from "@/server/services/recurring.service";

export async function GET(req: NextRequest) {
    const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const upcoming = await recurringService.getUpcomingTransactions(user.id, 30);
        return NextResponse.json(upcoming);
    } catch (error) {
        console.error("Error fetching upcoming transactions:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
