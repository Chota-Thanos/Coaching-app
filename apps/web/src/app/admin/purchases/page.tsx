"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, authenticatedGet, authenticatedPatch } from "../../../components/auth/auth-context";
import {
  CreditCard,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  TrendingUp,
  Zap,
  BarChart3,
  ExternalLink,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  AlertCircle
} from "lucide-react";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

type SubscriptionStatus = "active" | "pending" | "inactive" | "cancelled" | "expired";

type AdminSubscription = {
  id: number;
  user_id: number;
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
  user: {
    id: number;
    email: string;
    username: string;
  };
};

type Stats = {
  active_count: string;
  inactive_count: string;
  total_count: string;
  active_subscribers: string;
};

// -------------------------------------------------------------------------
// Config
// -------------------------------------------------------------------------

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; cls: string; icon: React.ElementType }> = {
  active: { label: "Active", cls: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2 },
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-100", icon: Clock },
  inactive: { label: "Inactive", cls: "bg-slate-50 text-slate-600 border-slate-100", icon: XCircle },
  cancelled: { label: "Cancelled", cls: "bg-rose-50 text-rose-700 border-rose-100", icon: XCircle },
  expired: { label: "Expired", cls: "bg-slate-50 text-slate-500 border-slate-100", icon: Clock }
};

const STATUSES: (SubscriptionStatus | "all")[] = ["all", "active", "pending", "cancelled", "expired", "inactive"];

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

// -------------------------------------------------------------------------
// Main Page
// -------------------------------------------------------------------------

const PAGE_SIZE = 20;

export default function AdminPurchasesPage() {
  const router = useRouter();
  const { user, token, isInitialized } = useAuth();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "all">("all");
  const [page, setPage] = useState(0);

  // Data
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  // Auth guard
  useEffect(() => {
    if (isInitialized && (!user || user.role !== "admin")) {
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
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const [subs, statsData] = await Promise.all([
        authenticatedGet<AdminSubscription[]>(`/api/v1/billing/subscriptions?${params.toString()}`, token),
        authenticatedGet<Stats>("/api/v1/billing/subscriptions/stats", token)
      ]);
      setSubscriptions(subs ?? []);
      setStats(statsData ?? null);
    } catch (err) {
      console.error("Failed to fetch admin subscriptions:", err);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, search, page]);

  useEffect(() => {
    if (token) void fetchData();
  }, [token, fetchData]);

  const handleUpdateStatus = useCallback(
    async (id: number, newStatus: SubscriptionStatus) => {
      if (!token) return;
      setUpdating(id);
      try {
        await authenticatedPatch(`/api/v1/billing/subscriptions/${id}`, token, { status: newStatus });
        await fetchData();
      } catch (err) {
        alert("Failed to update subscription status.");
      } finally {
        setUpdating(null);
      }
    },
    [token, fetchData]
  );

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Active Subscribers",
      value: stats?.active_subscribers ?? "—",
      icon: Users,
      cls: "bg-emerald-50 text-emerald-700",
      iconCls: "text-emerald-600"
    },
    {
      label: "Active Subscriptions",
      value: stats?.active_count ?? "—",
      icon: CheckCircle2,
      cls: "bg-blue-50 text-blue-700",
      iconCls: "text-blue-600"
    },
    {
      label: "Total Subscriptions",
      value: stats?.total_count ?? "—",
      icon: CreditCard,
      cls: "bg-indigo-50 text-indigo-700",
      iconCls: "text-indigo-600"
    },
    {
      label: "Cancelled / Expired",
      value: stats?.inactive_count ?? "—",
      icon: XCircle,
      cls: "bg-rose-50 text-rose-700",
      iconCls: "text-rose-600"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6 border-b border-slate-200/60">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold mb-1">
              <Link href="/admin" className="hover:text-slate-800 transition">Admin</Link>
              <span>·</span>
              <span>Purchases</span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Purchase Records</h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">
              All subscription records across all users. Manage, activate, or cancel subscriptions.
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            target="_blank"
          >
            View Pricing Page
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-2xl bg-surface border border-slate-200/80 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-500">{card.label}</p>
                  <div className={`h-8 w-8 rounded-xl ${card.cls} grid place-items-center`}>
                    <Icon className={`h-4 w-4 ${card.iconCls}`} />
                  </div>
                </div>
                <p className="text-3xl font-black text-slate-800">{card.value}</p>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by email or username..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full rounded-xl border border-slate-200 bg-surface pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(0); }}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition capitalize ${
                  statusFilter === s
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-surface border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-surface shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-slate-50 grid place-items-center text-slate-400 mb-4">
                <CreditCard className="h-7 w-7" />
              </div>
              <h3 className="font-black text-slate-800">No subscriptions found</h3>
              <p className="text-sm text-slate-500 mt-1">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-black text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3.5">User</th>
                    <th className="px-5 py-3.5">Plan</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Started</th>
                    <th className="px-5 py-3.5">Expires</th>
                    <th className="px-5 py-3.5">Provider</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptions.map((sub) => {
                    const statusConf = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.inactive;
                    const StatusIcon = statusConf.icon;
                    const isActive = sub.status === "active";

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition text-sm">
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-bold text-slate-800">{sub.user.username}</p>
                            <p className="text-xs text-slate-400 font-semibold">{sub.user.email}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-700">{sub.plan.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{sub.plan.code}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusConf.cls}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusConf.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500 font-semibold">
                          {fmtDate(sub.starts_at)}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500 font-semibold">
                          {sub.ends_at ? fmtDate(sub.ends_at) : <span className="text-slate-400">Lifetime</span>}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400 font-semibold capitalize">
                          {sub.provider ?? "—"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isActive && (
                              <button
                                disabled={updating === sub.id}
                                onClick={() => handleUpdateStatus(sub.id, "active")}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-60"
                              >
                                {updating === sub.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                Activate
                              </button>
                            )}
                            {isActive && (
                              <button
                                disabled={updating === sub.id}
                                onClick={() => handleUpdateStatus(sub.id, "cancelled")}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-60"
                              >
                                {updating === sub.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && subscriptions.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
              <p className="text-xs font-semibold text-slate-500">
                Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + subscriptions.length} results
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-slate-200 bg-surface p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-bold text-slate-700">Page {page + 1}</span>
                <button
                  disabled={subscriptions.length < PAGE_SIZE}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 bg-surface p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
