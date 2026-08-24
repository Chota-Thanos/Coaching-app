"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle
} from "lucide-react";
import { useAuth, authenticatedGet, authenticatedPatch, authenticatedPost } from "../auth/auth-context";
import { SignInPanel } from "../auth/sign-in-panel";
import { formatPrice, BILLING_INTERVAL_LABELS, SUBSCRIPTION_MODULES } from "../../lib/subscription-plans";

// -----------------------------------------------------------------------------
// Types — mirror apps/api/src/modules/billing/service.ts response shapes
// -----------------------------------------------------------------------------

type PlanPrice = {
  id: number;
  plan_id: number;
  currency: string;
  amount_minor: number;
  billing_interval: "one_time" | "month" | "quarter" | "year";
  is_active: boolean;
};

type PlanEntitlement = {
  id: number;
  entitlement_key: string;
  limit_value: number | null;
  metadata: Record<string, unknown>;
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

const INTERVAL_ORDER: PlanPrice["billing_interval"][] = ["month", "quarter", "year", "one_time"];

function sortPrices(prices: PlanPrice[]): PlanPrice[] {
  return [...prices].sort((a, b) => INTERVAL_ORDER.indexOf(a.billing_interval) - INTERVAL_ORDER.indexOf(b.billing_interval));
}

// -----------------------------------------------------------------------------
// Root
// -----------------------------------------------------------------------------

export function AdminSubscriptionPlans() {
  const { token, user, isInitialized } = useAuth();

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
        <div className="animate-pulse rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-ink/50">Verifying session…</p>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-16 pt-10">
        <section className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
          <h1 className="text-2xl font-black text-ink">Admin Portal</h1>
          <p className="mt-2 text-sm text-ink/70">Sign in with an admin account to manage subscriptions.</p>
          <div className="mt-6">
            <SignInPanel />
          </div>
        </section>
      </main>
    );
  }

  if (user?.role !== "admin") {
    return (
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
        <section className="rounded-2xl border border-berry/30 bg-berry/10 p-8">
          <h1 className="text-2xl font-black text-ink">Access Restricted</h1>
          <p className="mt-2 text-sm font-semibold text-berry">
            Only accounts with the admin role can edit subscription plans, prices, or entitlements.
          </p>
        </section>
      </main>
    );
  }

  return <PlansEditor token={token} />;
}

// -----------------------------------------------------------------------------
// Editor
// -----------------------------------------------------------------------------

function PlansEditor({ token }: { token: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriberCounts, setSubscriberCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authenticatedGet<Plan[]>("/api/v1/billing/plans", token);
      setPlans(data);

      // One count per plan, run in parallel — small, fixed list of plans, so
      // this stays a handful of requests rather than needing a dedicated
      // per-plan stats endpoint.
      const counts = await Promise.all(
        data.map(async (plan) => {
          const subs = await authenticatedGet<unknown[]>(
            `/api/v1/billing/subscriptions?plan_id=${plan.id}&status=active&limit=1`,
            token
          );
          return [plan.id, Array.isArray(subs) ? subs.length : 0] as const;
        })
      );
      setSubscriberCounts(Object.fromEntries(counts));
    } catch (err) {
      console.error("Failed to load plans", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const planOrder = ["assessment_premium", "current_affairs_pro", "assessment_ca_bundle"];
  const orderedPlans = [...plans].sort((a, b) => planOrder.indexOf(a.code) - planOrder.indexOf(b.code));

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-bold text-ink/50 hover:text-civic">
            <ArrowLeft className="h-3.5 w-3.5" />
            Admin Portal
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-civic/10 text-civic">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-ink">Manage Subscriptions</h1>
              <p className="text-sm text-ink/60">Edit plan names, prices, and what each one unlocks.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/purchases"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-bold text-ink/70 hover:border-civic/40 hover:text-civic"
          >
            <Users className="h-3.5 w-3.5" />
            Per-user records
          </Link>
          <Link
            href="/pricing"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-bold text-ink/70 hover:border-civic/40 hover:text-civic"
          >
            View live pricing page
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-bold text-ink/70 hover:border-civic/40 hover:text-civic disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
        <p className="text-xs font-semibold leading-relaxed text-amber-800">
          <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5" />
          Every feature listed on the live pricing page is generated from{" "}
          <code className="rounded bg-white/60 px-1 py-0.5 font-mono">lib/subscription-plans.ts</code>, which mirrors what
          the server actually enforces. Editing a plan here changes its name, description, prices, and entitlement
          records — it does not change what those entitlements unlock in the product. To sell a new limit, the code
          that enforces it has to exist first.
        </p>
      </div>

      {loading && plans.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-line bg-surface p-16">
          <Loader2 className="h-6 w-6 animate-spin text-civic" />
        </div>
      ) : (
        <div className="space-y-4">
          {orderedPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              token={token}
              subscriberCount={subscriberCounts[plan.id] ?? 0}
              expanded={expandedId === plan.id}
              onToggle={() => setExpandedId((prev) => (prev === plan.id ? null : plan.id))}
              onSaved={load}
            />
          ))}
        </div>
      )}
    </main>
  );
}

