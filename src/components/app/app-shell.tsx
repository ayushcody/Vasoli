"use client";

import { useCallback, useEffect, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { CommandPalette } from "@/components/app/command-palette";
import { userClient } from "@/lib/rpc/clients";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string | null;
};

export function AppShell({ children, userEmail }: AppShellProps) {
  const [profileState, setProfileState] = useState<"loading" | "ready" | "error">(
    process.env.NEXT_PUBLIC_BYPASS_AUTH === "true" ? "ready" : "loading",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BYPASS_AUTH === "true") return;
    let active = true;
    userClient.getProfile({}).then(
      () => { if (active) setProfileState("ready"); },
      () => { if (active) setProfileState("error"); },
    );
    return () => { active = false; };
  }, [attempt]);

  const retryProfile = useCallback(() => {
    setProfileState("loading");
    setAttempt((value) => value + 1);
  }, []);

  return (
    <SidebarProvider defaultOpen>
      <Sidebar />
      <SidebarInset className="min-h-screen bg-paper-1">
        <AppTopbar email={userEmail} />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
            {profileState === "loading" ? <p className="neo-surface p-6 text-sm text-taupe" role="status">Preparing your secure workspace…</p> : null}
            {profileState === "error" ? <div className="neo-surface p-6" role="alert"><p className="text-sm text-ink">Your workspace could not be prepared. Check your connection and retry.</p><button type="button" className="mt-3 rounded-neo border-brutal bg-paper-1 px-4 py-2 text-sm font-semibold" onClick={retryProfile}>Retry</button></div> : null}
            {profileState === "ready" ? children : null}
          </div>
        </div>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
