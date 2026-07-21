"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, authenticatedGet, authenticatedPatch } from "../../../components/auth/auth-context";
import { tabStripClass, tabButtonClass } from "../../../components/ui/tabs";
import {
  CreditCard,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  ChevronRight,
  User,
  Newspaper,
  Target,
  Sparkles,
  Clock,
  XCircle,
  RefreshCw,
  Zap,
  AlertCircle
} from "lucide-react";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

type SubscriptionStatus = "active" | "pending" | "inactive" | "cancelled" | "expired";

type Subscription = {
  id: number;
  plan_id: number;
  status: SubscriptionStatus;
  starts_at: string;
  ends_at: string | null;
  provider: string | null;
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
  plan: {
    id: number;
    code: string;
    name: string;
    description: string | null;
  };
};

type MentorshipRequest = {
  id: number;
  mentor_id: number;
  preferred_mode: string;
  note: string | null;
  status: string;
  payment_status: "pending" | "paid" | "refunded" | "failed";
  payment_amount: number;
  payment_currency: string;
  created_at: string;
  updated_at: string;
  mentor_name: string;
};

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; cls: string; icon: React.ElementType }> = {
  active: { label: "Active", cls: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2 },
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-100", icon: Clock },
  inactive: { label: "Inactive", cls: "bg-slate-50 text-slate-600 border-slate-100", icon: XCircle },
  cancelled: { label: "Cancelled", cls: "bg-rose-50 text-rose-700 border-rose-100", icon: XCircle },
  expired: { label: "Expired", cls: "bg-slate-50 text-slate-500 border-slate-100", icon: Clock }
};

const PLAN_ICON: Record<string, React.ElementType> = {
  assessment_premium: Target,
  current_affairs_pro: Newspaper,
  assessment_ca_bundle: Sparkles
};

const PLAN_COLOR: Record<string, string> = {
  assessment_premium: "bg-blue-50 text-blue-600",
  current_affairs_pro: "bg-teal-50 text-teal-600",
  assessment_ca_bundle: "bg-indigo-50 text-indigo-600"
};

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function fmtDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// -------------------------------------------------------------------------
// Main Page
// -------------------------------------------------------------------------

type TabKey = "subscriptions" | "mentorship" | "payments";

/** A row from the unified billing.payments ledger — covers subscriptions,
 *  study plans and mentorship, so study-plan purchases finally show up here. */
type PaymentRow = {
  id: number;
  product_type: "subscription" | "study_plan" | "mentorship";
  product_id: number | null;
  product_label: string | null;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  amount_minor: string | number;
  currency: string;
  status: "created" | "paid" | "failed" | "refunded";
  method: string | null;
  created_at: string;
};

const PAYMENT_PRODUCT_LABELS: Record<PaymentRow["product_type"], string> = {
  subscription: "Subscription",
  study_plan: "Study Plan",
  mentorship: "Mentorship"
};

