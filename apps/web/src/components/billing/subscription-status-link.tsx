"use client";

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { useAuth } from "../auth/auth-context";
import { useSubscription } from "../../lib/use-subscription";
import { SUBSCRIPTION_MODULES, isModuleActive } from "../../lib/subscription-plans";

/**
 * The single subscription entry point, shown in the top bar.
 *
 * Not subscribed  → "Upgrade", pointing at /pricing.
 * Subscribed      → "Subscribed", pointing at the manage-subscription page.
 * Partly          → "Upgrade" still, because there is a module left to buy —
 *                   someone holding one of the two modules is not done, and
 *                   labelling them "Subscribed" would hide the other one.
 */
export function SubscriptionStatusLink({ compact = false }: { compact?: boolean }) {
  const { token } = useAuth();
  const { hasAnyActive, entitlements, subscriptions, loading } = useSubscription(token);

  if (!token || loading) return null;

  const activeModules = SUBSCRIPTION_MODULES.filter((m) => isModuleActive(m, entitlements));
  const everythingBought = activeModules.length === SUBSCRIPTION_MODULES.length;
  const activePlan = subscriptions.find((s) => s.status === "active");

  if (hasAnyActive && everythingBought) {
    return (
      <Link
        href="/dashboard/purchases"
        title={activePlan?.plan?.name ? `${activePlan.plan.name} — manage subscription` : "Manage subscription"}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-extrabold text-emerald-700 transition hover:border-emerald-300"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className={compact ? "hidden sm:inline" : ""}>Subscribed</span>
      </Link>
    );
  }

  return (
    <Link
      href="/pricing"
      title={
        hasAnyActive
          ? "You have one module — see what the other adds"
          : "See plans and subscribe"
      }
      className="inline-flex items-center gap-1.5 rounded-full bg-civic px-3.5 py-1.5 text-[12px] font-extrabold text-white transition hover:brightness-110"
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className={compact ? "hidden sm:inline" : ""}>Upgrade</span>
      <ChevronRight className="h-3 w-3" />
    </Link>
  );
}
