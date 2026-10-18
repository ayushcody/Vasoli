"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-paper-1 px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <div className="neo-surface-lg p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">500</p>
          <h1 className="mt-3 text-5xl font-black">Something broke inside the app shell.</h1>
          <p className="mt-4 text-sm leading-7 text-taupe">
            Try the action again. If it keeps failing, move to support so the failure can be inspected properly.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/contact">Contact support</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
