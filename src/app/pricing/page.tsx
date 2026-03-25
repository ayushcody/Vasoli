import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteShell } from "@/components/site/site-shell";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata(
  "Pricing",
  "Transparent pricing for Vasoli, with a free tier placeholder and room for future pro features.",
  "/pricing",
);

const tiers = [
  {
    name: "Starter",
    price: "Free",
    description: "For getting your statements, receipts, and monthly reviews under control.",
    features: ["Dashboard and receipt vault", "Transactions and obligations tracking", "Monthly Ledger Zine"],
  },
  {
    name: "Pro",
    price: "Coming soon",
    description: "Reserved for deeper automation and team or family workflows once the product hardens.",
    features: ["Advanced reminders", "Export workflows", "Expanded analytics and collaboration"],
  },
];

export default function PricingPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Pricing</p>
          <h1 className="mt-3 text-5xl font-black">Simple for now, explicit on purpose.</h1>
          <p className="mt-4 text-lg leading-8 text-taupe">
            The product is currently positioned around a clean free tier while the standard product shell and core
            workflows solidify.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {tiers.map((tier) => (
            <section key={tier.name} className="neo-surface-lg p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-taupe">{tier.name}</p>
              <h2 className="mt-2 text-4xl font-black">{tier.price}</h2>
              <p className="mt-4 text-sm leading-6 text-taupe">{tier.description}</p>
              <div className="mt-6 space-y-3">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 rounded-neo border-brutal bg-paper-1 px-4 py-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/app/dashboard">
              Open the app
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/contact">Talk to support</Link>
          </Button>
        </div>
      </div>
    </SiteShell>
  );
}
