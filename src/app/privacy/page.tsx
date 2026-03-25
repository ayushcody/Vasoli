import { SiteShell } from "@/components/site/site-shell";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata(
  "Privacy Policy",
  "Privacy policy template for Vasoli.",
  "/privacy",
);

const sections = [
  {
    title: "What we collect",
    body: "Account details, user-provided financial records, and product usage events needed to operate the app. Receipt payloads may be encrypted by the client before storage depending on the workflow used.",
  },
  {
    title: "How we use data",
    body: "To authenticate users, render the product, process imports and receipt workflows, and improve reliability. We do not use this template page as consent for unrelated data resale or advertising.",
  },
  {
    title: "Retention",
    body: "We retain data as needed to provide the service and comply with legitimate operational requirements. Users should be given a path to request deletion or export where applicable.",
  },
];

export default function PrivacyPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-6">
        <div className="neo-surface-lg p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Privacy Policy</p>
          <h1 className="mt-3 text-4xl font-black">Template privacy language, ready to replace with your final legal copy.</h1>
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
