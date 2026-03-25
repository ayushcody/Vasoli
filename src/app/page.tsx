import Link from "next/link";
import { ArrowRight, Command, FileStack, Gauge, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteShell } from "@/components/site/site-shell";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata(
  "Personal finance with receipts that stay useful",
  "Track spending, see obligations early, and keep receipts useful with a privacy-first product shell built for everyday financial clarity.",
  "/",
);

const featureCards = [
  {
    title: "Dashboard that explains itself",
    description: "Your balance, savings pulse, receipt watchlist, and current priorities in one place instead of across five half-finished screens.",
    icon: Gauge,
  },
  {
    title: "Receipt Vault that stays actionable",
    description: "Capture OCR, unlock encrypted receipt payloads, and track return windows and reimbursement status before value expires.",
    icon: FileStack,
  },
  {
    title: "Monthly Ledger Zine",
    description: "Review your money like an editor, not a spreadsheet. Category patterns, savings rate, and a readable monthly narrative.",
    icon: Sparkles,
  },
];

export default function LandingPage() {
  return (
    <SiteShell>
      <section className="border-b-brutal-thick">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:grid-cols-[1.2fr_0.8fr] md:px-6 md:py-24">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border-brutal bg-mustard px-4 py-2 text-xs font-bold uppercase tracking-[0.24em]">
              <ShieldCheck className="size-4" />
              Privacy-first money cockpit
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-black leading-tight md:text-6xl">
                Standard personal finance UX, without the spreadsheet hangover.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-taupe">
                Vasoli helps you track statements, understand recurring obligations, keep receipts useful, and review
                your month in a way that feels complete instead of stitched together.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/app/dashboard">
                  Go to app
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/signin">Sign in</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-taupe">
              <span className="rounded-full border-brutal bg-paper-2 px-3 py-1">Connect RPC frontend</span>
              <span className="rounded-full border-brutal bg-paper-2 px-3 py-1">Neobrutal shell</span>
              <span className="rounded-full border-brutal bg-paper-2 px-3 py-1">Receipt vault + OCR</span>
            </div>
          </div>

          <div className="neo-surface-lg p-6">
            <div className="grid gap-4">
              <div className="rounded-[1.25rem] border-brutal-thick bg-paper-1 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-taupe">Today</p>
                <p className="mt-2 text-4xl font-black">₹4,200 safe to spend</p>
                <p className="mt-2 text-sm text-taupe">Bills due this week, recent imports, and receipt alerts stay on the same canvas.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border-brutal bg-cobalt/15 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-taupe">Command palette</p>
                  <p className="mt-2 flex items-center gap-2 text-lg font-bold">
                    <Command className="size-4" />
                    Jump anywhere with Cmd/Ctrl + K
                  </p>
                </div>
                <div className="rounded-[1.25rem] border-brutal bg-teal/15 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-taupe">Vault mode</p>
                  <p className="mt-2 text-lg font-bold">Encrypted receipt previews</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b-brutal-thick">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">What makes it feel complete</p>
            <h2 className="mt-3 text-4xl font-black">A product shell that behaves like a real app</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {featureCards.map((card) => (
              <article key={card.title} className="neo-surface p-6">
                <card.icon className="mb-4 size-8" />
                <h3 className="text-2xl font-black">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-taupe">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <div className="neo-surface-lg flex flex-col gap-5 p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Ready to use it</p>
              <h2 className="mt-2 text-3xl font-black">Open the app, import a statement, and make the shell work for you.</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/app/dashboard">Go to app</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
