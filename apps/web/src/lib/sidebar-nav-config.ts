import {
  Target,
  BookOpenCheck,
  FileText,
  Newspaper,
  HelpCircle,
  BookOpen,
  FolderOpen,
  Users,
  CreditCard,
  Home,
  BarChart3,
  Bookmark,
  Zap,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";

export type NavItem = {
  label: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const PRIMARY_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: Home, exact: true },
  { label: "Scorecard", href: "/assessment/dashboard", icon: BarChart3 }
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Self-Preparation",
    items: [
      { label: "General Studies", description: "GS Prelims self tests", href: "/assessment/gk", icon: Target },
      { label: "CSAT / Aptitude", description: "Aptitude practice & stats", href: "/assessment/csat", icon: BookOpenCheck },
      { label: "Mains Practice", description: "Answer writing & reviews", href: "/assessment/mains-hub", icon: FileText },
      { label: "Bookmarks & Revision", description: "Category-filtered revision", href: "/assessment/gk?view=revision", icon: Bookmark }
    ]
  },
  {
    label: "Current Affairs",
    items: [
      { label: "Daily News", description: "Prelims current affairs updates", href: "/current-affairs/daily-news", icon: Newspaper },
      { label: "Prelims PYQs", description: "Prelims questions by category", href: "/current-affairs/prelims-pyq", icon: HelpCircle }
    ]
  },
  {
    label: "Notes",
    items: [
      { label: "My Repositories", description: "Custom note collections & tags", href: "/current-affairs/workspace", icon: FolderOpen }
    ]
  },
  {
    label: "Mains",
    items: [
      { label: "Editorial Summary", description: "Exam-focused editorials", href: "/current-affairs/editorial-summary", icon: FileText },
      { label: "Mains Topic Notes", description: "Structured theme notes & data", href: "/current-affairs/mains-topic-notes", icon: BookOpen },
      { label: "Mains PYQs", description: "Mains questions by theme", href: "/current-affairs/mains-pyq", icon: FileText }
    ]
  }
];

export const SECONDARY_ITEMS: NavItem[] = [
  { label: "Study Plans", href: "/study-plans", icon: BookOpenCheck },
  { label: "Mentorship", href: "/mentors", icon: Users },
  { label: "Pricing", href: "/pricing", icon: Zap }
];

type AdminUser = { role: string } | null | undefined;

export function getAdminGroup(user: AdminUser): NavGroup | null {
  if (!user || !["admin", "moderator", "content_editor"].includes(user.role)) return null;

  const items: NavItem[] = [
    { label: "Current Affairs", description: "Articles, PYQs, ingestion", href: "/admin/current-affairs/overview", icon: Newspaper },
    { label: "Assessment", description: "Questions, tests, categories", href: "/admin/assessment/overview", icon: Target },
    { label: "Study Plans", description: "Plans, timeline, test content", href: "/admin/study-plans", icon: BookOpenCheck }
  ];

  if (["admin", "moderator"].includes(user.role)) {
    items.push({ label: "Mentor Approvals", description: "Onboarding requests review", href: "/admin/mentorship", icon: ShieldCheck });
  }
  if (user.role === "admin") {
    items.push({ label: "Purchase Records", description: "All subscriptions & billing", href: "/admin/purchases", icon: CreditCard });
  }
  if (["admin", "moderator"].includes(user.role)) {
    items.push({ label: "Payments Ledger", description: "Every payment, refunds & disputes", href: "/admin/payments", icon: CreditCard });
  }

  return { label: "Admin", items };
}

/** Matches the current pathname against a nav href, same convention used
 * across the old header/mobile nav so active-state highlighting is consistent. */
export function isNavItemActive(pathname: string, href: string, exact?: boolean): boolean {
  const hrefPath = href.split("?")[0] ?? href;
  if (exact) return pathname === hrefPath;
  if (hrefPath === "/current-affairs/daily-news") {
    return pathname.startsWith("/current-affairs") && !pathname.startsWith("/current-affairs/workspace");
  }
  if (hrefPath === "/current-affairs/workspace") {
    return pathname.startsWith("/current-affairs/workspace");
  }
  return pathname.startsWith(hrefPath);
}
