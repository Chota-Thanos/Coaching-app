/**
 * One source of truth for what each paid module actually gives you.
 *
 * Every number and claim here is mirrored from a server-side check. If a
 * capability is not enforced on the API it does NOT belong in this file —
 * selling a limit that nothing enforces is how a pricing page ends up lying.
 *
 * Enforcement map, for anyone editing this:
 *   assessment.premium_tests   → free-test-allowance.ts (3-test cap),
 *                                question-caps.ts (50/100 objective, 10/25 mains),
 *                                enforced on both test creation and attempts
 *   assessment.ai_evaluation   → mains.routes.ts (AI answer evaluation)
 *   current_affairs.notes_workspace / .editorial_access
 *                              → billing/free-tier.ts (every notes-workspace cap
 *                                and the AI Notes Helper gate)
 *
 * Deliberately NOT sold, because nothing enforces them:
 *   current_affairs.daily_reads          — reading is unlimited on every plan
 *   current_affairs.editorial_access     — as a *reading* gate; it only unlocks
 *                                          the notes workspace in practice
 *   assessment.performance_analytics     — the scorecard is open to everyone
 *   assessment.max_questions_per_test    — dead key; the real cap keys off
 *                                          assessment.premium_tests
 */

export const PLAN_CODES = {
  assessment: "assessment_premium",
  currentAffairs: "current_affairs_pro",
  bundle: "assessment_ca_bundle"
} as const;

/** Free-tier caps, mirroring apps/api/src/modules/assessment/free-test-allowance.ts
 *  and apps/api/src/modules/billing/free-tier.ts. The server re-validates all of
 *  these — they are here so the UI can show what is left before a wall. */
export const FREE_LIMITS = {
  selfBuiltTests: 3,
  objectiveQuestionsPerTest: 50,
  mainsQuestionsPerTest: 10,
  noteRepositories: 5,
  articlesPerRepository: 10,
  savedArticles: 50,
  personalArticles: 10,
  highlightsPerArticle: 20,
  notesPerArticle: 10
} as const;

export const PREMIUM_LIMITS = {
  objectiveQuestionsPerTest: 100,
  mainsQuestionsPerTest: 25
} as const;

export type ModuleId = "self_preparation" | "current_affairs";

export type ModuleFeature = {
  /** What the subscriber gets. */
  label: string;
  /** What the same thing looks like without the module. */
  free: string;
};

export type SubscriptionModule = {
  id: ModuleId;
  /** Plan code that unlocks this module on its own. */
  planCode: string;
  name: string;
  /** Used on the dashboard upgrade cards. */
  cardTitle: string;
  tagline: string;
  /** Any one of these entitlement keys means the module is active. */
  entitlementKeys: string[];
  /** Only genuinely enforced differences. */
  features: ModuleFeature[];
  /** Things people assume are paid but are not — stated plainly so the page
   *  is not accidentally implying they are behind the wall. */
  freeForEveryone: string[];
};