// -----------------------------------------------------------------------------
// One plan: identity, prices, entitlements
// -----------------------------------------------------------------------------

function PlanCard({
  plan,
  token,
  subscriberCount,
  expanded,
  onToggle,
  onSaved
}: {
  plan: Plan;
  token: string;
  subscriberCount: number;
  expanded: boolean;
  onToggle: () => void;
  onSaved: () => Promise<void>;
}) {
  const linkedModule = SUBSCRIPTION_MODULES.find((m) => m.planCode === plan.code);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-paper/60"
      >
        <div className="flex items-center gap-3.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-civic/10 text-civic">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-black text-ink">{plan.name}</h2>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-500">{plan.code}</code>
              {plan.is_active ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-extrabold text-slate-500">
                  <XCircle className="h-3 w-3" /> Hidden
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink/50">
              {subscriberCount} active subscriber{subscriberCount === 1 ? "" : "s"}
              {linkedModule ? ` · unlocks ${linkedModule.name}` : ""}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-ink/40 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-6 border-t border-line/60 px-6 py-6">
          <PlanIdentityForm plan={plan} token={token} onSaved={onSaved} />
          <PricesEditor plan={plan} token={token} onSaved={onSaved} />
          <EntitlementsEditor plan={plan} token={token} onSaved={onSaved} />
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Identity: name, description, active toggle
// -----------------------------------------------------------------------------

function PlanIdentityForm({ plan, token, onSaved }: { plan: Plan; token: string; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [isActive, setIsActive] = useState(plan.is_active);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = name !== plan.name || description !== (plan.description ?? "") || isActive !== plan.is_active;

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await authenticatedPatch(`/api/v1/billing/plans/${plan.id}`, token, {
        name: name.trim(),
        description: description.trim() || null,
        is_active: isActive
      });
      await onSaved();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save plan", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-ink/40">Plan details</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink/60">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm font-semibold text-ink outline-none focus:border-civic"
          />
        </label>
        <label className="flex items-end pb-1">
          <button
            type="button"
            onClick={() => setIsActive((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
              isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            {isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {isActive ? "Visible on pricing page" : "Hidden from pricing page"}
          </button>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-bold text-ink/60">Description shown under the plan name</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-civic"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-civic px-4 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save details
        </button>
        {saved && <span className="text-xs font-bold text-emerald-600">Saved</span>}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prices: one row per billing interval
// -----------------------------------------------------------------------------

function PricesEditor({ plan, token, onSaved }: { plan: Plan; token: string; onSaved: () => Promise<void> }) {
  const [adding, setAdding] = useState(false);

  const existingIntervals = new Set(plan.prices.map((p) => p.billing_interval));
  const availableIntervals = INTERVAL_ORDER.filter((i) => !existingIntervals.has(i));

  return (
    <div className="space-y-3 border-t border-line/60 pt-6">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-wider text-ink/40">Prices</p>
        {availableIntervals.length > 0 && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-bold text-civic hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add a billing interval
          </button>
        )}
      </div>

      <div className="space-y-2">
        {sortPrices(plan.prices).map((price) => (
          <PriceRow key={price.id} price={price} token={token} onSaved={onSaved} />
        ))}
        {plan.prices.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-4 py-3 text-xs text-ink/50">
            No prices yet — this plan cannot be subscribed to until at least one is added.
          </p>
        )}
      </div>

      {adding && (
        <NewPriceRow
          planId={plan.id}
          token={token}
          availableIntervals={availableIntervals}
          onDone={async () => {
            setAdding(false);
            await onSaved();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function PriceRow({ price, token, onSaved }: { price: PlanPrice; token: string; onSaved: () => Promise<void> }) {
  const [amount, setAmount] = useState(String(price.amount_minor / 100));
  const [isActive, setIsActive] = useState(price.is_active);
  const [saving, setSaving] = useState(false);

  const dirty = Number(amount) * 100 !== price.amount_minor || isActive !== price.is_active;
  const amountValid = amount.trim() !== "" && Number.isFinite(Number(amount)) && Number(amount) >= 0;

  async function save() {
    if (!amountValid) return;
    setSaving(true);
    try {
      await authenticatedPatch(`/api/v1/billing/plan-prices/${price.id}`, token, {
        amount_minor: Math.round(Number(amount) * 100),
        is_active: isActive
      });
      await onSaved();
    } catch (err) {
      console.error("Failed to save price", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line/60 px-4 py-3">
      <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-ink/50">
        {BILLING_INTERVAL_LABELS[price.billing_interval] ?? price.billing_interval}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-ink/40">₹</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="w-24 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm font-bold text-ink outline-none focus:border-civic"
        />
      </div>
      <button
        type="button"
        onClick={() => setIsActive((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
          isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"
        }`}
      >
        {isActive ? "Active" : "Disabled"}
      </button>
      <span className="text-xs text-ink/40">was {formatPrice(price.amount_minor)}</span>
      <button
        type="button"
        onClick={() => void save()}
        disabled={!dirty || !amountValid || saving}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-civic/10 px-3 py-1.5 text-[11px] font-bold text-civic transition hover:bg-civic/20 disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Save
      </button>
    </div>
  );
}

function NewPriceRow({
  planId,
  token,
  availableIntervals,
  onDone,
  onCancel
}: {
  planId: number;
  token: string;
  availableIntervals: PlanPrice["billing_interval"][];
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [interval, setInterval] = useState<PlanPrice["billing_interval"]>(availableIntervals[0] ?? "month");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const amountValid = amount.trim() !== "" && Number.isFinite(Number(amount)) && Number(amount) >= 0;

  async function create() {
    if (!amountValid) return;
    setSaving(true);
    try {
      await authenticatedPost(`/api/v1/billing/plans/${planId}/prices`, token, {
        amount_minor: Math.round(Number(amount) * 100),
        billing_interval: interval,
        currency: "INR",
        is_active: true
      });
      await onDone();
    } catch (err) {
      console.error("Failed to add price", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-civic/40 bg-civic/[0.03] px-4 py-3">
      <select
        value={interval}
        onChange={(e) => setInterval(e.target.value as PlanPrice["billing_interval"])}
        className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-bold text-ink outline-none focus:border-civic"
      >
        {availableIntervals.map((i) => (
          <option key={i} value={i}>
            {BILLING_INTERVAL_LABELS[i] ?? i}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-ink/40">₹</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          inputMode="decimal"
          className="w-24 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm font-bold text-ink outline-none focus:border-civic"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={onCancel} className="text-xs font-bold text-ink/50 hover:text-ink">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void create()}
          disabled={!amountValid || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-civic px-3 py-1.5 text-[11px] font-bold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add price
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Entitlements: what buying this plan actually grants
// -----------------------------------------------------------------------------

/** Every entitlement key the server currently checks somewhere. Not an
 *  exhaustive list of what COULD exist — a reminder, at the point an admin is
 *  about to add one, of which keys are wired to an actual gate. Adding a key
 *  outside this list is still allowed (the input is free text), but it will
 *  not unlock anything until server code checks for it. */
const KNOWN_ENFORCED_KEYS = [
  "assessment.premium_tests",
  "assessment.ai_evaluation",
  "current_affairs.notes_workspace",
  "current_affairs.editorial_access"
];

function EntitlementsEditor({ plan, token, onSaved }: { plan: Plan; token: string; onSaved: () => Promise<void> }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3 border-t border-line/60 pt-6">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-wider text-ink/40">Entitlements</p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-bold text-civic hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add entitlement
          </button>
        )}
      </div>

      <div className="space-y-2">
        {plan.entitlements.map((ent) => (
          <EntitlementRow key={ent.id} entitlement={ent} token={token} onSaved={onSaved} />
        ))}
        {plan.entitlements.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-4 py-3 text-xs text-ink/50">
            No entitlements — subscribing to this plan would not unlock anything.
          </p>
        )}
      </div>

      {adding && (
        <NewEntitlementRow
          planId={plan.id}
          token={token}
          onDone={async () => {
            setAdding(false);
            await onSaved();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function EntitlementRow({
  entitlement,
  token,
  onSaved
}: {
  entitlement: PlanEntitlement;
  token: string;
  onSaved: () => Promise<void>;
}) {
  const [limitValue, setLimitValue] = useState(entitlement.limit_value === null ? "" : String(entitlement.limit_value));
  const [saving, setSaving] = useState(false);

  const isKnown = KNOWN_ENFORCED_KEYS.includes(entitlement.entitlement_key);
  const currentLimit = entitlement.limit_value === null ? "" : String(entitlement.limit_value);
  const dirty = limitValue !== currentLimit;

  async function save() {
    setSaving(true);
    try {
      await authenticatedPatch(`/api/v1/billing/entitlements/${entitlement.id}`, token, {
        limit_value: limitValue.trim() === "" ? null : Math.max(0, Math.round(Number(limitValue)))
      });
      await onSaved();
    } catch (err) {
      console.error("Failed to save entitlement", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line/60 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <code className="truncate rounded bg-slate-100 px-2 py-1 text-[11.5px] font-bold text-slate-600">
          {entitlement.entitlement_key}
        </code>
        {!isKnown && (
          <span
            title="No server-side check currently reads this key — granting it will not unlock anything in the product yet."
            className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700"
          >
            Not enforced yet
          </span>
        )}
      </div>
      <label className="flex shrink-0 items-center gap-1.5">
        <span className="text-[11px] font-bold text-ink/50">Limit</span>
        <input
          value={limitValue}
          onChange={(e) => setLimitValue(e.target.value)}
          placeholder="unlimited"
          inputMode="numeric"
          className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs font-bold text-ink outline-none focus:border-civic"
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={!dirty || saving}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-civic/10 px-3 py-1.5 text-[11px] font-bold text-civic transition hover:bg-civic/20 disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Save
      </button>
    </div>
  );
}

function NewEntitlementRow({
  planId,
  token,
  onDone,
  onCancel
}: {
  planId: number;
  token: string;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("");
  const [limitValue, setLimitValue] = useState("");
  const [saving, setSaving] = useState(false);

  const keyValid = key.trim().length > 0;

  async function create() {
    if (!keyValid) return;
    setSaving(true);
    try {
      await authenticatedPost(`/api/v1/billing/plans/${planId}/entitlements`, token, {
        entitlement_key: key.trim(),
        limit_value: limitValue.trim() === "" ? null : Math.max(0, Math.round(Number(limitValue)))
      });
      await onDone();
    } catch (err) {
      console.error("Failed to add entitlement", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-civic/40 bg-civic/[0.03] px-4 py-3">
      <input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="e.g. assessment.premium_tests"
        list="known-entitlement-keys"
        className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-civic"
      />
      <datalist id="known-entitlement-keys">
        {KNOWN_ENFORCED_KEYS.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <label className="flex shrink-0 items-center gap-1.5">
        <span className="text-[11px] font-bold text-ink/50">Limit</span>
        <input
          value={limitValue}
          onChange={(e) => setLimitValue(e.target.value)}
          placeholder="unlimited"
          inputMode="numeric"
          className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs font-bold text-ink outline-none focus:border-civic"
        />
      </label>
      <button type="button" onClick={onCancel} className="text-xs font-bold text-ink/50 hover:text-ink">
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void create()}
        disabled={!keyValid || saving}
        className="inline-flex items-center gap-1.5 rounded-lg bg-civic px-3 py-1.5 text-[11px] font-bold text-white transition hover:brightness-110 disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        Add
      </button>
    </div>
  );
}
