import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bypassAuth = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

  if (!user && !bypassAuth) {
    redirect("/auth/signin");
  }

  return <AppShell userEmail={user?.email || "demo@vasoli.app"}>{children}</AppShell>;
}
