"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/browser";

type UserMenuProps = {
  email?: string | null;
};

export function UserMenu({ email }: UserMenuProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const initials = (email || "VA").slice(0, 2).toUpperCase();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 px-3" aria-label="Open user menu">
          <span className="grid size-8 place-items-center rounded-full border-2 border-border bg-main text-xs font-bold">
            {initials}
          </span>
          <span className="hidden max-w-[12rem] truncate text-left sm:block">{email || "Workspace"}</span>
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="flex items-center gap-2">
            <UserCircle2 className="size-4" />
            <div>
              <p className="text-sm font-semibold">Signed in</p>
              <p className="text-xs opacity-70">{email || "No email available"}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/app/settings")}>
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
