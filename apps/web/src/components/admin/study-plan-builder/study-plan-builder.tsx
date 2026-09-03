"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  Loader2,
  ShieldCheck,
  X
} from "lucide-react";
import { SignInPanel } from "../../auth/sign-in-panel";
import {
  authenticatedDelete,
  authenticatedGet,
  authenticatedPatch,
  authenticatedPost,
  authenticatedPut,
  useAuth
} from "../../auth/auth-context";
import {
  formatPlanPrice,
  type StudyPlanDetail,
  type StudyPlanItem,
  type StudyPlanTestTemplate
} from "../../../lib/study-plans";
import {
  emptyStepForm,
  isTestStep,
  levelMatchesTestType,
  slugify,
  stepFormFromItem,
  testTypeFromItem,
  type BuilderStage,
  type StepFormState
} from "./builder-shared";
import { BuilderCurriculum } from "./builder-curriculum";
import { BuilderPlanDetails, type PlanDetailsForm } from "./builder-plan-details";
import { BuilderStepEditor } from "./builder-step-editor";
import { BuilderTests } from "./builder-tests";

/**
 * The study plan builder, as a room of its own.
 *
 * Building a plan is a long job — weeks, days, steps, live classes and a paper
 * per test — and the previous screen ran all of it down one scrolling page with
 * the step form squeezed into a 360px column beside the timeline. This gives
 * each part of the job the whole viewport and one clear thing to do, with the
 * admin chrome out of the way until you leave.
 */

type Exam = { id: number; name: string };
type ExamLevel = { id: number; name: string };
type TaxonomyNode = { id: number; name: string };

const STAGES: Array<{ id: BuilderStage; label: string; icon: typeof FileText }> = [
  { id: "details", label: "Plan details", icon: FileText },
  { id: "curriculum", label: "Curriculum", icon: CalendarDays },
  { id: "tests", label: "Tests", icon: ClipboardList }
];

