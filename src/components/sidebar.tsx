"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command, LifeBuoy } from "lucide-react";

import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { getAppRoutes, resolveAppHref } from "@/lib/navigation";

function isActivePath(pathname: string, href: string) {
  if (href === "/app/zine") {
    return pathname.startsWith("/app/zine");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const grouped = getAppRoutes().reduce<Record<string, ReturnType<typeof getAppRoutes>>>((acc, route) => {
    const key = route.group || "App";
    acc[key] = [...(acc[key] || []), route];
    return acc;
  }, {});

  return (
    <SidebarRoot collapsible="icon" className="border-r-brutal-thick">
      <SidebarHeader className="gap-3 bg-mustard p-4">
        <Link href="/app/dashboard" className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-neo border-brutal-thick bg-paper-1 font-serif text-xl font-black">
            V
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="font-serif text-xl font-black">Vasoli</p>
            <p className="text-xs uppercase tracking-[0.24em] text-taupe">Finance cockpit</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="bg-paper-2">
        {Object.entries(grouped).map(([group, routes]) => (
          <SidebarGroup key={group} className="px-3 py-4">
            <SidebarGroupLabel className="px-2 text-xs uppercase tracking-[0.24em] text-taupe">
              {group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {routes.map((route) => (
                  <SidebarMenuItem key={route.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, route.href)}
                      tooltip={route.title}
                      className="h-11 rounded-neo border-2 border-transparent data-[active=true]:border-border data-[active=true]:bg-main"
                    >
                      <Link href={resolveAppHref(route.href)}>
                        {route.icon ? <route.icon className="size-4" /> : null}
                        <span>{route.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="bg-paper-2 p-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("vasoli:open-command"))}
          className="flex h-11 items-center gap-2 rounded-neo border-brutal bg-paper-1 px-3 text-sm font-medium transition-all hover:bg-main"
          aria-label="Open command palette"
        >
          <Command className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">Command palette</span>
        </button>
        <Link
          href="/contact"
          className="flex h-11 items-center gap-2 rounded-neo border-2 border-transparent px-3 text-sm font-medium text-taupe transition-all hover:border-border hover:bg-paper-1 hover:text-ink"
        >
          <LifeBuoy className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">Support</span>
        </Link>
      </SidebarFooter>
      <SidebarRail />
    </SidebarRoot>
  );
}
