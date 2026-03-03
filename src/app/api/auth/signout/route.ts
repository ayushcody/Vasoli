import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);

  await supabase.auth.signOut();

  return NextResponse.json({ message: "Signed out successfully" });
}
