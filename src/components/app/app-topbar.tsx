"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppBreadcrumbs } from "@/components/app/app-breadcrumbs";
import { UserMenu } from "@/components/app/user-menu";

type AppTopbarProps = {
  email?: string | null;
};

export function AppTopbar({ email }: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b-brutal-thick bg-paper-1/95 backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" aria-label="Open navigation" />
            <SidebarTrigger className="hidden md:inline-flex" aria-label="Toggle navigation" />
            <div className="hidden sm:block">
              <p className="text-xs uppercase tracking-[0.24em] text-taupe">Vasoli Workspace</p>
              <p className="font-serif text-lg font-bold text-ink">Money, receipts, and rhythm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-[11rem] justify-between px-3 text-left"
              aria-label="Open command palette"
              onClick={() => window.dispatchEvent(new Event("vasoli:open-command"))}
            >
              <span className="flex items-center gap-2">
                <Search className="size-4" />
                <span className="hidden sm:inline">Search or jump</span>
                <span className="sm:hidden">Jump</span>
              </span>
              <span className="hidden rounded-full border-brutal bg-paper-2 px-2 py-0.5 text-[10px] font-semibold sm:inline">
                ⌘K
              </span>
            </Button>
            <UserMenu email={email} />
          </div>
        </div>
        <AppBreadcrumbs />
      </div>
    </header>
  );
}
