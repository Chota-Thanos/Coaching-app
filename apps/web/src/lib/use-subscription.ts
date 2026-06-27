"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedGet } from "../components/auth/auth-context";

export type SubscriptionStatus = "active" | "pending" | "inactive" | "cancelled" | "expired";

export type SubscriptionPlan = {
  id: number;
  code: string;
  name: string;
  description: string | null;
};

export type SubscriptionEntitlement = {
  id: number;
  entitlement_key: string;
  limit_value: number | null;
  metadata: Record<string, unknown>;
};

export type Subscription = {
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
  plan: SubscriptionPlan;
  entitlements: SubscriptionEntitlement[];
};

export type EntitlementRecord = {
  entitlement_key: string;
  limit_value: number | null;
};

type UseSubscriptionResult = {
  subscriptions: Subscription[];
  entitlements: EntitlementRecord[];
  /** Returns true if the user has the given entitlement key in an active subscription */
  hasEntitlement: (key: string) => boolean;
  /** Returns the limit value for the given entitlement key, or null if unlimited / not found */
  getLimit: (key: string) => number | null;
  /** True if user has any active subscription */
  hasAnyActive: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useSubscription(token: string | null): UseSubscriptionResult {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [entitlements, setEntitlements] = useState<EntitlementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!token) {
      setSubscriptions([]);
      setEntitlements([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [subs, ents] = await Promise.all([
          authenticatedGet<Subscription[]>("/api/v1/billing/me/subscriptions", token),
          authenticatedGet<EntitlementRecord[]>("/api/v1/billing/me/entitlements", token)
        ]);
        if (!cancelled) {
          setSubscriptions(subs ?? []);
          setEntitlements(ents ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load subscription data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, version]);

  const hasEntitlement = useCallback(
    (key: string): boolean => {
      return entitlements.some((e) => e.entitlement_key === key);
    },
    [entitlements]
  );

  const getLimit = useCallback(
    (key: string): number | null => {
      const found = entitlements.find((e) => e.entitlement_key === key);
      return found ? found.limit_value : null;
    },
    [entitlements]
  );

  const hasAnyActive = subscriptions.some(
    (s) =>
      s.status === "active" &&
      (s.ends_at === null || new Date(s.ends_at) >= new Date())
  );

  return { subscriptions, entitlements, hasEntitlement, getLimit, hasAnyActive, loading, error, refetch };
}
