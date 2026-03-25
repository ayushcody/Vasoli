import Link from "next/link";
import { CircleCheckBig, LifeBuoy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteShell } from "@/components/site/site-shell";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata(
  "Status",
  "Simple product status page for Vasoli.",
  "/status",
);

export default function StatusPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
        <div className="neo-surface-lg p-8">
          <div className="inline-flex items-center gap-2 rounded-full border-brutal bg-teal/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em]">
            <CircleCheckBig className="size-4" />
            Operational
          </div>
          <h1 className="mt-4 text-4xl font-black">Core product surfaces are currently available.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-taupe">
            This is a lightweight status page. Replace it later with real uptime instrumentation if you need incident timelines or component-level health.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {["Auth and routing", "App shell and navigation", "Receipt and transaction UX"].map((item) => (
              <div key={item} className="rounded-neo border-brutal bg-paper-1 p-4">
                <p className="text-sm font-semibold">{item}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-teal">Operational</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Button asChild variant="outline">
              <Link href="/contact">
                <LifeBuoy className="size-4" />
                Contact support
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
