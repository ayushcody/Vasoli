import { SiteShell } from "@/components/site/site-shell";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata(
  "Terms of Service",
  "Terms of service template for Vasoli.",
  "/terms",
);

const sections = [
  {
    title: "Service scope",
    body: "Vasoli is provided as a financial organization and insight tool. It does not replace professional legal, tax, or investment advice.",
  },
  {
    title: "User responsibilities",
    body: "Users are responsible for the accuracy of imported statements, uploaded receipts, and any actions taken based on forecasts or summaries.",
  },
  {
    title: "Availability",
    body: "We aim for stable service but do not guarantee uninterrupted access. Maintenance windows, upstream outages, and data errors can affect functionality.",
  },
];

export default function TermsPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-6">
        <div className="neo-surface-lg p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Terms</p>
          <h1 className="mt-3 text-4xl font-black">Clear placeholders now, final legal text later.</h1>
          <div className="mt-8 space-y-6 text-sm leading-7 text-taupe">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-black text-ink">{section.title}</h2>
                <p className="mt-2">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
