"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-paper-1 text-ink">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-16">
          <div className="neo-surface-lg w-full p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Global error</p>
            <h1 className="mt-3 text-5xl font-black">The application could not render.</h1>
            <p className="mt-4 text-sm leading-7 text-taupe">{error.message || "Unknown error"}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button onClick={reset}>Retry</Button>
              <Button asChild variant="outline">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
