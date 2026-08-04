"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, CalendarDays, CheckCircle2, ClipboardList, PlayCircle, Star } from "lucide-react";
import { formatPlanPrice, studyPlanHref, type StudyPlanSummary } from "../../lib/study-plans";
import { browserBaseUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-context";

type StudyPlansGridProps = {
  initialPlans: StudyPlanSummary[];
  examId?: string;
  page: number;
};

function PlanArtwork({ plan }: { plan: StudyPlanSummary }) {
  const inner = plan.cover_image_url ? (
    <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${plan.cover_image_url})` }} />
  ) : (
    <div className="relative h-40 overflow-hidden bg-gradient-to-br from-slate-800 to-indigo-950 text-white">
      <div className="absolute inset-y-0 right-0 w-1/3 bg-indigo-600/15" />
      <div className="absolute bottom-0 left-0 h-1.5 w-full bg-civic" />
      <div className="relative flex h-full flex-col justify-between p-4">
        <BookOpenCheck className="ml-auto h-5 w-5 text-indigo-200" />
        <p className="max-w-[14rem] font-heading text-lg !font-black leading-tight text-slate-100">{plan.exam_name ?? "Exam Prep"}</p>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {inner}
      <span className="absolute left-2.5 top-2.5 rounded-full bg-surface/95 px-2.5 py-1 font-heading text-[10px] !font-black uppercase tracking-wide text-civic shadow-sm">
        {plan.level_label ?? "Prelims"}
      </span>
      {plan.has_access ? (
        <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-2.5 py-1 font-heading text-[10px] !font-black uppercase tracking-wide text-white shadow-sm">
          <CheckCircle2 className="h-3 w-3" />
          Enrolled
        </span>
      ) : plan.price_amount_minor === 0 ? (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-emerald-600/90 px-2.5 py-1 font-heading text-[10px] !font-black uppercase tracking-wide text-white shadow-sm">
          Free
        </span>
      ) : null}
    </div>
  );
}

async function browserJson<T>(path: string, token?: string): Promise<T> {
  const headers = new Headers({ accept: "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${browserBaseUrl}${path}`, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export function StudyPlansGrid({ initialPlans, examId, page }: StudyPlansGridProps) {
  const { token, isInitialized } = useAuth();
  const [plans, setPlans] = useState(initialPlans);

  // The server-rendered list is fetched anonymously (fast first paint, no
  // enrollment info). Once the signed-in user's token is available client
  // side, re-fetch the same page -- the backend now joins in that user's
  // enrollments and sorts purchased/started plans to the top.
  useEffect(() => {
    if (!isInitialized || !token) return;
    const limit = 20;
    const offset = (page - 1) * limit;
    const search = new URLSearchParams({ limit: String(limit), offset: String(offset), status: "published" });
    if (examId) search.set("exam_id", examId);
    void browserJson<StudyPlanSummary[]>(`/api/v1/study-plans?${search}`, token)
      .then(setPlans)
      .catch(() => {});
  }, [token, isInitialized, examId, page]);

  if (plans.length === 0) {
    return <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm font-semibold text-slate-500">No published study plans found.</p>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {plans.map((plan) => (
        <Link
          className={`group overflow-hidden rounded-xl border bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-soft ${
            plan.has_access ? "border-emerald-200 hover:border-emerald-400" : "border-slate-200 hover:border-indigo-400"
          }`}
          href={studyPlanHref(`/${plan.id}`)}
          key={plan.id}
        >
          <PlanArtwork plan={plan} />
          <div className="p-4">
            <p className="inline-flex items-center gap-1.5 font-heading text-[11px] !font-black uppercase tracking-wide text-civic">
              <Star className="h-3.5 w-3.5 fill-civic text-civic" />
              {plan.exam_name ?? "Guided curriculum"}
            </p>
            <h2 className="mt-2 min-h-12 font-heading text-lg !font-extrabold leading-snug text-ink transition-colors group-hover:text-civic">{plan.title}</h2>
            {plan.subtitle && <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-500">{plan.subtitle}</p>}
            {plan.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{plan.description}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-3 text-xs font-bold text-slate-500">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-civic" />
                {plan.duration_weeks} weeks
              </span>
              <span className="inline-flex items-center gap-1">
                <BookOpenCheck className="h-3.5 w-3.5 text-civic" />
                {plan.item_count ?? 0} items
              </span>
              <span className="inline-flex items-center gap-1">
                <ClipboardList className="h-3.5 w-3.5 text-civic" />
                {plan.test_count ?? 0} tests
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className={`font-heading text-xl !font-black ${plan.price_amount_minor === 0 ? "text-emerald-600" : "text-civic"}`}>
                {formatPlanPrice(plan.price_amount_minor, plan.currency)}
              </p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 font-heading text-xs !font-black uppercase tracking-wide text-white transition ${
                  plan.has_access ? "bg-emerald-600 group-hover:bg-emerald-700" : "bg-civic group-hover:bg-indigo-700"
                }`}
              >
                <PlayCircle className="h-3.5 w-3.5" />
                {plan.has_access ? "Continue" : "View plan"}
              </span>
            </div>
            <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-civic" />
              {plan.has_access ? "You're enrolled in this plan" : "Curriculum visible before purchase"}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
