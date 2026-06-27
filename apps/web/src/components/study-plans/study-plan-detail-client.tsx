"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Globe2,
  LockKeyhole,
  PlayCircle,
  RotateCcw,
  Star,
  Trophy,
  Video,
  WalletCards,
  AlertCircle
} from "lucide-react";
import {
  formatPlanPrice,
  formatStudyPlanItemType,
  studyPlanHref,
  type StudyPlanDetail,
  type StudyPlanItem
} from "../../lib/study-plans";
import { browserBaseUrl } from "../../lib/api";
import { SignInPanel } from "../auth/sign-in-panel";
import { authenticatedGet, authenticatedPatch, authenticatedPost, useAuth } from "../auth/auth-context";

type StudyPlanDetailClientProps = {
  initialPlan: StudyPlanDetail;
};

function itemIcon(item: StudyPlanItem) {
  if (item.item_type === "reading") return <BookOpen className="h-4 w-4" />;
  if (item.item_type === "revision") return <RotateCcw className="h-4 w-4" />;
  if (item.item_type === "live_lecture") return <Video className="h-4 w-4" />;
  return <PlayCircle className="h-4 w-4" />;
}

function groupByWeek(items: StudyPlanItem[]) {
  const weeks = new Map<number, StudyPlanItem[]>();
  for (const item of items) {
    const current = weeks.get(item.week_no) ?? [];
    current.push(item);
    weeks.set(item.week_no, current);
  }
  return Array.from(weeks.entries()).sort(([a], [b]) => a - b);
}

