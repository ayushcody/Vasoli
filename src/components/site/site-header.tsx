import Image from "next/image";
import Link from "next/link";

import styles from "./site-chrome.module.css";

const links = [
  { title: "How it works", href: "/#how-it-works" },
  { title: "Features", href: "/#features" },
  { title: "About", href: "/about" },
];

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand} aria-label="Vasoli home">
          <Image src="/vasoli_logo.png" alt="Vasoli" width={180} height={60} priority />
        </Link>
        <nav className={styles.navigation} aria-label="Main navigation">
          {links.map((item) => <Link key={item.href} href={item.href}>{item.title}</Link>)}
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.signIn} href="/auth/signin">Sign in</Link>
          <Link className={styles.pilotButton} href="/contact">Pilot access</Link>
        </div>
      </div>
    </header>
  );
}
