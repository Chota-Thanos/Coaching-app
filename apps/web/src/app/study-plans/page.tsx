import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, CalendarDays, CheckCircle2, ClipboardList, Filter, PlayCircle, Star, Video } from "lucide-react";
import { getAssessmentExams } from "../../lib/assessment-api";
import { normalizeAssessmentPage } from "../../lib/assessment";
import { formatPlanPrice, studyPlanHref, type StudyPlanSummary } from "../../lib/study-plans";
import { getStudyPlans } from "../../lib/study-plans-api";

export const dynamic = "force-dynamic";

type StudyPlansPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: "Study Plans",
  description: "Week-wise UPSC study plans with reading, revision, live lectures, and tests.",
  alternates: { canonical: "/study-plans" }
};

function PlanArtwork({ plan, large = false }: { plan: StudyPlanSummary; large?: boolean }) {
  if (plan.cover_image_url) {
    return (
      <div
        className={`${large ? "h-52" : "h-40"} bg-cover bg-center`}
        style={{ backgroundImage: `url(${plan.cover_image_url})` }}
      />
    );
  }

  return (
    <div className={`${large ? "h-52" : "h-40"} relative overflow-hidden bg-gradient-to-br from-slate-800 to-indigo-950 text-white`}>
      <div className="absolute inset-y-0 right-0 w-1/3 bg-indigo-600/15" />
      <div className="absolute bottom-0 left-0 h-1.5 w-full bg-indigo-500" />
      <div className="relative flex h-full flex-col justify-between p-4">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-black uppercase tracking-wide">Study Plan</span>
          <BookOpenCheck className="h-5 w-5 text-indigo-200" />
        </div>
        <div>
          <p className="max-w-[14rem] text-lg font-black leading-tight text-slate-100">{plan.exam_name ?? "Exam Prep"}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <span className="h-1.5 rounded-sm bg-white/30" />
            <span className="h-1.5 rounded-sm bg-indigo-400" />
            <span className="h-1.5 rounded-sm bg-slate-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function StudyPlansPage({ searchParams }: StudyPlansPageProps) {
  const query = await searchParams;
  const examId = first(query.exam_id);
  const page = normalizeAssessmentPage(query.page);
  const [exams, plans] = await Promise.all([
    getAssessmentExams().catch(() => []),
    getStudyPlans({ examId, page, limit: 20 }).catch(() => [])
  ]);

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 py-12 text-white">
        <div className="absolute left-1/2 top-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[80px]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-400">
              <BookOpenCheck aria-hidden="true" className="h-4 w-4" />
              Study plans
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight md:text-5xl">Choose a study plan and follow it day by day</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/75">
              Week-wise UPSC plans with reading, revision, live lectures, and tests placed inside the schedule.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-white/80">
              <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
                <CalendarDays className="h-4 w-4 text-indigo-400" />
                Relative week/day plans
              </span>
              <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
                <ClipboardList className="h-4 w-4 text-indigo-400" />
                Tests inside the plan
              </span>
              <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
                <Video className="h-4 w-4 text-indigo-400" />
                Lecture-ready structure
              </span>
            </div>
          </div>
          <div className="hidden overflow-hidden rounded-lg border border-white/15 bg-white/10 shadow-soft lg:block">
            {plans[0] ? (
              <>
                <PlanArtwork plan={plans[0]} large />
                <div className="p-4">
                  <p className="text-sm font-black">{plans[0].title}</p>
                  <p className="mt-1 text-xs font-semibold text-white/65">{plans[0].duration_weeks} weeks - {plans[0].test_count ?? 0} tests</p>
                </div>
              </>
            ) : (
              <div className="grid h-64 place-items-center p-6 text-center">
                <BookOpenCheck className="h-12 w-12 text-indigo-400" />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-4 pt-6">
        <form action="/study-plans" className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-card md:flex-row md:items-end md:justify-between" method="get">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              Filter plans
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-800">Available study plans</h2>
          </div>
          <label className="grid gap-1 text-sm font-bold text-slate-800 md:w-80">
            Exam
            <select className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal text-slate-700" defaultValue={examId ?? ""} name="exam_id">
              <option value="">All exams</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>{exam.name}</option>
              ))}
            </select>
            <span className="text-xs font-semibold leading-5 text-slate-400">Filters study plans by the shared exam category.</span>
          </label>
        </form>

        {plans.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm font-semibold text-slate-500">No published study plans found.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <Link
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-soft"
                href={studyPlanHref(`/${plan.id}`)}
                key={plan.id}
              >
                <PlanArtwork plan={plan} />
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-indigo-700">Paid plan</span>
                    <span className="inline-flex items-center gap-1 text-xs font-black text-slate-500">
                      <Star className="h-3.5 w-3.5 fill-indigo-500 text-indigo-500" />
                      Structured
                    </span>
                  </div>
                  <h2 className="mt-3 min-h-12 text-lg font-black leading-snug text-slate-800 group-hover:text-indigo-600 transition-colors">{plan.title}</h2>
                  {plan.subtitle && <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-500">{plan.subtitle}</p>}
                  {plan.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{plan.description}</p>}
                  <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-3 text-xs font-bold text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
                      {plan.duration_weeks} weeks
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BookOpenCheck className="h-3.5 w-3.5 text-indigo-500" />
                      {plan.item_count ?? 0} items
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ClipboardList className="h-3.5 w-3.5 text-indigo-500" />
                      {plan.test_count ?? 0} tests
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xl font-black text-slate-800">{formatPlanPrice(plan.price_amount_minor, plan.currency)}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-black text-indigo-600">
                      <PlayCircle className="h-4 w-4" />
                      View plan
                    </span>
                  </div>
                  <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-slate-400">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
                    Curriculum visible before purchase
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
