"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedGet, authenticatedPost, useAuth } from "../auth/auth-context";
import { browserBaseUrl } from "../../lib/api";
import type { StudyPlanDetail, StudyPlanItem } from "../../lib/study-plans";
import { StudyPlanDecisionPage } from "./study-plan-decision-page";
import { StudyPlanScheduleSetup } from "./study-plan-schedule-setup";
import { StudyPlanWorkspace } from "./study-plan-workspace";

/**
 * One route, three states:
 *
 *   not enrolled            -> the decision page
 *   enrolling               -> the schedule setup step
 *   enrolled                -> the workspace
 *
 * The middle state is new. Enrolment used to be a single click that recorded
 * no dates, which is why nothing downstream could ever say "today" or
 * "behind" — see database/migrations/055 and api study-plans/tracking.ts.
 */

type Stage = "decide" | "schedule" | "work";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function StudyPlanDetailClient({ initialPlan }: { initialPlan: StudyPlanDetail }) {
  const { token, isInitialized } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState<StudyPlanDetail>(initialPlan);
  const [stage, setStage] = useState<Stage>(initialPlan.has_access ? "work" : "decide");
  const [busy, setBusy] = useState(false);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const fresh = await authenticatedGet<StudyPlanDetail>(`/api/v1/study-plans/${plan.id}`, token);
      setPlan(fresh);
      setStage(fresh.has_access ? "work" : "decide");
    } catch (error) {
      console.error(error);
    }
  }, [token, plan.id]);

  // The server render is anonymous, so enrolment, schedule and tracking only
  // arrive once the learner's token is available client-side.
  useEffect(() => {
    if (!isInitialized || !token) return;
    void reload();
  }, [isInitialized, token, reload]);

  const isFree = plan.access_mode === "free" || Number(plan.price_amount_minor) === 0;
  const covered = plan.covered_by_subscription === true;

  /** Free and subscription-covered plans go straight to scheduling. */
  const beginEnrolment = () => {
    setMessage(null);
    if (!token) {
      router.push(`/login?next=/study-plans/${plan.id}`);
      return;
    }
    if (isFree || covered) {
      setStage("schedule");
      return;
    }
    void startPurchase();
  };

  const startPurchase = async () => {
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      const order = await authenticatedPost<{
        order_id: string;
        amount: number;
        currency: string;
        key_id: string;
      }>(`/api/v1/study-plans/${plan.id}/purchase-order`, token, {});

      if (!window.Razorpay) {
        setMessage("Payment could not start — the checkout script did not load. Refresh and try again.");
        return;
      }

      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: plan.title,
        handler: async (response: Record<string, string>) => {
          try {
            await authenticatedPost(`/api/v1/study-plans/${plan.id}/verify-purchase`, token, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            // Payment only unlocks the plan; the learner still chooses when
            // it starts, so purchase lands on scheduling rather than skipping it.
            setStage("schedule");
          } catch (error) {
            console.error(error);
            setMessage("Payment went through but unlocking failed. Refresh — it may already be active.");
          }
        }
      });
      checkout.open();
    } catch (error) {
      console.error(error);
      setMessage("Could not start the payment. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const startPlan = async (startDate: string, studyDays: number[]) => {
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      await authenticatedPost(`/api/v1/study-plans/${plan.id}/enroll`, token, {
        provider: "free",
        start_date: startDate,
        study_days: studyDays
      });
      await reload();
      setStage("work");
    } catch (error) {
      console.error(error);
      setMessage("Could not start the plan. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggleComplete = async (item: StudyPlanItem) => {
    if (!token) return;
    setBusyItemId(item.id);
    try {
      const nextStatus = item.progress?.status === "completed" ? "in_progress" : "completed";
      const response = await fetch(`${browserBaseUrl}/api/v1/study-plan-items/${item.id}/progress`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!response.ok) throw new Error(`Progress update failed with ${response.status}`);
      await reload();
    } catch (error) {
      console.error(error);
      setMessage("Could not update that item.");
    } finally {
      setBusyItemId(null);
    }
  };

  if (stage === "schedule") {
    return (
      <StudyPlanScheduleSetup
        plan={plan}
        busy={busy}
        message={message}
        onCancel={() => setStage(plan.has_access ? "work" : "decide")}
        onStart={startPlan}
      />
    );
  }

  if (stage === "work" && plan.has_access) {
    return <StudyPlanWorkspace plan={plan} onToggleComplete={toggleComplete} busyItemId={busyItemId} />;
  }

  return (
    <StudyPlanDecisionPage
      plan={plan}
      isSignedIn={Boolean(token)}
      busy={busy}
      message={message}
      onEnrol={beginEnrolment}
    />
  );
}
