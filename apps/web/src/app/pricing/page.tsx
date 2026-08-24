"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../components/auth/auth-context";
import { PricingCheckoutModal } from "../../components/billing/pricing-checkout-modal";
import { browserBaseUrl } from "../../lib/api";
import {
  SUBSCRIPTION_MODULES,
  PLAN_CODES,
  FREE_LIMITS,
  type ModuleFeature
} from "../../lib/subscription-plans";
import {
  CheckCircle2,
  X,
  Sparkles,
  Zap,
  Target,
  Newspaper,
  Users,
  BookOpen,
  BarChart3,
  Brain,
  ArrowRight,
  Shield,
  Clock,
  Star
} from "lucide-react";

export const dynamic = "force-dynamic";

type PlanPrice = {
  id: number;
  currency: string;
  amount_minor: number;
  billing_interval: "one_time" | "month" | "quarter" | "year";
  is_active: boolean;
};

type PlanEntitlement = {
  id: number;
  entitlement_key: string;
  limit_value: number | null;
};

type Plan = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  prices: PlanPrice[];
  entitlements: PlanEntitlement[];
};

type BillingInterval = "month" | "quarter" | "year";

const INTERVAL_LABELS: Record<BillingInterval, string> = {
  month: "Monthly",
  quarter: "Quarterly",
  year: "Annual"
};

const INTERVAL_SAVINGS: Record<BillingInterval, string | null> = {
  month: null,
  quarter: "Save 20%",
  year: "Save 35%"
};

// Feature lists are DERIVED from lib/subscription-plans.ts, which mirrors the
// server-side checks one-for-one. They used to be hand-written here and had
// drifted badly: the page was selling "Performance radar & analytics",
// "Unlimited daily article reads", "Syllabus-mapped editorial deep dives",
// "Mentor session discounts", "Priority access to new features" and a
// "Dedicated support channel" — none of which gate anything, and the last three
// of which do not exist in the product at all.
type PlanFeature = ModuleFeature & { icon: React.ElementType; color: string };

const MODULE_STYLE: Record<string, { icon: React.ElementType; color: string }> = {
  self_preparation: { icon: Target, color: "text-civic" },
  current_affairs: { icon: Newspaper, color: "text-emerald-600" }
};

function moduleFeatures(moduleId: string): PlanFeature[] {
  const module = SUBSCRIPTION_MODULES.find((m) => m.id === moduleId);
  const style = MODULE_STYLE[moduleId] ?? { icon: CheckCircle2, color: "text-civic" };
  return (module?.features ?? []).map((f) => ({ ...f, icon: style.icon, color: style.color }));
}

const PLAN_FEATURES: Record<string, PlanFeature[]> = {
  [PLAN_CODES.assessment]: moduleFeatures("self_preparation"),
  [PLAN_CODES.currentAffairs]: moduleFeatures("current_affairs"),
  [PLAN_CODES.bundle]: [...moduleFeatures("self_preparation"), ...moduleFeatures("current_affairs")]
};

/** What every plan, including the bundle, leaves open to free accounts. Stated
 *  on the page so nobody assumes these sit behind the wall. */
const OPEN_TO_EVERYONE: string[] = SUBSCRIPTION_MODULES.flatMap((m) => m.freeForEveryone);

// Plan styling config
const PLAN_STYLES: Record<string, {
  gradient: string;
  badge: string | null;
  badgeClass: string;
  border: string;
  headerBg: string;
  buttonClass: string;
  iconBg: string;
  iconText: string;
  icon: React.ElementType;
}> = {
  assessment_premium: {
    gradient: "from-paper to-white",
    badge: null,
    badgeClass: "",
    border: "border-line",
    headerBg: "bg-midnight",
    buttonClass: "bg-civic hover:bg-civic/90 shadow-civic/20",
    iconBg: "bg-civic/10",
    iconText: "text-civic",
    icon: Target
  },
  current_affairs_pro: {
    gradient: "from-emerald-50 to-white",
    badge: null,
    badgeClass: "",
    border: "border-emerald-100",
    headerBg: "bg-midnight",
    buttonClass: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-700",
    icon: Newspaper
  },
  assessment_ca_bundle: {
    gradient: "from-paper to-white",
    badge: "Most Popular",
    badgeClass: "bg-civic text-white",
    border: "border-civic/30 ring-2 ring-civic/20",
    headerBg: "bg-midnight",
    buttonClass: "bg-civic hover:bg-civic/90 shadow-civic/20",
    iconBg: "bg-civic/10",
    iconText: "text-civic",
    icon: Sparkles
  }
};

