import Link from "next/link";
import { SiteShell } from "@/components/site/site-shell";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata("Pilot access", "Vasoli is an invite-only, free private pilot for salaried users in India.", "/pricing");

export default function PricingPage() {
  return <SiteShell><section className="mx-auto max-w-3xl px-4 py-20 md:px-6"><h1 className="font-serif text-5xl font-bold">A free private pilot.</h1><p className="mt-6 text-lg leading-8 text-taupe">Vasoli is currently invite-only for salaried users in India. The pilot includes statement review, Activity, bills, goals and payday planning. There are no paid plans or billing in this release.</p><p className="mt-4 text-sm leading-6 text-taupe">Statement imports are manual. Bank connections, payments and automatic financial actions are outside this pilot.</p><div className="mt-8 flex flex-wrap gap-6"><Link className="rounded-neo border-brutal bg-cta px-5 py-3 font-semibold" href="/contact">Ask about pilot access</Link><Link className="self-center font-semibold underline" href="/auth/signin">Already invited? Sign in</Link></div></section></SiteShell>;
}
