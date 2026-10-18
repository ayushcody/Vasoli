import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/lib/site";
import styles from "./site-chrome.module.css";

const footerLinks = [
  { title: "How it works", href: "/#how-it-works" },
  { title: "Features", href: "/#features" },
  { title: "About", href: "/about" },
  { title: "Contact", href: "/contact" },
  { title: "Privacy", href: "/privacy" },
  { title: "Terms", href: "/terms" },
  { title: "Status", href: "/status" },
];

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <Link href="/" aria-label="Vasoli home"><Image src="/vasoli_logo.png" alt="Vasoli" width={150} height={50} /></Link>
          <p>A private pilot for planning around recorded cash, regular commitments, and a goal you choose.</p>
          <p>Support: <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a></p>
        </div>
        <nav className={styles.footerLinks} aria-label="Footer navigation">
          {footerLinks.map((link) => <Link key={link.href} href={link.href}>{link.title}</Link>)}
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <span>Invite-only · India</span>
        <span>Estimates reflect the information you enter.</span>
      </div>
    </footer>
  );
}
