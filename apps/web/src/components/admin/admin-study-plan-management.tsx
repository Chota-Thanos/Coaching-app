"use client";

import { BookOpenCheck, IndianRupee, Loader2, Plus, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SignInPanel } from "../auth/sign-in-panel";
import { authenticatedGet, authenticatedPost, useAuth } from "../auth/auth-context";
import { formatPlanPrice, type StudyPlanStatus, type StudyPlanSummary } from "../../lib/study-plans";

type Exam = { id: number; name: string };
type TaxonomyNode = { id: number; exam_id: number; name: string; node_type: string; content_type?: string };

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Field({
  children,
  label,
  note
}: {
  children: ReactNode;
  label: string;
  note: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-ink/70">
      <span className="text-[11px] font-black uppercase tracking-wide text-ink/55">{label}</span>
      {children}
      <span className="text-[11px] font-semibold leading-4 text-ink/45">{note}</span>
    </label>
  );
}

export function AdminStudyPlanManagement() {
  const { token, user, isInitialized } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<StudyPlanSummary[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyNode[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    description: "",
    exam_id: "",
    subject_node_id: "",
    duration_weeks: "4",
    price_rupees: "999",
    status: "draft" as StudyPlanStatus
  });

  const visibleSubjects = useMemo(() => {
    if (!form.exam_id) return [];
    return subjects.filter((subject) => String(subject.exam_id) === form.exam_id && subject.node_type === "subject");
  }, [form.exam_id, subjects]);

  const loadData = async () => {
    if (!token) return;
    const [planRecords, examRecords, taxonomyRecords] = await Promise.all([
      authenticatedGet<StudyPlanSummary[]>("/api/v1/study-plans?limit=100", token),
      authenticatedGet<Exam[]>("/api/v1/assessment/exams?limit=100", token),
      authenticatedGet<TaxonomyNode[]>("/api/v1/assessment/taxonomy-nodes?limit=1000", token)
    ]);
    setPlans(planRecords);
    setExams(examRecords);
    setSubjects(taxonomyRecords);
    const firstExam = examRecords[0];
    if (!form.exam_id && firstExam) {
      setForm((current) => ({ ...current, exam_id: String(firstExam.id) }));
    }
  };

  useEffect(() => {
    if (token) void loadData().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load study plans."));
  }, [token]);

  const createPlan = async () => {
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      const created = await authenticatedPost<StudyPlanSummary>("/api/v1/study-plans", token, {
        title: form.title,
        slug: slugify(form.title),
        subtitle: form.subtitle || undefined,
        description: form.description || undefined,
        exam_id: Number(form.exam_id),
        subject_node_id: form.subject_node_id ? Number(form.subject_node_id) : null,
        duration_weeks: Number(form.duration_weeks),
        price_amount_minor: Math.round(Number(form.price_rupees) * 100),
        currency: "INR",
        status: form.status
      });
      setShowCreate(false);
      router.push(`/admin/study-plans/${created.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create study plan.");
    } finally {
      setBusy(false);
    }
  };

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <p className="rounded-lg border border-line bg-surface p-6 text-center text-sm font-bold text-ink/50">Verifying session...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-16 pt-6">
        <section className="rounded-lg border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-civic/10 text-civic">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-ink">Study Plans Management</h1>
              <p className="mt-2 text-sm text-ink/70">Sign in with an admin or editor account.</p>
              <div className="mt-6">
                <SignInPanel />
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const hasAccess = user && ["admin", "moderator", "content_editor"].includes(user.role);
  if (!hasAccess) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <section className="rounded-lg border border-berry/30 bg-berry/10 p-6">
          <h1 className="text-2xl font-black text-ink">Access Restricted</h1>
          <p className="mt-2 text-sm font-semibold text-berry">Admin, moderator, or content editor role required.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-6">
      <section className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <Link className="text-xs font-bold text-ink/50 hover:text-civic" href="/admin">&larr; All Modules</Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-emerald-700">Study Plans</p>
          <h1 className="mt-1 text-3xl font-black text-ink">Management</h1>
          <p className="mt-1 text-sm leading-6 text-ink/65">Create plans, review the list, and open a plan to manage its details, timeline, lectures, and tests.</p>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white shadow-sm hover:bg-emerald-800"
          onClick={() => setShowCreate(true)}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Create New
        </button>
      </section>

      {message && <p className="mt-4 rounded-md border border-line bg-surface px-3 py-2 text-sm font-bold text-civic">{message}</p>}

      <section className="mt-6 overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        <div className="grid grid-cols-[minmax(0,1.5fr)_120px_120px_120px_140px] gap-3 border-b border-line bg-paper px-4 py-3 text-[11px] font-black uppercase tracking-wide text-ink/50 max-lg:hidden">
          <span>Plan</span>
          <span>Weeks</span>
          <span>Items</span>
          <span>Tests</span>
          <span>Status / Price</span>
        </div>
        {plans.length === 0 ? (
          <p className="p-8 text-center text-sm font-bold text-ink/50">No study plans yet. Use Create New to add the first plan.</p>
        ) : (
          <div className="divide-y divide-line">
            {plans.map((plan) => (
              <Link
                className="grid gap-3 px-4 py-4 transition-colors hover:bg-emerald-50/60 lg:grid-cols-[minmax(0,1.5fr)_120px_120px_120px_140px]"
                href={`/admin/study-plans/${plan.id}`}
                key={plan.id}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <BookOpenCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                    <span className="truncate text-sm font-black text-ink">{plan.title}</span>
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-ink/50">{plan.exam_name}{plan.subject_name ? ` - ${plan.subject_name}` : " - Full exam"}</span>
                </span>
                <span className="text-sm font-bold text-ink/70">{plan.duration_weeks} weeks</span>
                <span className="text-sm font-bold text-ink/70">{plan.item_count ?? 0} items</span>
                <span className="text-sm font-bold text-ink/70">{plan.test_count ?? 0} tests</span>
                <span className="text-sm font-bold text-ink">
                  <span className="block capitalize">{plan.status}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700"><IndianRupee className="h-3 w-3" />{formatPlanPrice(plan.price_amount_minor, plan.currency)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
            <div className="flex items-start justify-between border-b border-line bg-paper p-5">
              <div>
                <h2 className="text-xl font-black text-ink">Create New Study Plan</h2>
                <p className="mt-1 text-sm text-ink/60">Add the parent plan first. Timeline, contents, and tests are managed after creation.</p>
              </div>
              <button className="grid h-8 w-8 place-items-center rounded-md hover:bg-surface" onClick={() => setShowCreate(false)} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[72vh] space-y-4 overflow-y-auto p-5">
              <Field label="Plan title" note="Shown to students and in this management list.">
                <input className="h-10 rounded-md border border-line px-3 text-sm" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </Field>
              <Field label="Subtitle" note="Short positioning line under the title.">
                <input className="h-10 rounded-md border border-line px-3 text-sm" value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
              </Field>
              <Field label="Description" note="Student-facing details about the plan scope and outcome.">
                <textarea className="min-h-24 rounded-md border border-line p-3 text-sm" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Exam" note="Shared exam category used for taxonomy and test levels.">
                  <select className="h-10 rounded-md border border-line px-3 text-sm" value={form.exam_id} onChange={(event) => setForm({ ...form, exam_id: event.target.value, subject_node_id: "" })}>
                    <option value="">Choose exam</option>
                    {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
                  </select>
                </Field>
                <Field label="Subject scope" note="Leave blank for full exam, or choose a subject plan.">
                  <select className="h-10 rounded-md border border-line px-3 text-sm" value={form.subject_node_id} onChange={(event) => setForm({ ...form, subject_node_id: event.target.value })}>
                    <option value="">Full exam</option>
                    {visibleSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Duration" note="Relative week count.">
                  <input className="h-10 rounded-md border border-line px-3 text-sm" value={form.duration_weeks} onChange={(event) => setForm({ ...form, duration_weeks: event.target.value })} />
                </Field>
                <Field label="Price" note="One-time rupee price.">
                  <input className="h-10 rounded-md border border-line px-3 text-sm" value={form.price_rupees} onChange={(event) => setForm({ ...form, price_rupees: event.target.value })} />
                </Field>
                <Field label="Status" note="Draft is hidden; published can be listed.">
                  <select className="h-10 rounded-md border border-line px-3 text-sm" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as StudyPlanStatus })}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </Field>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line bg-paper p-4">
              <button className="h-10 rounded-md border border-line bg-surface px-4 text-sm font-bold text-ink" onClick={() => setShowCreate(false)} type="button">Cancel</button>
              <button className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-60" disabled={busy || !form.title || !form.exam_id} onClick={createPlan} type="button">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create and open
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
