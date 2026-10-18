import { SiteShell } from "@/components/site/site-shell";
import { LandingExperience } from "@/components/site/landing-experience";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata(
  "A clearer plan for the days between paydays",
  "Bring statement records and regular commitments together, then make a payday plan around the goal that matters to you.",
  "/",
);

export default function LandingPage() {
  return (
    <SiteShell>
      <LandingExperience />
    </SiteShell>
  );
}
