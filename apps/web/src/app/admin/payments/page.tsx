"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, authenticatedGet, authenticatedPatch } from "../../../components/auth/auth-context";
import {
  ArrowLeft,
  BadgeIndianRupee,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Search,
  X
} from "lucide-react";

type ProductType = "subscription" | "study_plan" | "mentorship";
type PaymentStatus = "created" | "paid" | "failed" | "refunded";

type Payment = {
  id: number;
  user_id: number;
  product_type: ProductType;
  product_id: number | null;
  product_label: string | null;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  amount_minor: string | number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  source: string;
  notes: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  user: { id: number; email: string; username: string; role: string };
};

type Stats = {
  total_payments: number;
  paid_count: number;
  refunded_count: number;
  failed_count: number;
  gross_minor: string | number;
  refunded_minor: string | number;
  gross_minor_30d: string | number;
  subscription_count: number;
  study_plan_count: number;
  mentorship_count: number;
};

const PAGE_SIZE = 50;

function formatMoney(minor: string | number | null | undefined, currency = "INR") {
  const value = Number(minor ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const PRODUCT_LABELS: Record<ProductType, string> = {
  subscription: "Subscription",
  study_plan: "Study Plan",
  mentorship: "Mentorship"
};

const PRODUCT_COLORS: Record<ProductType, string> = {
  subscription: "bg-indigo-50 text-indigo-700 border-indigo-100",
  study_plan: "bg-emerald-50 text-emerald-700 border-emerald-100",
  mentorship: "bg-amber-50 text-amber-700 border-amber-100"
};

const STATUS_COLORS: Record<PaymentStatus, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  refunded: "bg-slate-200 text-slate-700",
  failed: "bg-rose-100 text-rose-800",
  created: "bg-amber-100 text-amber-800"
};

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { user, token, isInitialized } = useAuth();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [productFilter, setProductFilter] = useState<"all" | ProductType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [selected, setSelected] = useState<Payment | null>(null);
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    if (isInitialized && (!user || !["admin", "moderator"].includes(user.role))) {
      router.push("/");
    }
  }, [isInitialized, user, router]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE)
      });
      if (productFilter !== "all") params.set("product_type", productFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const [rows, statsData] = await Promise.all([
        authenticatedGet<Payment[]>(`/api/v1/admin/payments?${params.toString()}`, token),
        authenticatedGet<Stats>("/api/v1/admin/payments/stats", token)
      ]);
      setPayments(rows ?? []);
      setStats(statsData ?? null);
    } catch (err) {
      console.error("Failed to load payments:", err);
    } finally {
      setLoading(false);
    }
  }, [token, page, productFilter, statusFilter, search]);

  useEffect(() => {
    if (token) void fetchData();
  }, [token, fetchData]);

  const handleRefund = async (payment: Payment) => {
    if (!token) return;
    const notes = prompt(
      `Mark payment #${payment.id} as refunded?\n\nThis is RECORD-KEEPING ONLY — issue the actual refund in the Razorpay dashboard first.\n\nOptional note:`
    );
    if (notes === null) return;
    setRefunding(true);
    try {
      await authenticatedPatch(`/api/v1/admin/payments/${payment.id}/refund`, token, { notes });
      setSelected(null);
      void fetchData();
    } catch (err: any) {
      alert("Failed to mark refunded: " + err.message);
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-10">
      <div className="container mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Hub
          </Link>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <BadgeIndianRupee className="h-8 w-8 text-indigo-600" />
            Payments Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every payment across subscriptions, study plans and mentorship — for reconciliation, dispute lookup and service-delivery checks.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Gross received", value: formatMoney(stats.gross_minor), sub: `${stats.paid_count} paid payments` },
              { label: "Last 30 days", value: formatMoney(stats.gross_minor_30d), sub: "gross" },
              { label: "Refunded", value: formatMoney(stats.refunded_minor), sub: `${stats.refunded_count} refunds` },
              {
                label: "By product",
                value: `${stats.subscription_count} / ${stats.study_plan_count} / ${stats.mentorship_count}`,
                sub: "subs / plans / mentorship"
              }
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{card.label}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{card.value}</p>
                <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setSearch(searchInput);
            }}
            className="relative flex-1 min-w-[240px]"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search email, username, payment id, order id…"
              className="w-full rounded-xl border border-slate-200 bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
            />
          </form>

          <select
            value={productFilter}
            onChange={(e) => {
              setPage(0);
              setProductFilter(e.target.value as any);
            }}
            className="rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-sm font-bold outline-none"
          >
            <option value="all">All products</option>
            <option value="subscription">Subscriptions</option>
            <option value="study_plan">Study plans</option>
            <option value="mentorship">Mentorship</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(0);
              setStatusFilter(e.target.value as any);
            }}
            className="rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-sm font-bold outline-none"
          >
            <option value="all">Any status</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
            <option value="created">Created</option>
          </select>

          <button
            onClick={() => void fetchData()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment ID</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-400">
                      Loading payments…
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-400">
                      No payments match these filters.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDate(p.created_at)}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{p.user?.username}</p>
                        <p className="text-xs text-slate-500">{p.user?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${PRODUCT_COLORS[p.product_type]}`}>
                          {PRODUCT_LABELS[p.product_type]}
                        </span>
                        {p.product_label && <p className="mt-1 text-xs text-slate-500">{p.product_label}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-black text-slate-900">
                        {formatMoney(p.amount_minor, p.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[p.status]}`}>
                          {p.status}
                        </span>
                        {p.source === "simulated" && (
                          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800">
                            sim
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {p.provider_payment_id ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelected(p)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {payments.length} payment{payments.length === 1 ? "" : "s"} · page {page + 1}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              disabled={payments.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={() => setSelected(null)}>
          <div
            className="h-full w-full max-w-md overflow-y-auto bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Payment #{selected.id}</p>
                <h2 className="text-2xl font-black text-slate-900">
                  {formatMoney(selected.amount_minor, selected.currency)}
                </h2>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="space-y-3 text-sm">
              {[
                ["Status", selected.status],
                ["Product", `${PRODUCT_LABELS[selected.product_type]}${selected.product_label ? ` — ${selected.product_label}` : ""}`],
                ["Product ID", selected.product_id ?? "—"],
                ["User", `${selected.user?.username} (${selected.user?.email})`],
                ["Provider", selected.provider],
                ["Payment ID", selected.provider_payment_id ?? "—"],
                ["Order ID", selected.provider_order_id ?? "—"],
                ["Method", selected.method ?? "—"],
                ["Recorded via", selected.source],
                ["Created", formatDate(selected.created_at)],
                ["Updated", formatDate(selected.updated_at)]
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                  <dt className="shrink-0 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt>
                  <dd className="break-all text-right font-medium text-slate-800">{String(value)}</dd>
                </div>
              ))}
            </dl>

            {selected.notes && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Notes</p>
                <p className="mt-1 text-sm text-slate-700">{selected.notes}</p>
              </div>
            )}

            {selected.meta && Object.keys(selected.meta).length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Metadata</p>
                <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                  {JSON.stringify(selected.meta, null, 2)}
                </pre>
              </div>
            )}

            <div className="mt-6 space-y-2">
              {selected.provider_payment_id && (
                <a
                  href={`https://dashboard.razorpay.com/app/payments/${selected.provider_payment_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Razorpay
                </a>
              )}
              {selected.status === "paid" && user?.role === "admin" && (
                <button
                  disabled={refunding}
                  onClick={() => void handleRefund(selected)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  {refunding ? "Marking…" : "Mark as refunded"}
                </button>
              )}
              <p className="text-center text-[11px] leading-relaxed text-slate-400">
                Marking refunded updates this ledger only. Issue the actual refund in the Razorpay dashboard.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