export function StudyPlanBuilder({ planId }: { planId: number }) {
  const { token, user, isInitialized } = useAuth();

  const [plan, setPlan] = useState<StudyPlanDetail | null>(null);
  const [levels, setLevels] = useState<ExamLevel[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyNode[]>([]);
  const [stage, setStage] = useState<BuilderStage>("curriculum");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [stepMode, setStepMode] = useState<"create" | "edit">("create");
  const [stepForm, setStepForm] = useState<StepFormState>(emptyStepForm());
  const [editingWeek, setEditingWeek] = useState<{ weekNo: number; title: string; description: string } | null>(null);

  const [detailsForm, setDetailsForm] = useState<PlanDetailsForm>({
    title: "",
    subtitle: "",
    description: "",
    subject_node_id: "",
    duration_weeks: "4",
    price_rupees: "0",
    plan_type: "self_prep",
    access_mode: "one_time",
    required_entitlement_key: "",
    weekly_hours: "",
    level_label: "",
    target_accuracy: "70",
    status: "draft"
  });

  const editingItem = useMemo(
    () => plan?.items.find((item) => item.id === editingItemId) ?? null,
    [plan, editingItemId]
  );

  const loadPlan = async () => {
    if (!token) return;
    const detail = await authenticatedGet<StudyPlanDetail>(`/api/v1/study-plans/${planId}`, token);
    setPlan(detail);
    return detail;
  };

  useEffect(() => {
    if (!token) return;
    void loadPlan().catch((error) =>
      setLoadError(error instanceof Error ? error.message : "Could not load this plan.")
    );
  }, [token, planId]);

  useEffect(() => {
    if (!plan) return;
    setDetailsForm({
      title: plan.title,
      subtitle: plan.subtitle ?? "",
      description: plan.description ?? "",
      subject_node_id: plan.subject_node_id ? String(plan.subject_node_id) : "",
      duration_weeks: String(plan.duration_weeks),
      price_rupees: String(Number(plan.price_amount_minor ?? 0) / 100),
      plan_type: plan.plan_type ?? "self_prep",
      access_mode: plan.access_mode ?? "one_time",
      required_entitlement_key: plan.required_entitlement_key ?? "",
      weekly_hours: plan.weekly_hours != null ? String(plan.weekly_hours) : "",
      level_label: plan.level_label ?? "",
      target_accuracy: plan.target_accuracy != null ? String(plan.target_accuracy) : "70",
      status: plan.status
    });
  }, [plan?.id]);

  useEffect(() => {
    if (!token || !plan?.exam_id) return;
    void Promise.all([
      authenticatedGet<ExamLevel[]>(`/api/v1/assessment/exams/${plan.exam_id}/levels?limit=100`, token),
      authenticatedGet<TaxonomyNode[]>(
        `/api/v1/assessment/taxonomy-nodes?exam_id=${plan.exam_id}&node_type=subject&limit=200`,
        token
      )
    ])
      .then(([levelRecords, subjectRecords]) => {
        setLevels(levelRecords);
        setSubjects(subjectRecords);
      })
      .catch(() => {
        // Levels and subjects only enrich the forms; a plan is still editable
        // without them, so a failure here must not blank the builder.
      });
  }, [token, plan?.exam_id]);

  /** Messages are confirmations, not state — they clear themselves. */
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const savePlanDetails = async () => {
    if (!token || !plan) return;
    setBusy("plan-edit");
    try {
      await authenticatedPatch(`/api/v1/study-plans/${plan.id}`, token, {
        title: detailsForm.title,
        subtitle: detailsForm.subtitle || null,
        description: detailsForm.description || null,
        subject_node_id: detailsForm.subject_node_id ? Number(detailsForm.subject_node_id) : null,
        duration_weeks: Number(detailsForm.duration_weeks),
        price_amount_minor: Math.round(Number(detailsForm.price_rupees) * 100),
        status: detailsForm.status,
        plan_type: detailsForm.plan_type,
        access_mode: detailsForm.access_mode,
        // Cleared when the plan is not subscription-gated, so a stale key can
        // never silently unlock a paid plan later.
        required_entitlement_key:
          detailsForm.access_mode === "subscription" ? detailsForm.required_entitlement_key || null : null,
        weekly_hours: detailsForm.weekly_hours ? Number(detailsForm.weekly_hours) : null,
        level_label: detailsForm.level_label || null,
        target_accuracy: Number(detailsForm.target_accuracy) || 70
      });
      await loadPlan();
      setMessage("Plan details saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the plan details.");
    } finally {
      setBusy(null);
    }
  };

  const saveWeekOverview = async () => {
    if (!token || !plan || !editingWeek) return;
    setBusy("week-overview");
    try {
      await authenticatedPut(`/api/v1/study-plans/${plan.id}/weeks/${editingWeek.weekNo}`, token, {
        title: editingWeek.title,
        description: editingWeek.description || undefined
      });
      setEditingWeek(null);
      await loadPlan();
      setMessage("Week theme saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the week theme.");
    } finally {
      setBusy(null);
    }
  };

  /** Creates the test paper a test step needs, and returns its id. */
  const createTestTemplate = async (form: StepFormState): Promise<number | null> => {
    if (!token || !plan) return null;
    const testType = testTypeFromItem(form.item_type);
    if (!testType) return null;
    const matching = levels.filter((level) => levelMatchesTestType(level.name, form.item_type));
    const levelId = form.exam_level_id || (matching[0] ? String(matching[0].id) : "");
    if (!levelId) throw new Error("Choose an exam level for this test before saving.");
    const test = await authenticatedPost<StudyPlanTestTemplate>("/api/v1/study-plan-tests", token, {
      title: form.title,
      slug: `${slugify(plan.slug || plan.title)}-${slugify(form.title)}-${Date.now()}`,
      description: form.description || undefined,
      exam_id: plan.exam_id,
      exam_level_id: Number(levelId),
      test_type: testType,
      duration_minutes: Number(form.duration_minutes),
      status: form.test_status
    });
    return test.id;
  };

  const scheduleLiveClassFor = async (itemId: number, title: string, description: string, scheduledAt: string) => {
    if (!token || !plan || !user) return;
    await authenticatedPost(`/api/v1/study-plans/${plan.id}/live-classes`, token, {
      plan_item_id: itemId,
      title,
      description: description || undefined,
      host_user_id: user.id,
      scheduled_start: new Date(scheduledAt).toISOString()
    });
  };

  const saveStep = async () => {
    if (!token || !plan) return;
    setBusy(stepMode === "create" ? "step" : "step-edit");
    try {
      const isTest = isTestStep(stepForm.item_type);
      // A lecture keeps its link whichever way it is delivered. For a linked
      // lecture that link IS the lecture; for one taught live in the app it is
      // the recording put up afterwards, which is what the learner workspace
      // means when it tells a student who missed a class that "the recording
      // counts the same". Clearing it for in-app classes made that promise
      // impossible to keep.
      const lectureUrl = stepForm.item_type === "live_lecture" ? stepForm.lecture_url || null : null;

      if (stepMode === "create") {
        const testTemplateId = isTest ? await createTestTemplate(stepForm) : null;
        const item = await authenticatedPost<StudyPlanItem>(`/api/v1/study-plans/${plan.id}/items`, token, {
          week_no: Number(stepForm.week_no),
          day_no: Number(stepForm.day_no),
          item_type: stepForm.item_type,
          title: stepForm.title,
          description: stepForm.description || undefined,
          estimated_minutes: isTest
            ? Number(stepForm.duration_minutes)
            : stepForm.estimated_minutes
              ? Number(stepForm.estimated_minutes)
              : undefined,
          resource_url: stepForm.resource_url || undefined,
          lecture_url: lectureUrl ?? undefined,
          test_template_id: testTemplateId,
          is_preview: stepForm.is_preview
        });

        if (stepForm.item_type === "live_lecture" && stepForm.delivery === "in_app" && stepForm.live_class_scheduled_at) {
          await scheduleLiveClassFor(item.id, stepForm.title, stepForm.description, stepForm.live_class_scheduled_at);
        }
        await loadPlan();
        setMessage("Step added.");
        setStage("curriculum");
      } else if (editingItem) {
        let testTemplateId = editingItem.test_template_id;
        if (isTest && !testTemplateId) testTemplateId = await createTestTemplate(stepForm);

        await authenticatedPatch(`/api/v1/study-plan-items/${editingItem.id}`, token, {
          week_no: Number(stepForm.week_no),
          day_no: Number(stepForm.day_no),
          item_type: stepForm.item_type,
          title: stepForm.title,
          description: stepForm.description || null,
          estimated_minutes: isTest
            ? Number(stepForm.duration_minutes)
            : stepForm.estimated_minutes
              ? Number(stepForm.estimated_minutes)
              : null,
          resource_url: stepForm.resource_url || null,
          lecture_url: lectureUrl,
          test_template_id: testTemplateId,
          is_preview: stepForm.is_preview
        });

        if (isTest && editingItem.test_template_id) {
          const matching = levels.filter((level) => levelMatchesTestType(level.name, stepForm.item_type));
          const levelId = stepForm.exam_level_id || (matching[0] ? String(matching[0].id) : "");
          if (levelId) {
            await authenticatedPatch(`/api/v1/study-plan-tests/${editingItem.test_template_id}`, token, {
              title: stepForm.title,
              description: stepForm.description || undefined,
              duration_minutes: Number(stepForm.duration_minutes),
              status: stepForm.test_status,
              exam_level_id: Number(levelId)
            });
          }
        }
        await loadPlan();
        setMessage("Step saved.");
        setStage("curriculum");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the step.");
    } finally {
      setBusy(null);
    }
  };

  const deleteStep = async () => {
    if (!token || !plan || !editingItem) return;
    const confirmed = window.confirm(`Delete "${editingItem.title}" from this plan?`);
    if (!confirmed) return;
    setBusy("step-delete");
    try {
      await authenticatedDelete(`/api/v1/study-plan-items/${editingItem.id}`, token);
      await loadPlan();
      setEditingItemId(null);
      setStage("curriculum");
      setMessage("Step deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete the step.");
    } finally {
      setBusy(null);
    }
  };

  /** Attaches a class to a step that already exists — previously this meant
   *  deleting the step and adding it again with a time. */
  const scheduleLiveClassOnExistingStep = async (scheduledAt: string) => {
    if (!editingItem) return;
    setBusy("live-class-schedule");
    try {
      await scheduleLiveClassFor(editingItem.id, stepForm.title, stepForm.description, scheduledAt);
      await loadPlan();
      setMessage("Live class scheduled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not schedule the class.");
    } finally {
      setBusy(null);
    }
  };

  const startLiveClass = async (liveClassId: number) => {
    if (!token) return;
    setBusy("live-class-start");
    try {
      await authenticatedPost(`/api/v1/study-plan-live-classes/${liveClassId}/start`, token, {});
      await loadPlan();
      setMessage("Class started. Open the room to go on camera.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the class.");
    } finally {
      setBusy(null);
    }
  };

  const endLiveClass = async (liveClassId: number) => {
    if (!token) return;
    setBusy("live-class-end");
    try {
      await authenticatedPost(`/api/v1/study-plan-live-classes/${liveClassId}/end`, token, {});
      await loadPlan();
      setMessage("Class ended.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not end the class.");
    } finally {
      setBusy(null);
    }
  };

  const openStepForEdit = (item: StudyPlanItem) => {
    setEditingItemId(item.id);
    setStepForm(stepFormFromItem(item));
    setStepMode("edit");
    setStage("step");
  };

  const openStepForCreate = (weekNo: number, dayNo: number) => {
    setEditingItemId(null);
    const blank = emptyStepForm(weekNo, dayNo);
    const firstLevel = levels[0];
    setStepForm(firstLevel ? { ...blank, exam_level_id: String(firstLevel.id) } : blank);
    setStepMode("create");
    setStage("step");
  };

  if (!isInitialized) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
      </div>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-16 pt-6">
        <section className="rounded-lg border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-civic/10 text-civic">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-ink">Study Plans Admin</h1>
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

  if (!user || !["admin", "moderator", "content_editor"].includes(user.role)) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <section className="rounded-lg border border-berry/30 bg-berry/10 p-6">
          <h1 className="text-2xl font-black text-ink">Access Restricted</h1>
          <p className="mt-2 text-sm font-semibold text-berry">Admin, moderator, or content editor role required.</p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-16 text-center">
        <p className="text-lg font-black text-ink">This plan could not be opened</p>
        <p className="mt-2 text-sm text-ink/60">{loadError}</p>
        <Link className="mt-6 inline-flex text-sm font-black text-civic hover:underline" href="/admin/study-plans">
          Back to all plans
        </Link>
      </main>
    );
  }

  if (!plan) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <div className="flex items-center gap-2 text-sm font-bold text-ink/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading the plan…
        </div>
      </div>
    );
  }

  const stepCount = plan.items.length;
  const testCount = plan.items.filter((item) => isTestStep(item.item_type)).length;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* One slim bar instead of the admin sidebar: what you are editing, how
          to see it as a student, and the way out. */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-black text-ink/60 hover:border-ink/25 hover:text-ink"
              href="/admin/study-plans"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All plans
            </Link>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white">
              <BookOpenCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-tight text-ink">{plan.title}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink/45">
                {plan.status} · {plan.duration_weeks}w · {stepCount} steps · {formatPlanPrice(plan.price_amount_minor, plan.currency)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {message && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {message}
              </span>
            )}
            <Link
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-civic px-3 text-xs font-black text-civic hover:bg-civic/5"
              href={`/study-plans/${plan.id}`}
              target="_blank"
            >
              <Eye className="h-3.5 w-3.5" />
              Student preview
            </Link>
          </div>
        </div>

        {/* The stage rail. The step editor is reached from the curriculum, so
            it is deliberately not a tab of its own. */}
        <nav className="flex gap-1 overflow-x-auto px-4 lg:px-6">
          {STAGES.map((entry) => {
            const Icon = entry.icon;
            const active = stage === entry.id || (stage === "step" && entry.id === "curriculum");
            const count = entry.id === "curriculum" ? stepCount : entry.id === "tests" ? testCount : null;
            return (
              <button
                className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-black transition-colors ${
                  active ? "border-emerald-700 text-emerald-700" : "border-transparent text-ink/45 hover:text-ink/70"
                }`}
                key={entry.id}
                onClick={() => setStage(entry.id)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {entry.label}
                {count !== null && count > 0 && (
                  <span className="rounded-md bg-paper px-1.5 py-0.5 text-[10px] font-black text-ink/50">{count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 px-4 py-8 lg:px-6">
        {stage === "details" && (
          <BuilderPlanDetails
            busy={busy}
            form={detailsForm}
            onChange={setDetailsForm}
            onReloadPlan={() => void loadPlan()}
            onSave={savePlanDetails}
            plan={plan}
            subjects={subjects}
          />
        )}

        {stage === "curriculum" && (
          <BuilderCurriculum
            busy={busy}
            onAddStep={openStepForCreate}
            onEditWeek={(weekNo) => {
              const overview = plan.week_overviews?.find((entry) => entry.week_no === weekNo);
              setEditingWeek({ weekNo, title: overview?.title ?? "", description: overview?.description ?? "" });
            }}
            onOpenStep={openStepForEdit}
            plan={plan}
          />
        )}

        {stage === "step" && (
          <BuilderStepEditor
            busy={busy}
            form={stepForm}
            item={editingItem}
            levels={levels}
            mode={stepMode}
            onCancel={() => setStage("curriculum")}
            onChange={setStepForm}
            onDelete={deleteStep}
            onEndLiveClass={endLiveClass}
            onSave={saveStep}
            onScheduleLiveClass={scheduleLiveClassOnExistingStep}
            onStartLiveClass={startLiveClass}
          />
        )}

        {stage === "tests" && <BuilderTests onOpenStep={openStepForEdit} plan={plan} />}
      </main>

      {editingWeek && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-ink">Week {editingWeek.weekNo} theme</h3>
                <p className="mt-1 text-xs font-semibold text-ink/50">What this week is about, in the student's words.</p>
              </div>
              <button className="text-ink/40 hover:text-ink" onClick={() => setEditingWeek(null)} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-wide text-ink/55">Theme</span>
                <input
                  className="h-11 rounded-lg border border-line px-3 text-sm font-semibold outline-none focus:border-civic"
                  onChange={(event) => setEditingWeek({ ...editingWeek, title: event.target.value })}
                  placeholder="Example: The Constitution and its making"
                  value={editingWeek.title}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-wide text-ink/55">Description</span>
                <textarea
                  className="min-h-24 rounded-lg border border-line p-3 text-sm font-semibold outline-none focus:border-civic"
                  onChange={(event) => setEditingWeek({ ...editingWeek, description: event.target.value })}
                  placeholder="Optional. A sentence on what gets covered."
                  value={editingWeek.description}
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  className="h-10 rounded-lg border border-line px-4 text-xs font-black text-ink/70 hover:bg-paper"
                  onClick={() => setEditingWeek(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-xs font-black text-white disabled:opacity-60"
                  disabled={!editingWeek.title || busy === "week-overview"}
                  onClick={saveWeekOverview}
                  type="button"
                >
                  {busy === "week-overview" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save theme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
