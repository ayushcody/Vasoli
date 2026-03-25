import {
  BookOpenText,
  BriefcaseBusiness,
  CreditCard,
  FileStack,
  Gauge,
  Globe,
  HandCoins,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  LogIn,
  type LucideIcon,
  Palette,
  Settings,
  Sparkles,
  UserPlus,
  WalletCards,
} from "lucide-react";

export type NavigationItem = {
  title: string;
  href: string;
  icon?: LucideIcon;
  description?: string;
  group?: string;
  devOnly?: boolean;
  breadcrumbLabel?: string;
};

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export const publicRoutes: NavigationItem[] = [
  { title: "Home", href: "/", icon: Home, description: "Marketing overview" },
  { title: "Pricing", href: "/pricing", icon: WalletCards, description: "Plans and packaging" },
  { title: "About", href: "/about", icon: Sparkles, description: "Product story and principles" },
  { title: "Contact", href: "/contact", icon: LifeBuoy, description: "Support and contact options" },
  { title: "Privacy", href: "/privacy", icon: LockKeyhole, description: "Privacy policy" },
  { title: "Terms", href: "/terms", icon: BriefcaseBusiness, description: "Terms of service" },
  { title: "Status", href: "/status", icon: Globe, description: "Operational status" },
];

export const authRoutes: NavigationItem[] = [
  { title: "Sign in", href: "/auth/signin", icon: LogIn, description: "Access your workspace" },
  { title: "Sign up", href: "/auth/signup", icon: UserPlus, description: "Create a new account" },
];

const appRouteRegistry: NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/app/dashboard",
    icon: LayoutDashboard,
    description: "Money cockpit and financial health",
    group: "Overview",
  },
  {
    title: "Transactions",
    href: "/app/transactions",
    icon: CreditCard,
    description: "Statement activity and transaction review",
    group: "Money",
  },
  {
    title: "Obligations",
    href: "/app/obligations",
    icon: HandCoins,
    description: "Recurring bills and subscriptions",
    group: "Money",
  },
  {
    title: "Cashflow",
    href: "/app/cashflow",
    icon: Gauge,
    description: "Forward-looking cashflow forecast",
    group: "Money",
  },
  {
    title: "Receipt Vault",
    href: "/app/receipts",
    icon: FileStack,
    description: "Receipts, warranties, and reimbursements",
    group: "Vault",
  },
  {
    title: "Goals",
    href: "/app/goals",
    icon: WalletCards,
    description: "Savings goals and progress",
    group: "Planning",
  },
  {
    title: "Ledger Zine",
    href: "/app/zine",
    icon: BookOpenText,
    description: "Monthly editorial-style financial summary",
    group: "Planning",
  },
  {
    title: "Marco",
    href: "/app/marco",
    icon: Sparkles,
    description: "AI assistant workspace",
    group: "Tools",
  },
  {
    title: "Settings",
    href: "/app/settings",
    icon: Settings,
    description: "Preferences and account controls",
    group: "Tools",
  },
  {
    title: "UI Kit",
    href: "/ui-kit",
    icon: Palette,
    description: "Internal component showcase",
    group: "Lab",
    devOnly: true,
  },
];

export function getAppRoutes() {
  return appRouteRegistry.filter((route) => !route.devOnly || process.env.NODE_ENV !== "production");
}

export function resolveAppHref(href: string) {
  if (href === "/app/zine") {
    return `/app/zine/${currentPeriod()}`;
  }

  return href;
}

export function getCurrentZinePath() {
  return `/app/zine/${currentPeriod()}`;
}

function titleFromSegment(segment: string) {
  if (/^\d{4}-\d{2}$/.test(segment)) {
    const [year, month] = segment.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }

  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

function findRoute(pathname: string) {
  const candidates = [...publicRoutes, ...authRoutes, ...appRouteRegistry].sort(
    (a, b) => b.href.length - a.href.length,
  );

  return candidates.find((route) => {
    if (route.href === pathname) {
      return true;
    }

    if (route.href === "/app/zine") {
      return pathname.startsWith("/app/zine");
    }

    return pathname.startsWith(`${route.href}/`);
  });
}

export function getRouteTitle(pathname: string) {
  return findRoute(pathname)?.title || titleFromSegment(pathname.split("/").filter(Boolean).pop() || "");
}

export function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: Array<{ title: string; href: string }> = [];

  if (pathname.startsWith("/app") && pathname !== "/app/dashboard") {
    breadcrumbs.push({ title: "Dashboard", href: "/app/dashboard" });
  }

  let cursor = "";
  for (const segment of segments) {
    cursor += `/${segment}`;
    if (cursor === "/app") {
      continue;
    }

    const route = findRoute(cursor);
    if (route) {
      const href = route.href === "/app/zine" ? getCurrentZinePath() : cursor;
      if (!breadcrumbs.some((crumb) => crumb.href === href)) {
        breadcrumbs.push({ title: route.title, href });
      }
      continue;
    }

    breadcrumbs.push({ title: titleFromSegment(segment), href: cursor });
  }

  return breadcrumbs;
}
