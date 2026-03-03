import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { transactionService } from "@/server/services/transaction.service";

export async function GET(req: NextRequest) {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const summary = await transactionService.getSummary(user.id);
        return NextResponse.json(summary);
    } catch (error) {
        console.error("Error fetching transaction summary:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
