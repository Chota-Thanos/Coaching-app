"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth/auth-context";
import { PricingCheckoutModal } from "../../components/billing/pricing-checkout-modal";
import { browserBaseUrl } from "../../lib/api";
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

// Feature comparison matrix for each plan code
const PLAN_FEATURES: Record<string, { label: string; icon: React.ElementType; color: string }[]> = {
  assessment_premium: [
    { label: "Unlimited MCQ test creation", icon: Target, color: "text-blue-600" },
    { label: "Full GS & CSAT practice library", icon: BookOpen, color: "text-blue-600" },
    { label: "Premium curated test series", icon: Star, color: "text-blue-600" },
    { label: "AI-powered Mains answer evaluation", icon: Brain, color: "text-blue-600" },
    { label: "Performance radar & analytics", icon: BarChart3, color: "text-blue-600" },
    { label: "Revision bookmarks (unlimited)", icon: CheckCircle2, color: "text-blue-600" }
  ],
  current_affairs_pro: [
    { label: "Unlimited daily article reads", icon: Newspaper, color: "text-teal-600" },
    { label: "Syllabus-mapped editorial deep dives", icon: BookOpen, color: "text-teal-600" },
    { label: "Personal notes workspace", icon: Brain, color: "text-teal-600" },
    { label: "Topic collections & tagging", icon: CheckCircle2, color: "text-teal-600" },
    { label: "Reading progress tracking", icon: BarChart3, color: "text-teal-600" },
    { label: "CA to Prelims question mapping", icon: Target, color: "text-teal-600" }
  ],
  assessment_ca_bundle: [
    { label: "Everything in Assessment Premium", icon: Target, color: "text-indigo-600" },
    { label: "Everything in Current Affairs Pro", icon: Newspaper, color: "text-indigo-600" },
    { label: "Priority access to new features", icon: Zap, color: "text-indigo-600" },
    { label: "Combined performance dashboard", icon: BarChart3, color: "text-indigo-600" },
    { label: "Mentor session discounts", icon: Users, color: "text-indigo-600" },
    { label: "Dedicated support channel", icon: Shield, color: "text-indigo-600" }
  ]
};

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
    gradient: "from-blue-50 to-white",
    badge: null,
    badgeClass: "",
    border: "border-blue-100",
    headerBg: "bg-gradient-to-br from-blue-600 to-blue-700",
    buttonClass: "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
    iconBg: "bg-blue-100",
    iconText: "text-blue-700",
    icon: Target
  },
  current_affairs_pro: {
    gradient: "from-teal-50 to-white",
    badge: null,
    badgeClass: "",
    border: "border-teal-100",
    headerBg: "bg-gradient-to-br from-teal-600 to-teal-700",
    buttonClass: "bg-teal-600 hover:bg-teal-700 shadow-teal-200",
    iconBg: "bg-teal-100",
    iconText: "text-teal-700",
    icon: Newspaper
  },
  assessment_ca_bundle: {
    gradient: "from-indigo-50 via-purple-50/40 to-white",
    badge: "Most Popular",
    badgeClass: "bg-gradient-to-r from-indigo-500 to-purple-600 text-white",
    border: "border-indigo-200 ring-2 ring-indigo-200",
    headerBg: "bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700",
    buttonClass: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200",
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-700",
    icon: Sparkles
  }
};

// Free tier features shown at top
const FREE_FEATURES = [
  "Create up to 10 MCQ tests per day",
  "Read up to 5 Current Affairs articles per day",
  "Syllabus tracker & revision bookmarks",
  "Basic performance stats"
];

export default function PricingPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<PlanPrice | null>(null);

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

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-indigo-950 to-indigo-900 text-white">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.4),rgba(0,0,0,0))]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
          </div>

          <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-400/20 px-4 py-1.5 text-xs font-bold text-indigo-300 mb-6">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Transparent Pricing · No Hidden Fees
            </div>

            <h1 className="text-4xl font-black md:text-6xl tracking-tight text-white leading-tight mb-4">
              Invest in Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
                UPSC Success
              </span>
            </h1>
            <p className="text-indigo-200/80 text-lg max-w-2xl mx-auto leading-relaxed mb-10">
              Choose a plan that fits your preparation stage. Start free, upgrade when you're ready.
            </p>

            {/* Interval Toggle */}
            <div className="inline-flex items-center gap-1 rounded-2xl bg-white/10 border border-white/10 p-1.5 backdrop-blur-sm">
              {(["month", "quarter", "year"] as BillingInterval[]).map((iv) => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  className={`relative rounded-xl px-5 py-2 text-sm font-bold transition-all ${
                    interval === iv
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-indigo-200 hover:text-white"
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
                            <span className="text-sm text-slate-700 font-semibold">{feat.label}</span>
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
                <div key={feat} className="flex items-center gap-3 rounded-2xl bg-white border border-slate-100 px-5 py-4 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-slate-700">{feat}</span>
                </div>
              ))}
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
        <section className="border-t border-slate-100 py-12 bg-white">
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
