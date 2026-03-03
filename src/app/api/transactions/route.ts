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

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    try {
        const transactions = await transactionService.getAll(user.id, {
            type,
            categoryId,
            startDate,
            endDate,
        });
        return NextResponse.json(transactions);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const data = await req.json();
        const transaction = await transactionService.create(user.id, data);
        return NextResponse.json(transaction);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
