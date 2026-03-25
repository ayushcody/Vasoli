"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { getAppRoutes, publicRoutes, resolveAppHref } from "@/lib/navigation";
import { track } from "@/lib/analytics";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    const onOpen = () => setOpen(true);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("vasoli:open-command", onOpen);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("vasoli:open-command", onOpen);
    };
  }, []);

  const appGroups = useMemo(() => {
    const grouped = new Map<string, ReturnType<typeof getAppRoutes>>();
    for (const route of getAppRoutes()) {
      const group = route.group || "App";
      grouped.set(group, [...(grouped.get(group) || []), route]);
    }
    return [...grouped.entries()];
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page or tool..." />
      <CommandList>
        <CommandEmpty>No route matches that query.</CommandEmpty>
        {appGroups.map(([group, routes]) => (
          <CommandGroup key={group} heading={group}>
            {routes.map((route) => (
              <CommandItem
                key={route.href}
                onSelect={() => {
                  const href = resolveAppHref(route.href);
                  track("command_palette_navigate", { href });
                  setOpen(false);
                  router.push(href);
                }}
              >
                {route.icon ? <route.icon className="size-4" /> : null}
                <span>{route.title}</span>
                <CommandShortcut>App</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandGroup heading="Public">
          {publicRoutes
            .filter((route) => !["/", "/privacy", "/terms"].includes(route.href))
            .map((route) => (
              <CommandItem
                key={route.href}
                onSelect={() => {
                  track("command_palette_navigate", { href: route.href });
                  setOpen(false);
                  router.push(route.href);
                }}
              >
                {route.icon ? <route.icon className="size-4" /> : null}
                <span>{route.title}</span>
                <CommandShortcut>Site</CommandShortcut>
              </CommandItem>
            ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
