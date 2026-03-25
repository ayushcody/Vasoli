import { SiteShell } from "@/components/site/site-shell";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata(
  "About",
  "Why Vasoli exists, what product quality it targets, and how it approaches personal finance UX.",
  "/about",
);

export default function AboutPage() {
  return (
    <SiteShell>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 md:grid-cols-[0.8fr_1.2fr] md:px-6">
        <div className="neo-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">About Vasoli</p>
          <h1 className="mt-3 text-4xl font-black">A money product that feels readable, not punishing.</h1>
        </div>
        <div className="neo-surface-lg space-y-5 p-8 text-sm leading-7 text-taupe">
          <p>
            Vasoli is aimed at turning a rough finance MVP into a product that behaves like a standard web app:
            consistent shell, protected app routes, resilient states, readable dashboards, and clear paths through the product.
          </p>
          <p>
            The product direction stays simple. Frontend talks to Go services over Connect transport. The UI is opinionated,
            neobrutal, and intentionally bold, but the workflows should still feel standard and production-ready.
          </p>
          <p>
            The current focus is quality: better app structure, better routing, better tables and forms, better auth gates,
            and fewer places where the user is left with a blank screen or broken flow.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
