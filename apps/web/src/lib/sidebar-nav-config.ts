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
  Highlighter,
  Repeat2,
  Zap,
  ShieldCheck,
  UserPlus,
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

export const PRIMARY_ITEMS: NavItem[] = [{ label: "Home", href: "/", icon: Home, exact: true }];

/**
 * Sidebar structure.
 *
 * Ordered the way a student moves through the product rather than the way the
 * codebase is organised: the plan they are following, the mentor guiding them,
 * the current affairs they read daily, then their own practice. Within
 * Self-Preparation each paper is a pair — take the test, then read that paper's
 * scorecard — because those two are always used together and used to sit in
 * different places entirely.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Study Plans",
    items: [
      { label: "Browse Plans", description: "Courses, self-paced plans, test series", href: "/study-plans", icon: BookOpenCheck },
      { label: "My Plans", description: "Plans you are enrolled in", href: "/dashboard/purchases", icon: BookOpen }
    ]
  },
  {
    label: "Mentors Corner",
    items: [
      { label: "Find a Mentor", description: "Browse verified officers", href: "/mentors", icon: Users },
      { label: "My Mentorship", description: "Sessions, agenda and chat", href: "/dashboard/mentorship", icon: Users },
      { label: "Become a Mentor", description: "Apply to mentor aspirants", href: "/become-mentor", icon: UserPlus }
    ]
  },
  {
    label: "Current Affairs",
    items: [
      { label: "Daily News", description: "Prelims current affairs updates", href: "/current-affairs/daily-news", icon: Newspaper },
      { label: "Daily Summaries", description: "Exam-focused editorial summaries", href: "/current-affairs/editorial-summary", icon: FileText },
      { label: "Mains Notes", description: "Structured theme notes and data", href: "/current-affairs/mains-topic-notes", icon: BookOpen },
      { label: "My Notes", description: "Your repositories, tags and saved articles", href: "/current-affairs/workspace", icon: FolderOpen },
      { label: "My Highlights", description: "Every highlight and note in one place", href: "/current-affairs/workspace/highlights", icon: Highlighter },
      { label: "Prelims PYQs", description: "Prelims questions by category", href: "/current-affairs/prelims-pyq", icon: HelpCircle },
      { label: "Mains PYQs", description: "Mains questions by theme", href: "/current-affairs/mains-pyq", icon: FileText }
    ]
  },
  {
    label: "Self Preparation",
    items: [
      { label: "Test GK", description: "Build and attempt a GS test", href: "/assessment/gk", icon: Target },
      { label: "GK Score Card", description: "Your GS accuracy and weak topics", href: "/assessment/gk?view=performance&perf=summary", icon: BarChart3 },
      { label: "Test CSAT", description: "Build and attempt a CSAT test", href: "/assessment/csat", icon: BookOpenCheck },
      { label: "CSAT Score Card", description: "Your CSAT accuracy and weak topics", href: "/assessment/csat?view=performance&perf=summary", icon: BarChart3 },
      { label: "Test Mains", description: "Answer writing practice", href: "/assessment/mains-hub", icon: FileText },
      { label: "Mains Score Card", description: "Marks, categories and evaluator notes", href: "/assessment/mains-hub?view=performance&perf=summary", icon: BarChart3 },
      { label: "Revision", description: "Re-attempt what you got wrong", href: "/assessment/gk?view=revision", icon: Repeat2 },
      { label: "Overall Scorecard", description: "Every paper in one view", href: "/assessment/dashboard", icon: Bookmark }
    ]
  }
];

export const SECONDARY_ITEMS: NavItem[] = [];

/** Subscription lives in its own group so the two links always travel together:
 *  one to buy, one to manage what was bought. */
export const SUBSCRIPTION_ITEMS: NavItem[] = [
  { label: "Plans & Pricing", description: "Compare modules and subscribe", href: "/pricing", icon: Zap },
  { label: "My Subscription", description: "Manage your plan and payments", href: "/dashboard/purchases", icon: CreditCard }
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
  if (user.role === "admin") {
    items.push({ label: "Manage Subscriptions", description: "Plans, prices & entitlements", href: "/admin/subscriptions", icon: Zap });
  }
  if (["admin", "moderator"].includes(user.role)) {
    items.push({ label: "Payments Ledger", description: "Every payment, refunds & disputes", href: "/admin/payments", icon: CreditCard });
  }

  return { label: "Admin", items };
}

/**
 * Matches the current pathname against a nav href.
 *
 * The Self-Preparation group pairs each paper's test screen with its scorecard,
 * and those differ only by query string — so matching on pathname alone would
 * light up both. Items carrying a query are compared on it too.
 */
export function isNavItemActive(pathname: string, href: string, exact?: boolean, search?: string): boolean {
  const [hrefPath, hrefQuery] = href.split("?");
  const path = hrefPath ?? href;
  if (exact) return pathname === path;

  if (hrefQuery) {
    if (pathname !== path) return false;
    if (search === undefined) return false;
    const current = new URLSearchParams(search);
    const wanted = new URLSearchParams(hrefQuery);
    for (const [key, value] of wanted) {
      if (current.get(key) !== value) return false;
    }
    return true;
  }

  if (path === "/current-affairs/daily-news") {
    return pathname.startsWith("/current-affairs") && !pathname.startsWith("/current-affairs/workspace");
  }
  if (path === "/current-affairs/workspace") {
    return pathname === path;
  }
  // A bare test link must not stay lit while its own scorecard is open.
  if (path.startsWith("/assessment/") && search) {
    const view = new URLSearchParams(search).get("view");
    if (view === "performance" || view === "revision") return false;
  }
  return pathname.startsWith(path);
}