// Free tier, matching the server. The previous copy claimed "10 MCQ tests per
// day" (it is 3 in total, ever) and "5 Current Affairs articles per day" (there
// is no read cap for a signed-in account at all).
const FREE_FEATURES = [
  `${FREE_LIMITS.selfBuiltTests} tests you build yourself, up to ${FREE_LIMITS.objectiveQuestionsPerTest} questions each`,
  "Unlimited reading across all six Current Affairs sections",
  "Ready-made test series and PYQ papers, and your full scorecard",
  `${FREE_LIMITS.noteRepositories} note repositories, ${FREE_LIMITS.articlesPerRepository} articles in each`
];

export default function PricingPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<PlanPrice | null>(null);
  const searchParams = useSearchParams();
  const requestedPlan = searchParams?.get("plan") ?? null;
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch(`${browserBaseUrl}/api/v1/billing/plans`);
        if (res.ok) {
          const data: Plan[] = await res.json();
          setPlans(data.filter((p) => p.is_active));
        }
      } catch (err) {
        console.error("Failed to fetch plans:", err);
      } finally {
        setLoading(false);
      }
    };
    void fetchPlans();
  }, []);

  const handleGetStarted = useCallback(
    (plan: Plan) => {
      if (!token) {
        router.push(`/register?plan=${plan.code}`);
        return;
      }
      const price = plan.prices.find((p) => p.billing_interval === interval && p.is_active);
      if (price) {
        setSelectedPlan(plan);
        setSelectedPrice(price);
      }
    },
    [token, router, interval]
  );

  const handleCheckoutSuccess = useCallback(() => {
    setSelectedPlan(null);
    setSelectedPrice(null);
    router.push("/dashboard/purchases");
  }, [router]);

  // A single link is enough to subscribe: the dashboard upgrade cards and the
  // top-bar Upgrade button both land here with ?plan=<code> and go straight to
  // checkout, rather than dropping the reader on the page to find it again.
  useEffect(() => {
    if (deepLinkHandled || !requestedPlan || !token || !plans.length) return;
    const plan = plans.find((p) => p.code === requestedPlan);
    if (!plan) return;
    const price =
      plan.prices.find((pr) => pr.billing_interval === interval && pr.is_active) ??
      plan.prices.find((pr) => pr.is_active) ??
      null;
    if (price) {
      setSelectedPlan(plan);
      setSelectedPrice(price);
    }
    setDeepLinkHandled(true);
  }, [deepLinkHandled, requestedPlan, token, plans, interval]);

  const getPriceForInterval = (plan: Plan): PlanPrice | null => {
    return plan.prices.find((p) => p.billing_interval === interval && p.is_active) ?? null;
  };

  // Order plans in a consistent display order
  const planOrder = ["assessment_premium", "current_affairs_pro", "assessment_ca_bundle"];
  const orderedPlans = planOrder
    .map((code) => plans.find((p) => p.code === code))
    .filter(Boolean) as Plan[];

  return (
    <>
      {/* Checkout Modal */}
      {selectedPlan && selectedPrice && token && (
        <PricingCheckoutModal
          plan={selectedPlan}
          selectedPrice={selectedPrice}
          token={token}
          onClose={() => { setSelectedPlan(null); setSelectedPrice(null); }}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      <main className="min-h-screen bg-surface">
        {/* Hero */}
        <section className="page-hero">
          <div className="page-hero-content mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-white/60 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Transparent Pricing · No Hidden Fees
            </div>

            <h1 className="text-4xl font-black md:text-5xl tracking-tight text-white leading-tight mb-4">
              Plans for Every Stage of Your{" "}
              <span className="text-indigo-400">UPSC Journey</span>
            </h1>
            <p className="text-white/55 text-base max-w-2xl mx-auto leading-relaxed mb-8">
              Start free. Upgrade only what you need. Current affairs is always free for everyone.
            </p>

            {/* Interval Toggle */}
            <div className="inline-flex items-center gap-1 rounded-2xl bg-white/8 border border-white/10 p-1.5">
              {(["month", "quarter", "year"] as BillingInterval[]).map((iv) => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  className={`relative rounded-xl px-5 py-2 text-sm font-bold transition-all ${
                    interval === iv
                      ? "bg-surface text-ink shadow-sm"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  {INTERVAL_LABELS[iv]}
                  {INTERVAL_SAVINGS[iv] && (
                    <span className="absolute -top-2.5 -right-1.5 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[9px] font-black text-emerald-900 leading-none">
                      {INTERVAL_SAVINGS[iv]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Plans Grid */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 -mt-6 pb-20">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {orderedPlans.map((plan) => {
                const style = PLAN_STYLES[plan.code] ?? PLAN_STYLES["assessment_premium"]!;
                const features = PLAN_FEATURES[plan.code] ?? [];
                const price = getPriceForInterval(plan);
                const PlanIcon = style.icon;

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-3xl border bg-gradient-to-b ${style.gradient} ${style.border} overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 duration-300`}
                  >
                    {/* Popular Badge */}
                    {style.badge && (
                      <div className={`absolute top-4 right-4 rounded-full px-3 py-1 text-xs font-black ${style.badgeClass} shadow-md`}>
                        {style.badge}
                      </div>
                    )}

                    {/* Plan Header */}
                    <div className={`${style.headerBg} px-6 pt-8 pb-10 text-white`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
                          <PlanIcon className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-black">{plan.name}</h2>
                      </div>

                      {price ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-white/80 text-lg font-bold">₹</span>
                          <span className="text-4xl font-black">{(price.amount_minor / 100).toFixed(0)}</span>
                          <span className="text-white/70 text-sm font-semibold ml-1">
                            {INTERVAL_LABELS[interval].toLowerCase()}
                          </span>
                        </div>
                      ) : (
                        <p className="text-white/70 text-sm">No price available for this interval.</p>
                      )}

                      {plan.description && (
                        <p className="text-white/75 text-xs mt-3 leading-relaxed">{plan.description}</p>
                      )}
                    </div>

                    {/* Features */}
                    <div className="px-6 py-6 space-y-3">
                      {features.map((feat) => {
                        const FeatIcon = feat.icon;
                        return (
                          <div key={feat.label} className="flex items-start gap-2.5">
                            <FeatIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${feat.color}`} />
                            <div className="min-w-0">
                              <span className="block text-sm text-slate-700 font-semibold leading-snug">
                                {feat.label}
                              </span>
                              <span className="block text-xs text-slate-400 font-medium mt-0.5">
                                On the free plan: {feat.free}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* CTA */}
                    <div className="px-6 pb-7">
                      {price ? (
                        <button
                          onClick={() => handleGetStarted(plan)}
                          className={`w-full flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg ${style.buttonClass} transition-all hover:shadow-xl`}
                        >
                          Get Started
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      ) : (
                        <p className="text-center text-xs text-slate-400 font-semibold py-2">
                          Not available for this interval
                        </p>
                      )}
                      <p className="text-center text-xs text-slate-400 font-semibold mt-2.5">
                        {interval === "month" ? "Cancel anytime" : "Billed once · Cancel before renewal"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Free Tier Banner */}
        <section className="bg-slate-50 border-t border-slate-100 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-1.5 text-xs font-bold text-emerald-700 mb-4">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Always Free — No Credit Card Required
              </div>
              <h2 className="text-2xl font-black text-slate-800">Start For Free, Upgrade When Ready</h2>
              <p className="text-slate-500 text-sm mt-2 max-w-lg mx-auto">
                Every new account includes free access to core features. Upgrade to a premium plan only when you need more.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {FREE_FEATURES.map((feat) => (
                <div key={feat} className="flex items-center gap-3 rounded-2xl bg-surface border border-slate-100 px-5 py-4 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-slate-700">{feat}</span>
                </div>
              ))}
            </div>

            {/* Said out loud, because a pricing page that only lists what you
                buy leaves people assuming the rest is locked. None of these are. */}
            <div className="mt-10 rounded-2xl border border-slate-100 bg-surface px-6 py-6">
              <h3 className="text-sm font-black text-slate-800">
                Not behind any paywall, on any plan
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {OPEN_TO_EVERYONE.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                    <span className="text-[13px] leading-snug text-slate-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center mt-8">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-7 py-3 text-sm font-black text-white hover:bg-slate-800 transition shadow-md"
              >
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Trust Signals */}
        <section className="border-t border-slate-100 py-12 bg-surface">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              {[
                { icon: Shield, title: "Secure Payments", desc: "256-bit SSL encrypted transactions via Razorpay" },
                { icon: Clock, title: "Cancel Anytime", desc: "No lock-in contracts — downgrade or cancel instantly" },
                { icon: Star, title: "Trusted by Aspirants", desc: "Thousands of UPSC students preparing with CoachingHub" }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 grid place-items-center text-indigo-600">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-black text-slate-800 text-sm">{item.title}</h3>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-xs">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