function formatPaymentAmount(minor: string | number, currency = "INR") {
  const value = Number(minor ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export default function PurchasesPage() {
  const router = useRouter();
  const { user, token, isInitialized } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("subscriptions");
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [mentorPurchases, setMentorPurchases] = useState<MentorshipRequest[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  useEffect(() => {
    if (isInitialized && !user) {
      router.push("/login");
    }
  }, [isInitialized, user, router]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [subs, mentorReqs, paymentRows] = await Promise.all([
        authenticatedGet<Subscription[]>("/api/v1/billing/me/subscriptions", token),
        authenticatedGet<MentorshipRequest[]>("/api/v1/mentorship/requests?mode=user", token),
        authenticatedGet<PaymentRow[]>("/api/v1/billing/me/payments", token)
      ]);
      setSubscriptions(subs ?? []);
      setMentorPurchases((mentorReqs ?? []).filter((r) => r.payment_status === "paid"));
      setPayments(paymentRows ?? []);
    } catch (err) {
      console.error("Failed to fetch purchases:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void fetchData();
  }, [token, fetchData]);

  const handleCancelSubscription = useCallback(
    async (id: number) => {
      if (!token || !confirm("Are you sure you want to cancel this subscription?")) return;
      setCancellingId(id);
      try {
        await authenticatedPatch("/api/v1/billing/subscriptions/" + id, token, { status: "cancelled" });
        await fetchData();
      } catch (err) {
        alert("Failed to cancel subscription. Please try again.");
      } finally {
        setCancellingId(null);
      }
    },
    [token, fetchData]
  );

  if (!isInitialized || (loading && subscriptions.length === 0 && mentorPurchases.length === 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="font-bold text-slate-600 text-sm">Loading your purchases...</p>
        </div>
      </div>
    );
  }

  const activeSubs = subscriptions.filter(
    (s) => s.status === "active" && (s.ends_at === null || new Date(s.ends_at) >= new Date())
  );

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 pb-8 mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">My Purchases</h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">
              Manage your subscriptions, mentorship bookings, and billing records.
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm"
          >
            <Zap className="h-3.5 w-3.5" />
            Upgrade Plan
          </Link>
        </div>

        {/* Active Subscription Summary Banner */}
        {activeSubs.length > 0 && (
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white flex items-center justify-between gap-4 shadow-lg shadow-indigo-200">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-white/15 grid place-items-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-200">Active Subscription</p>
                <p className="font-black text-white">
                  {activeSubs.map((s) => s.plan.name).join(" + ")}
                </p>
                {activeSubs[0]?.ends_at && (
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Renews {fmtDate(activeSubs[0].ends_at)}
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/pricing"
              className="flex-shrink-0 rounded-xl bg-white/20 border border-white/20 hover:bg-white/30 px-4 py-2 text-xs font-bold text-white transition"
            >
              Manage
            </Link>
          </div>
        )}

        {/* Tabs */}
        <div className={tabStripClass("mb-8")}>
          {([
            { key: "subscriptions", label: "Subscriptions", count: subscriptions.length },
            { key: "mentorship", label: "Mentorship Sessions", count: mentorPurchases.length },
            { key: "payments", label: "Payment History", count: payments.length }
          ] as { key: TabKey; label: string; count: number }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={tabButtonClass(activeTab === tab.key)}
            >
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-black ${
                  activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Subscriptions Tab ── */}
        {activeTab === "subscriptions" && (
          <div className="space-y-4">
            {subscriptions.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 mb-6">
                  <CreditCard className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-black text-slate-800">No subscriptions yet</h3>
                <p className="mx-auto max-w-sm text-sm text-slate-500 mt-2">
                  Unlock premium assessment tools, unlimited current affairs access, and more with a subscription.
                </p>
                <div className="mt-8">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition shadow-sm"
                  >
                    View Plans
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              subscriptions.map((sub) => {
                const status = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.inactive;
                const StatusIcon = status.icon;
                const PlanIcon = PLAN_ICON[sub.plan.code] ?? CreditCard;
                const planColorCls = PLAN_COLOR[sub.plan.code] ?? "bg-indigo-50 text-indigo-600";
                const isActive = sub.status === "active" && (sub.ends_at === null || new Date(sub.ends_at) >= new Date());

                return (
                  <div
                    key={sub.id}
                    className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden hover:shadow-md transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-6">
                      <div className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl ${planColorCls}`}>
                        <PlanIcon className="h-6 w-6" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-slate-800">{sub.plan.name}</h3>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${status.cls}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5">
                          <span className="text-xs text-slate-500 font-semibold">
                            Started {fmtDate(sub.starts_at)}
                          </span>
                          {sub.ends_at ? (
                            <span className="text-xs text-slate-500 font-semibold">
                              {isActive ? "Renews" : "Expired"} {fmtDate(sub.ends_at)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 font-semibold">
                              Lifetime / manual renewal
                            </span>
                          )}
                          {sub.provider && (
                            <span className="text-xs text-slate-400 font-semibold capitalize">
                              via {sub.provider}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isActive && (
                          <button
                            onClick={() => handleCancelSubscription(sub.id)}
                            disabled={cancellingId === sub.id}
                            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition disabled:opacity-60"
                          >
                            {cancellingId === sub.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            Cancel
                          </button>
                        )}
                        {!isActive && (
                          <Link
                            href="/pricing"
                            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Renew
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Mentorship Tab ── */}
        {activeTab === "mentorship" && (
          <div>
            {mentorPurchases.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 mb-6">
                  <User className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-black text-slate-800">No mentorship sessions yet</h3>
                <p className="mx-auto max-w-sm text-sm text-slate-500 mt-2">
                  Book a session with a verified UPSC mentor to get personalized guidance.
                </p>
                <div className="mt-8">
                  <Link
                    href="/mentors"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition shadow-sm"
                  >
                    Find a Mentor
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-black text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4">Transaction / Item</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Receipt</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {mentorPurchases.map((purchase) => (
                        <tr key={purchase.id} className="hover:bg-slate-50/40 transition">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                                <User className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">
                                  1-on-1 Mentorship with {purchase.mentor_name || "Verified Mentor"}
                                </p>
                                <p className="text-xs text-slate-400 font-semibold mt-0.5 capitalize">
                                  Mode: {purchase.preferred_mode}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-slate-500 font-semibold text-xs">
                            {fmtDateTime(purchase.updated_at)}
                          </td>
                          <td className="px-6 py-5 text-slate-500 font-mono text-xs">
                            RCPT-MNT-{purchase.id.toString().padStart(6, "0")}
                          </td>
                          <td className="px-6 py-5 font-black text-slate-800 text-xs">
                            {purchase.payment_currency?.toUpperCase() === "INR" ? "₹" : "$"}
                            {purchase.payment_amount.toLocaleString("en-IN")}
                          </td>
                          <td className="px-6 py-5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-100">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Paid
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <Link
                              href="/dashboard/mentorship"
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition"
                            >
                              Launch Desk
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Payment History Tab ──
            Reads the unified billing.payments ledger, so study-plan purchases
            (previously invisible on this page) appear alongside everything else. */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            {payments.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                <p className="text-sm font-bold text-slate-700">No payments yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Anything you purchase — subscriptions, study plans or mentorship — will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Item</th>
                        <th className="px-5 py-3 text-right">Amount</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-600">
                            {fmtDate(p.created_at)}
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-bold text-slate-800">
                              {p.product_label ?? PAYMENT_PRODUCT_LABELS[p.product_type]}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {PAYMENT_PRODUCT_LABELS[p.product_type]}
                              {p.method ? ` · ${p.method}` : ""}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right font-black text-slate-900">
                            {formatPaymentAmount(p.amount_minor, p.currency)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                p.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : p.status === "refunded"
                                    ? "bg-slate-200 text-slate-700"
                                    : p.status === "failed"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                            {p.provider_payment_id ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                  <p className="text-[11px] text-slate-500">
                    Need an invoice or have a question about a charge? Quote the reference above when contacting support.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
