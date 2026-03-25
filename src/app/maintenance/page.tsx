import { SiteShell } from "@/components/site/site-shell";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata(
  "Maintenance",
  "Maintenance placeholder page for Vasoli.",
  "/maintenance",
);

export default function MaintenancePage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-6">
        <div className="neo-surface-lg p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Maintenance</p>
          <h1 className="mt-3 text-4xl font-black">We’re tuning the product shell.</h1>
          <p className="mt-4 text-sm leading-7 text-taupe">
            Use this page if you need a maintenance switch later. For now it is only a placeholder and is not wired to an environment flag.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
