import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SiteShell } from "@/components/site/site-shell";

export default function NotFound() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-6">
        <div className="neo-surface-lg p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">404</p>
          <h1 className="mt-3 text-5xl font-black">That page is missing.</h1>
          <p className="mt-4 text-sm leading-7 text-taupe">
            The route may have moved, the link may be stale, or the page was never wired up properly.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/app/dashboard">Go to dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