function CourseArtwork({ plan }: { plan: StudyPlanDetail }) {
  if (plan.cover_image_url) {
    return (
      <div
        className="h-48 bg-cover bg-center"
        style={{ backgroundImage: `url(${plan.cover_image_url})` }}
      />
    );
  }

  return (
    <div className="relative h-48 overflow-hidden bg-gradient-to-br from-slate-800 to-indigo-950 text-white">
      <div className="absolute inset-y-0 right-0 w-1/3 bg-indigo-600/15" />
      <div className="absolute bottom-0 left-0 h-2 w-full bg-indigo-500" />
      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-white/15 px-2 py-1 text-[11px] font-black uppercase tracking-wide">Study Plan</span>
          <BookOpenCheck className="h-6 w-6 text-indigo-200" />
        </div>
        <div>
          <p className="text-2xl font-black leading-tight">{plan.exam?.name ?? plan.exam_name ?? "Exam Prep"}</p>
          <p className="mt-1 text-sm font-bold text-white/70">{plan.duration_weeks} week guided schedule</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <span className="h-1.5 rounded-sm bg-white/30" />
            <span className="h-1.5 rounded-sm bg-indigo-400" />
            <span className="h-1.5 rounded-sm bg-slate-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

async function browserJson<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init?.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${browserBaseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) as T : undefined as T;
}

export function StudyPlanDetailClient({ initialPlan }: StudyPlanDetailClientProps) {
  const { token, isInitialized } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const weeks = useMemo(() => groupByWeek(plan.items), [plan.items]);
  const completed = plan.progress_summary?.completed_items ?? 0;
  const total = plan.progress_summary?.total_items ?? plan.items.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const tests = plan.items.filter((item) => ["prelims_test", "csat_test", "mains_test"].includes(item.item_type)).length;
  const lectures = plan.items.filter((item) => item.item_type === "live_lecture").length;
  const previewItems = plan.items.filter((item) => item.is_preview).length;
  const estimatedMinutes = plan.items.reduce((sum, item) => sum + Number(item.estimated_minutes ?? 0), 0);
  const estimatedHours = Math.max(1, Math.round(estimatedMinutes / 60));

  useEffect(() => {
    if (!token) return;
    void authenticatedGet<StudyPlanDetail>(`/api/v1/study-plans/${plan.id}`, token)
      .then(setPlan)
      .catch(() => {});
  }, [plan.id, token]);

  const enroll = async () => {
    if (!token) return;

    // Free plan — enroll directly
    if (!plan.price_amount_minor || Number(plan.price_amount_minor) === 0) {
      setBusyAction("enroll");
      setMessage(null);
      try {
        await authenticatedPost(`/api/v1/study-plans/${plan.id}/enroll`, token, { provider: "free" });
        const fresh = await authenticatedGet<StudyPlanDetail>(`/api/v1/study-plans/${plan.id}`, token);
        setPlan(fresh);
        setMessage("Study plan unlocked.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not unlock the plan.");
      } finally {
        setBusyAction(null);
      }
      return;
    }

    // Paid plan — create a Razorpay order for the study plan
    setBusyAction("enroll");
    setMessage(null);
    try {
      // Ask backend for a study plan order
      const orderRes = await authenticatedPost<{
        order_id: string;
        amount: number;
        currency: string;
        key_id: string;
        plan_title: string;
        simulated: boolean;
      }>(`/api/v1/study-plans/${plan.id}/purchase-order`, token, {});

      const handleSuccess = async (rzpPaymentId: string, rzpOrderId: string, rzpSignature: string) => {
        try {
          await authenticatedPost(`/api/v1/study-plans/${plan.id}/verify-purchase`, token, {
            razorpay_order_id: rzpOrderId,
            razorpay_payment_id: rzpPaymentId,
            razorpay_signature: rzpSignature
          });
          const fresh = await authenticatedGet<StudyPlanDetail>(`/api/v1/study-plans/${plan.id}`, token);
          setPlan(fresh);
          setMessage("Study plan unlocked! You now have full access.");
        } catch (err) {
          setMessage(err instanceof Error ? err.message : "Payment succeeded but unlock failed. Please contact support.");
        } finally {
          setBusyAction(null);
        }
      };

      if (orderRes.simulated) {
        // Simulated: skip Razorpay SDK
        await handleSuccess(`sim_pay_${Date.now()}`, orderRes.order_id, "simulated_signature");
        return;
      }

      // Real Razorpay
      const rzp = new (window as any).Razorpay({
        key: orderRes.key_id,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: "CoachingHub",
        description: plan.title,
        order_id: orderRes.order_id,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          await handleSuccess(response.razorpay_payment_id, response.razorpay_order_id, response.razorpay_signature);
        },
        modal: {
          ondismiss: () => {
            setBusyAction(null);
            setMessage(null);
          }
        },
        theme: { color: "#4f46e5" }
      });
      rzp.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not initiate payment. Try again.");
      setBusyAction(null);
    }
  };

  const updateProgress = async (item: StudyPlanItem, status: "in_progress" | "completed") => {
    if (!token) return;
    setBusyAction(`progress-${item.id}`);
    setMessage(null);
    try {
      await authenticatedPatch(`/api/v1/study-plan-items/${item.id}/progress`, token, { status });
      const fresh = await authenticatedGet<StudyPlanDetail>(`/api/v1/study-plans/${plan.id}`, token);
      setPlan(fresh);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update progress.");
    } finally {
      setBusyAction(null);
    }
  };

  const startTest = async (item: StudyPlanItem) => {
    if (!token || !item.test_template_id) return;
    setBusyAction(`test-${item.id}`);
    setMessage(null);
    try {
      const attempt = await browserJson<{ id: number }>(
        `/api/v1/study-plan-tests/${item.test_template_id}/attempts/start`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ plan_item_id: item.id })
        }
      );
      router.push(`/study-plans/attempts/${attempt.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start test.");
      setBusyAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 py-12 text-white">
        <div className="absolute left-1/2 top-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[80px]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <Link className="inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-white" href={studyPlanHref()}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Study plans
            </Link>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-md bg-indigo-500/20 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-indigo-300 border border-indigo-500/30">{plan.duration_weeks} weeks</span>
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white/80">{plan.language}</span>
              {plan.level_label && <span className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white/80">{plan.level_label}</span>}
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight md:text-5xl">{plan.title}</h1>
            {plan.subtitle && <p className="mt-4 max-w-3xl text-lg font-bold leading-7 text-white/80">{plan.subtitle}</p>}
            {plan.description && <p className="mt-4 max-w-3xl text-base leading-7 text-white/70">{plan.description}</p>}
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-white/75">
              <span className="inline-flex items-center gap-1.5 text-indigo-400">
                <Star className="h-4 w-4 fill-indigo-400 text-indigo-400" />
                Guided curriculum
              </span>
              <span>{plan.exam?.name ?? plan.exam_name}</span>
              {plan.subject?.name || plan.subject_name ? <span>{plan.subject?.name ?? plan.subject_name}</span> : <span>Full exam plan</span>}
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="h-4 w-4" />
                {plan.language}
              </span>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 overflow-hidden rounded-lg border border-line bg-white text-ink shadow-soft">
              <CourseArtwork plan={plan} />
              <PurchasePanel
                busyAction={busyAction}
                completed={completed}
                enroll={enroll}
                estimatedHours={estimatedHours}
                isInitialized={isInitialized}
                lectures={lectures}
                message={message}
                plan={plan}
                progress={progress}
                tests={tests}
                total={total}
              />
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-white p-5 shadow-card">
            <h2 className="text-2xl font-black text-ink">What you will get</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                `${plan.duration_weeks} week guided schedule with no fixed calendar date`,
                `${plan.items.length} learning, revision, lecture, and test items`,
                `${tests} tests placed inside the plan`,
                `${previewItems} preview items visible before purchase`
              ].map((item) => (
                <p className="flex gap-3 text-sm font-semibold leading-6 text-ink/75" key={item}>
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-indigo-600" />
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white shadow-card">
            <div className="border-b border-line p-5">
              <h2 className="text-2xl font-black text-ink">Course content</h2>
              <p className="mt-2 text-sm font-semibold text-ink/55">
                {weeks.length} weeks - {plan.items.length} items - {tests} tests - about {estimatedHours} hours of planned effort
              </p>
            </div>

            <div className="divide-y divide-line">
              {weeks.map(([week, items]) => {
                const weekMinutes = items.reduce((sum, item) => sum + Number(item.estimated_minutes ?? 0), 0);
                return (
                  <section key={week}>
                    <div className="flex flex-col gap-1 bg-paper px-5 py-3 md:flex-row md:items-center md:justify-between">
                      <h3 className="text-base font-black text-ink">Week {week}</h3>
                      <p className="text-xs font-bold text-ink/55">
                        {items.length} items{weekMinutes ? ` - ${Math.round(weekMinutes / 60)} hours` : ""}
                      </p>
                    </div>
                    <div className="divide-y divide-line">
                      {items.map((item) => (
                        <CurriculumItem
                          busyAction={busyAction}
                          item={item}
                          key={item.id}
                          planHasAccess={plan.has_access}
                          startTest={startTest}
                          updateProgress={updateProgress}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-card">
            <h2 className="text-2xl font-black text-ink">Requirements</h2>
            <div className="mt-3 space-y-2 text-sm font-semibold leading-6 text-ink/70">
              <p>Follow the plan in week/day order and mark non-test tasks complete after studying.</p>
              <p>Attempt linked tests from inside the plan to keep progress and results in sync.</p>
            </div>
          </section>
        </div>

        <aside className="lg:hidden">
          <div className="overflow-hidden rounded-lg border border-line bg-white text-ink shadow-soft">
            <CourseArtwork plan={plan} />
            <PurchasePanel
              busyAction={busyAction}
              completed={completed}
              enroll={enroll}
              estimatedHours={estimatedHours}
              isInitialized={isInitialized}
              lectures={lectures}
              message={message}
              plan={plan}
              progress={progress}
              tests={tests}
              total={total}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PurchasePanel({
  busyAction,
  completed,
  enroll,
  estimatedHours,
  isInitialized,
  lectures,
  message,
  plan,
  progress,
  tests,
  total
}: {
  busyAction: string | null;
  completed: number;
  enroll: () => Promise<void>;
  estimatedHours: number;
  isInitialized: boolean;
  lectures: number;
  message: string | null;
  plan: StudyPlanDetail;
  progress: number;
  tests: number;
  total: number;
}) {
  const { token } = useAuth();
  return (
    <div className="p-5">
      <p className="text-3xl font-black text-ink">{formatPlanPrice(plan.price_amount_minor, plan.currency)}</p>

      {plan.has_access ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Your progress</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-indigo-600" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {completed} of {total} items done
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm font-bold text-indigo-600">
            <CheckCircle2 className="h-4 w-4" />
            Unlocked
          </p>
        </div>
      ) : token ? (
        <div className="mt-4 space-y-3">
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-60 shadow-md shadow-indigo-200"
            disabled={busyAction === "enroll"}
            onClick={enroll}
            type="button"
          >
            <WalletCards className="h-4 w-4" />
            {busyAction === "enroll" ? "Opening payment..." : `Pay ${formatPlanPrice(plan.price_amount_minor, plan.currency)} to unlock`}
          </button>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5">
            <AlertCircle className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <p className="text-[11px] font-semibold text-slate-500">Secure payment via Razorpay · One-time purchase</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-bold text-slate-800">Sign in to purchase this plan.</p>
          {isInitialized && <SignInPanel />}
        </div>
      )}

      {message && (
        <p className={`mt-3 rounded-xl px-3.5 py-2 text-xs font-bold border ${
          message.includes("unlocked") || message.includes("access")
            ? "bg-emerald-50 border-emerald-100 text-emerald-700"
            : "bg-rose-50 border-rose-100 text-rose-600"
        }`}>
          {message}
        </p>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-sm font-black text-slate-800">This plan includes</p>
        <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-500" />
            {plan.duration_weeks} week curriculum
          </p>
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-500" />
            About {estimatedHours} hours of planned work
          </p>
          <p className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-500" />
            {tests} linked tests
          </p>
          <p className="flex items-center gap-2">
            <Video className="h-4 w-4 text-indigo-500" />
            {lectures} lecture slots
          </p>
          <p className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-indigo-500" />
            Progress tracking
          </p>
        </div>
      </div>
    </div>
  );
}

function CurriculumItem({
  busyAction,
  item,
  planHasAccess,
  startTest,
  updateProgress
}: {
  busyAction: string | null;
  item: StudyPlanItem;
  planHasAccess: boolean;
  startTest: (item: StudyPlanItem) => Promise<void>;
  updateProgress: (item: StudyPlanItem, status: "in_progress" | "completed") => Promise<void>;
}) {
  const locked = !planHasAccess && !item.is_preview;
  const done = item.progress?.status === "completed";
  const isTest = ["prelims_test", "csat_test", "mains_test"].includes(item.item_type);
  const resourceUrl = item.lecture_url || item.resource_url;

  return (
    <article className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 gap-3">
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${done ? "bg-indigo-600 text-white" : locked ? "bg-slate-100 text-slate-400" : "bg-indigo-50 border border-indigo-100/55 text-indigo-600"}`}>
          {done ? <CheckCircle2 className="h-4 w-4" /> : itemIcon(item)}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-indigo-600">
            Day {item.day_no} - {formatStudyPlanItemType(item.item_type)}
          </p>
          <h4 className="mt-1 text-base font-black text-slate-800">{item.title}</h4>
          {item.description && <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
            {item.estimated_minutes && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {item.estimated_minutes} min
              </span>
            )}
            {item.is_preview && !planHasAccess && (
              <span className="inline-flex items-center gap-1 text-indigo-600">
                <PlayCircle className="h-3.5 w-3.5" />
                Preview
              </span>
            )}
            {locked && (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <LockKeyhole className="h-3.5 w-3.5" />
                Locked
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
        {locked ? (
          <button className="h-9 rounded-xl border border-slate-200 bg-slate-100 px-4 text-xs font-bold text-slate-400" disabled type="button">
            Locked
          </button>
        ) : isTest ? (
          <button
            className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white transition hover:bg-indigo-600 disabled:opacity-60"
            disabled={busyAction === `test-${item.id}` || !item.test_template_id}
            onClick={() => startTest(item)}
            type="button"
          >
            {done ? "Retake" : "Attempt"}
          </button>
        ) : resourceUrl ? (
          <a
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-indigo-600 hover:text-indigo-600"
            href={resourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open
          </a>
        ) : (
          <button
            className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-indigo-600 hover:text-indigo-600 disabled:opacity-60"
            disabled={busyAction === `progress-${item.id}` || done}
            onClick={() => updateProgress(item, "completed")}
            type="button"
          >
            {done ? "Done" : "Mark done"}
          </button>
        )}
        {!locked && resourceUrl && !isTest && (
          <button
            className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:border-indigo-600 hover:text-indigo-600 disabled:opacity-60"
            disabled={busyAction === `progress-${item.id}` || done}
            onClick={() => updateProgress(item, "completed")}
            type="button"
          >
            {done ? "Done" : "Mark done"}
          </button>
        )}
      </div>
    </article>
  );
}