export const SUBSCRIPTION_MODULES: SubscriptionModule[] = [
  {
    id: "self_preparation",
    planCode: PLAN_CODES.assessment,
    name: "Assessment Premium",
    cardTitle: "Upgrade Self-Preparation",
    tagline: "Take the caps off practice",
    entitlementKeys: ["assessment.premium_tests", "assessment.ai_evaluation"],
    features: [
      {
        label: "Unlimited tests you build yourself",
        free: `${FREE_LIMITS.selfBuiltTests} in total, one-time`
      },
      {
        label: `${PREMIUM_LIMITS.objectiveQuestionsPerTest} questions per GS or CSAT test`,
        free: `${FREE_LIMITS.objectiveQuestionsPerTest} per test`
      },
      {
        label: `${PREMIUM_LIMITS.mainsQuestionsPerTest} questions per Mains test`,
        free: `${FREE_LIMITS.mainsQuestionsPerTest} per test`
      },
      {
        label: "AI evaluation on your Mains answers",
        free: "Not included"
      }
    ],
    freeForEveryone: [
      "The whole GS, CSAT and Mains question bank",
      "Ready-made test series and PYQ papers — these never count against your allowance",
      "Your scorecard: accuracy, per-subject breakdown, time per question",
      "Syllabus coverage, bookmarks and revision — all unlimited"
    ]
  },
  {
    id: "current_affairs",
    planCode: PLAN_CODES.currentAffairs,
    name: "Current Affairs Pro",
    cardTitle: "Upgrade Current Affairs",
    tagline: "Turn what you read into your own notes",
    entitlementKeys: ["current_affairs.notes_workspace", "current_affairs.editorial_access"],
    features: [
      {
        label: "Unlimited note repositories",
        free: `${FREE_LIMITS.noteRepositories} repositories`
      },
      {
        label: "Unlimited articles in each repository",
        free: `${FREE_LIMITS.articlesPerRepository} per repository`
      },
      {
        label: "Unlimited saved articles and personal write-ups",
        free: `${FREE_LIMITS.savedArticles} saved, ${FREE_LIMITS.personalArticles} personal`
      },
      {
        label: "Unlimited highlights and notes on any article",
        free: `${FREE_LIMITS.highlightsPerArticle} highlights, ${FREE_LIMITS.notesPerArticle} notes per article`
      },
      {
        label: "AI Notes Helper — study notes and quizzes from your saved articles",
        free: "Not included"
      }
    ],
    freeForEveryone: [
      "Reading is unlimited — there is no daily article cap on any plan",
      "All six sections, including Editorial Summary and Mains Topic Notes",
      "Both PYQ banks, mapped to current affairs topics",
      "Tags, collections and exporting a repository as a document"
    ]
  }
];

export function getModule(id: ModuleId): SubscriptionModule {
  const found = SUBSCRIPTION_MODULES.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown subscription module: ${id}`);
  return found;
}

type EntitlementLike = { entitlement_key: string };

/** True when the user holds any entitlement that unlocks this module — whether
 *  they bought the module on its own or as part of the bundle. */
export function isModuleActive(module: SubscriptionModule, entitlements: EntitlementLike[]): boolean {
  return entitlements.some((e) => module.entitlementKeys.includes(e.entitlement_key));
}

/** The modules a user has not bought yet, in display order. */
export function inactiveModules(entitlements: EntitlementLike[]): SubscriptionModule[] {
  return SUBSCRIPTION_MODULES.filter((m) => !isModuleActive(m, entitlements));
}

export function formatPrice(amountMinor: number, currency = "INR"): string {
  const amount = amountMinor / 100;
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export const BILLING_INTERVAL_LABELS: Record<string, string> = {
  month: "per month",
  quarter: "per quarter",
  year: "per year",
  one_time: "one-time"
};

export const BILLING_INTERVAL_SHORT: Record<string, string> = {
  month: "/mo",
  quarter: "/qtr",
  year: "/yr",
  one_time: ""
};

/**
 * Caps a "quick start" question count to what the server will actually accept
 * for this tier — mirrors assessment.ts's getQuestionCap() (free: 50
 * objective / 10 mains, premium: 100 / 25), enforced again server-side by
 * assertWithinQuestionCap on every attempt-creation call. This only prevents
 * requesting a doomed count; it is not itself the enforcement.
 */
export function tierAwareQuestionCount(desired: number, hasAnyActive: boolean, isMains: boolean): number {
  const cap = isMains
    ? hasAnyActive
      ? PREMIUM_LIMITS.mainsQuestionsPerTest
      : FREE_LIMITS.mainsQuestionsPerTest
    : hasAnyActive
      ? PREMIUM_LIMITS.objectiveQuestionsPerTest
      : FREE_LIMITS.objectiveQuestionsPerTest;
  return Math.max(1, Math.min(desired, cap));
}
