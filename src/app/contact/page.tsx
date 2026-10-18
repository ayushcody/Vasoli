import { ContactForm } from "@/components/site/contact-form";
import { SiteShell } from "@/components/site/site-shell";
import { buildPageMetadata, siteConfig } from "@/lib/site";

export const metadata = buildPageMetadata(
  "Contact",
  "Support and contact details for Vasoli.",
  "/contact",
);

export default function ContactPage() {
  return (
    <SiteShell>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 md:grid-cols-[0.65fr_1.35fr] md:px-6">
        <div className="neo-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Contact</p>
          <h1 className="mt-3 text-4xl font-black">Need support, have feedback, or found a broken flow?</h1>
          <p className="mt-4 text-sm leading-6 text-taupe">
            We use a simple support path for now. Reach out by email and include as much context as possible.
          </p>
          <div className="mt-6 rounded-neo border-brutal bg-paper-1 p-4 text-sm">
            <p className="font-semibold text-ink">Primary support email</p>
            <a className="mt-1 inline-block font-semibold underline underline-offset-4" href={`mailto:${siteConfig.supportEmail}`}>
              {siteConfig.supportEmail}
            </a>
          </div>
        </div>
        <ContactForm />
      </div>
    </SiteShell>
  );
}
