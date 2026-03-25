"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { publicRoutes } from "@/lib/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const navItems = publicRoutes.filter((route) => !["/privacy", "/terms", "/status"].includes(route.href));

  return (
    <header className="sticky top-0 z-40 border-b-brutal-thick bg-paper-1/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href="/" className="font-serif text-2xl font-black tracking-tight text-ink">
          Vasoli
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-neo border-2 px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "border-border bg-main shadow-brutal-sm"
                    : "border-transparent text-taupe hover:border-border hover:bg-paper-2",
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/auth/signin">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/app/dashboard">Go to app</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
