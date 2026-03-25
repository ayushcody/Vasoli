import Link from "next/link";

import { publicRoutes } from "@/lib/navigation";
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  const footerLinks = publicRoutes.filter((route) => route.href !== "/");

  return (
    <footer className="border-t-brutal-thick bg-paper-2">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.5fr_1fr] md:px-6">
        <div className="space-y-3">
          <p className="font-serif text-2xl font-black text-ink">{siteConfig.name}</p>
          <p className="max-w-xl text-sm leading-6 text-taupe">{siteConfig.description}</p>
          <p className="text-sm text-ink">
            Support:{" "}
            <a href={`mailto:${siteConfig.supportEmail}`} className="font-semibold underline underline-offset-4">
              {siteConfig.supportEmail}
            </a>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-taupe transition-colors hover:text-ink">
              {link.title}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
