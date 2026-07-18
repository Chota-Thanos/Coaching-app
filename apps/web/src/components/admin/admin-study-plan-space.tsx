"use client";

import {
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  FileQuestion,
  Link2,
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Video
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SignInPanel } from "../auth/sign-in-panel";
import { authenticatedDelete, authenticatedGet, authenticatedPatch, authenticatedPost, authenticatedPut, useAuth } from "../auth/auth-context";
import { RichTextMarkdownEditor } from "../current-affairs/rich-text-editor";
import {
  formatPlanPrice,
  formatStudyPlanItemType,
  type StudyPlanDetail,
  type StudyPlanItem,
  type StudyPlanItemType,
  type StudyPlanQuestion,
  type StudyPlanStatus,
  type StudyPlanSummary,
  type StudyPlanTestTemplate,
  type StudyPlanTestType
} from "../../lib/study-plans";

type Exam = { id: number; name: string };
type ExamLevel = { id: number; name: string };
type TaxonomyNode = { id: number; name: string; node_type: string; content_type?: string };
type StudyPlanTestDetail = StudyPlanTestTemplate & { questions: StudyPlanQuestion[] };

const STEP_TYPES: Array<{ value: StudyPlanItemType; label: string; icon: ReactNode }> = [
  { value: "reading", label: "Information / Reading", icon: <BookOpen className="h-4 w-4" /> },
  { value: "revision", label: "Revision", icon: <CheckCircle2 className="h-4 w-4" /> },
  { value: "live_lecture", label: "Live lecture", icon: <Video className="h-4 w-4" /> },
  { value: "prelims_test", label: "Prelims test", icon: <ClipboardList className="h-4 w-4" /> },
  { value: "csat_test", label: "CSAT test", icon: <ClipboardList className="h-4 w-4" /> },
  { value: "mains_test", label: "Mains test", icon: <FileQuestion className="h-4 w-4" /> }
];

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function itemIcon(type: StudyPlanItemType): ReactNode {
  const match = STEP_TYPES.find((item) => item.value === type);
  return match?.icon ?? <BookOpen className="h-4 w-4" />;
}

function isTestStep(type: StudyPlanItemType): boolean {
  return ["prelims_test", "csat_test", "mains_test"].includes(type);
}

function testTypeFromItem(type: StudyPlanItemType): StudyPlanTestType | null {
  if (type === "prelims_test" || type === "csat_test" || type === "mains_test") return type;
  return null;
}

function levelMatchesTestType(level: ExamLevel, type: StudyPlanItemType): boolean {
  const testType = testTypeFromItem(type);
  if (!testType) return true;
  const name = level.name.toLowerCase();
  const isCsatLevel = name.includes("csat") || name.includes("aptitude");
  const isMainsLevel = name.includes("mains");
  if (testType === "csat_test") return isCsatLevel;
  if (testType === "mains_test") return isMainsLevel;
  return !isCsatLevel && !isMainsLevel;
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

function FieldReference({
  children,
  label,
  reference
}: {
  children: ReactNode;
  label: string;
  reference: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-ink/70">
      <span className="text-[11px] font-black uppercase tracking-wide text-ink/55">{label}</span>
      {children}
      <span className="text-[11px] font-semibold leading-4 text-ink/45">{reference}</span>
    </label>
  );
}

export function AdminStudyPlanSpace({ initialPlanId }: { initialPlanId?: number } = {}) {
  const { token, user, logout, isInitialized } = useAuth();
  const [plans, setPlans] = useState<StudyPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId ? String(initialPlanId) : "");
  const [selectedPlan, setSelectedPlan] = useState<StudyPlanDetail | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedTest, setSelectedTest] = useState<StudyPlanTestDetail | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [levels, setLevels] = useState<ExamLevel[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyNode[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [stepForm, setStepForm] = useState({
    week_no: "1",
    day_no: "1",
    item_type: "reading" as StudyPlanItemType,
    title: "",
    description: "",
    estimated_minutes: "60",
    resource_url: "",
    lecture_url: "",
    is_preview: false,
    exam_level_id: "",
    duration_minutes: "120",
    test_status: "draft",
    live_class_scheduled_at: ""
  });

  const [planEditForm, setPlanEditForm] = useState({
    title: "",
    subtitle: "",
    description: "",
    subject_node_id: "",
    duration_weeks: "4",
    price_rupees: "0",
    status: "draft"
  });

  const [editingWeek, setEditingWeek] = useState<{ weekNo: number; title: string; description: string } | null>(null);
  const [isEditingPlanDetails, setIsEditingPlanDetails] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [stepEditForm, setStepEditForm] = useState({
    week_no: "",
    day_no: "",
    item_type: "reading" as StudyPlanItemType,
    title: "",
    description: "",
    estimated_minutes: "",
    resource_url: "",
    lecture_url: "",
    is_preview: false,
    exam_level_id: "",
    duration_minutes: "120",
    test_status: "draft" as StudyPlanStatus
  });

  const saveWeekOverview = async () => {
    if (!token || !selectedPlan || !editingWeek) return;
    setBusy("week-overview");
    setMessage(null);
    try {
      await authenticatedPut(
        `/api/v1/study-plans/${selectedPlan.id}/weeks/${editingWeek.weekNo}`,
        token,
        {
          title: editingWeek.title,
          description: editingWeek.description || undefined
        }
      );
      setEditingWeek(null);
      await loadSelectedPlan(String(selectedPlan.id));
      setMessage("Week overview saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save week overview.");
    } finally {
      setBusy(null);
    }
  };

  const selectedItem = useMemo(
    () => selectedPlan?.items.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, selectedPlan]
  );
  const weeks = useMemo(() => {
    if (!selectedPlan) return [];
    const grouped = groupByWeek(selectedPlan.items);
    const result: [number, StudyPlanItem[]][] = [];
    for (let w = 1; w <= selectedPlan.duration_weeks; w++) {
      const itemsForWeek = grouped.find(([wk]) => wk === w)?.[1] ?? [];
      result.push([w, itemsForWeek]);
    }
    return result;
  }, [selectedPlan]);
  const selectedExamId = selectedPlan?.exam_id ? String(selectedPlan.exam_id) : "";
  const matchingExamLevels = useMemo(
    () => levels.filter((level) => levelMatchesTestType(level, stepForm.item_type)),
    [levels, stepForm.item_type]
  );
  const matchingEditExamLevels = useMemo(
    () => levels.filter((level) => levelMatchesTestType(level, stepEditForm.item_type)),
    [levels, stepEditForm.item_type]
  );

  const loadPlans = async () => {
    if (!token) return;
    const [planRecords, examRecords] = await Promise.all([
      authenticatedGet<StudyPlanSummary[]>("/api/v1/study-plans?limit=100", token),
      authenticatedGet<Exam[]>("/api/v1/assessment/exams?limit=100", token)
    ]);
    setPlans(planRecords);
    setExams(examRecords);
    const firstPlan = planRecords[0];
    if (!initialPlanId && !selectedPlanId && firstPlan) setSelectedPlanId(String(firstPlan.id));
  };

  const loadSelectedPlan = async (id = selectedPlanId) => {
    if (!token || !id) {
      setSelectedPlan(null);
      return;
    }
    const detail = await authenticatedGet<StudyPlanDetail>(`/api/v1/study-plans/${id}`, token);
    setSelectedPlan(detail);
    const firstItem = detail.items[0];
    if (firstItem && !detail.items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(firstItem.id);
    }
    if (detail.items.length === 0) setSelectedItemId(null);
  };

  useEffect(() => {
    if (token) void loadPlans().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load plans."));
  }, [token]);

  useEffect(() => {
    if (initialPlanId) setSelectedPlanId(String(initialPlanId));
  }, [initialPlanId]);

  useEffect(() => {
    if (selectedPlanId) {
      void loadSelectedPlan(selectedPlanId).catch((error) => setMessage(error instanceof Error ? error.message : "Could not load selected plan."));
    }
  }, [selectedPlanId, token]);

  useEffect(() => {
    if (!token || !selectedExamId) return;
    void Promise.all([
      authenticatedGet<ExamLevel[]>(`/api/v1/assessment/exams/${selectedExamId}/levels?limit=100`, token),
      authenticatedGet<TaxonomyNode[]>(`/api/v1/assessment/taxonomy-nodes?exam_id=${selectedExamId}&node_type=subject&limit=200`, token)
    ]).then(([levelRecords, subjectRecords]) => {
      setLevels(levelRecords);
      setSubjects(subjectRecords);
      const firstLevel = levelRecords[0];
      if (!stepForm.exam_level_id && firstLevel) {
        setStepForm((current) => ({ ...current, exam_level_id: String(firstLevel.id) }));
      }
    }).catch(() => {});
  }, [selectedExamId, token]);

  useEffect(() => {
    if (!isTestStep(stepForm.item_type) || matchingExamLevels.length === 0) return;
    if (!matchingExamLevels.some((level) => String(level.id) === stepForm.exam_level_id)) {
      const firstMatchingLevel = matchingExamLevels[0];
      if (firstMatchingLevel) {
        setStepForm((current) => ({ ...current, exam_level_id: String(firstMatchingLevel.id) }));
      }
    }
  }, [matchingExamLevels, stepForm.exam_level_id, stepForm.item_type]);

  useEffect(() => {
    if (!token || !selectedItem?.test_template_id) {
      setSelectedTest(null);
      return;
    }
    void authenticatedGet<StudyPlanTestDetail>(`/api/v1/study-plan-tests/${selectedItem.test_template_id}`, token)
      .then((record) => setSelectedTest(record))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load step test."));
  }, [selectedItem?.test_template_id, selectedPlan?.subject_node_id, token]);

  useEffect(() => {
    if (!selectedPlan) return;
    setPlanEditForm({
      title: selectedPlan.title,
      subtitle: selectedPlan.subtitle ?? "",
      description: selectedPlan.description ?? "",
      subject_node_id: selectedPlan.subject_node_id ? String(selectedPlan.subject_node_id) : "",
      duration_weeks: String(selectedPlan.duration_weeks),
      price_rupees: String(Number(selectedPlan.price_amount_minor ?? 0) / 100),
      status: selectedPlan.status
    });
  }, [selectedPlan?.id]);

  const savePlanBasics = async () => {
    if (!token || !selectedPlan) return;
    setBusy("plan-edit");
    setMessage(null);
    try {
      await authenticatedPatch(`/api/v1/study-plans/${selectedPlan.id}`, token, {
        title: planEditForm.title,
        subtitle: planEditForm.subtitle || null,
        description: planEditForm.description || null,
        subject_node_id: planEditForm.subject_node_id ? Number(planEditForm.subject_node_id) : null,
        duration_weeks: Number(planEditForm.duration_weeks),
        price_amount_minor: Math.round(Number(planEditForm.price_rupees) * 100),
        status: planEditForm.status
      });
      await loadPlans();
      await loadSelectedPlan(String(selectedPlan.id));
      setMessage("Plan basic details updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update plan details.");
    } finally {
      setBusy(null);
    }
  };

  const addStep = async () => {
    if (!token || !selectedPlan) return;
    setBusy("step");
    setMessage(null);
    try {
      let testTemplateId: number | null = null;
      const testType = testTypeFromItem(stepForm.item_type);
      if (testType) {
        const levelId = stepForm.exam_level_id || (matchingExamLevels[0] ? String(matchingExamLevels[0].id) : "");
        if (!levelId) throw new Error("Select an exam level for this test step.");
        const selectedLevel = levels.find((level) => String(level.id) === levelId);
        if (selectedLevel && !levelMatchesTestType(selectedLevel, stepForm.item_type)) {
          throw new Error(`Select a matching exam level for ${formatStudyPlanItemType(stepForm.item_type)}.`);
        }
        const test = await authenticatedPost<StudyPlanTestTemplate>("/api/v1/study-plan-tests", token, {
          title: stepForm.title,
          slug: `${slugify(selectedPlan.slug || selectedPlan.title)}-${slugify(stepForm.title)}-${Date.now()}`,
          description: stepForm.description || undefined,
          exam_id: selectedPlan.exam_id,
          exam_level_id: Number(levelId),
          test_type: testType,
          duration_minutes: Number(stepForm.duration_minutes),
          status: stepForm.test_status
        });
        testTemplateId = test.id;
      }

      const item = await authenticatedPost<StudyPlanItem>(`/api/v1/study-plans/${selectedPlan.id}/items`, token, {
        week_no: Number(stepForm.week_no),
        day_no: Number(stepForm.day_no),
        item_type: stepForm.item_type,
        title: stepForm.title,
        description: stepForm.description || undefined,
        estimated_minutes: testType
          ? Number(stepForm.duration_minutes)
          : (stepForm.estimated_minutes ? Number(stepForm.estimated_minutes) : undefined),
        resource_url: stepForm.resource_url || undefined,
        lecture_url: stepForm.lecture_url || undefined,
        test_template_id: testTemplateId,
        is_preview: stepForm.is_preview
      });

      let liveClassMessage = "";
      if (stepForm.item_type === "live_lecture" && stepForm.live_class_scheduled_at && user) {
        await authenticatedPost(`/api/v1/study-plans/${selectedPlan.id}/live-classes`, token, {
          plan_item_id: item.id,
          title: stepForm.title,
          description: stepForm.description || undefined,
          host_user_id: user.id,
          scheduled_start: new Date(stepForm.live_class_scheduled_at).toISOString()
        });
        liveClassMessage = " Live class scheduled.";
      }

      setStepForm((current) => ({
        ...current,
        title: "",
        description: "",
        resource_url: "",
        lecture_url: "",
        is_preview: false,
        live_class_scheduled_at: ""
      }));
      await loadSelectedPlan(String(selectedPlan.id));
      setSelectedItemId(item.id);
      setMessage((testTemplateId ? "Test step created. Use the full test content manager link on the selected step." : "Step added to the plan.") + liveClassMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add step.");
    } finally {
      setBusy(null);
    }
  };

  const saveStepEdits = async () => {
    if (!token || !selectedPlan || !selectedItem) return;
    setBusy("step-edit");
    setMessage(null);
    try {
      const isTest = isTestStep(stepEditForm.item_type);
      let testTemplateId = selectedItem.test_template_id;

      if (isTest && !selectedItem.test_template_id) {
        const testType = testTypeFromItem(stepEditForm.item_type);
        if (testType) {
          const levelId = stepEditForm.exam_level_id || (matchingEditExamLevels[0] ? String(matchingEditExamLevels[0].id) : "");
          if (!levelId) throw new Error("Select an exam level for this test step.");
          const selectedLevel = levels.find((level) => String(level.id) === levelId);
          if (selectedLevel && !levelMatchesTestType(selectedLevel, stepEditForm.item_type)) {
            throw new Error(`Select a matching exam level for ${formatStudyPlanItemType(stepEditForm.item_type)}.`);
          }
          const test = await authenticatedPost<StudyPlanTestTemplate>("/api/v1/study-plan-tests", token, {
            title: stepEditForm.title,
            slug: `${slugify(selectedPlan.slug || selectedPlan.title)}-${slugify(stepEditForm.title)}-${Date.now()}`,
            description: stepEditForm.description || undefined,
            exam_id: selectedPlan.exam_id,
            exam_level_id: Number(levelId),
            test_type: testType,
            duration_minutes: Number(stepEditForm.duration_minutes),
            status: stepEditForm.test_status
          });
          testTemplateId = test.id;
        }
      }

      const payload: any = {
        week_no: Number(stepEditForm.week_no),
        day_no: Number(stepEditForm.day_no),
        item_type: stepEditForm.item_type,
        title: stepEditForm.title,
        description: stepEditForm.description || null,
        estimated_minutes: isTest
          ? Number(stepEditForm.duration_minutes)
          : (stepEditForm.estimated_minutes ? Number(stepEditForm.estimated_minutes) : null),
        resource_url: stepEditForm.resource_url || null,
        lecture_url: stepEditForm.item_type === "live_lecture" ? stepEditForm.lecture_url || null : null,
        test_template_id: testTemplateId,
        is_preview: stepEditForm.is_preview
      };

      await authenticatedPatch(`/api/v1/study-plan-items/${selectedItem.id}`, token, payload);

      if (isTest && selectedItem.test_template_id) {
        const levelId = stepEditForm.exam_level_id || (matchingEditExamLevels[0] ? String(matchingEditExamLevels[0].id) : "");
        if (levelId) {
          await authenticatedPatch(`/api/v1/study-plan-tests/${selectedItem.test_template_id}`, token, {
            title: stepEditForm.title,
            description: stepEditForm.description || undefined,
            duration_minutes: Number(stepEditForm.duration_minutes),
            status: stepEditForm.test_status,
            exam_level_id: Number(levelId)
          });
        }
      }

      setIsEditingItem(false);
      await loadSelectedPlan(String(selectedPlan.id));
      setMessage("Step details updated successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update step details.");
    } finally {
      setBusy(null);
    }
  };

  const deleteStep = async (item: StudyPlanItem) => {
    if (!token || !selectedPlan) return;
    const confirmed = window.confirm(`Delete "${item.title}" from this plan?`);
    if (!confirmed) return;
    setBusy(`delete-step-${item.id}`);
    setMessage(null);
    try {
      await authenticatedDelete(`/api/v1/study-plan-items/${item.id}`, token);
      await loadSelectedPlan(String(selectedPlan.id));
      setMessage("Step deleted from the plan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete step.");
    } finally {
      setBusy(null);
    }
  };

  const startLiveClassStep = async (liveClassId: number) => {
    if (!token || !selectedPlan) return;
    setBusy("live-class-start");
    setMessage(null);
    try {
      await authenticatedPost(`/api/v1/study-plan-live-classes/${liveClassId}/start`, token, {});
      await loadSelectedPlan(String(selectedPlan.id));
      setMessage("Live class started. Join from the mobile app to broadcast.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the live class.");
    } finally {
      setBusy(null);
    }
  };

  const endLiveClassStep = async (liveClassId: number) => {
    if (!token || !selectedPlan) return;
    setBusy("live-class-end");
    setMessage(null);
    try {
      await authenticatedPost(`/api/v1/study-plan-live-classes/${liveClassId}/end`, token, {});
      await loadSelectedPlan(String(selectedPlan.id));
      setMessage("Live class ended.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not end the live class.");
    } finally {
      setBusy(null);
    }
  };

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <p className="rounded-lg border border-line bg-white p-6 text-center text-sm font-bold text-ink/50">Verifying session...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-16 pt-6">
        <section className="rounded-lg border border-line bg-white p-6 shadow-sm">
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
    <div className="min-h-screen bg-paper lg:flex">
      <aside className="w-full shrink-0 border-r border-line bg-white p-5 lg:w-72">
        <Link className="mb-4 flex items-center gap-2 text-xs font-bold text-ink/50 hover:text-civic" href={initialPlanId ? "/admin/study-plans" : "/admin"}>
          &larr; {initialPlanId ? "Study Plans" : "All Modules"}
        </Link>
        <div className="flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm">
            <BookOpenCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-black text-base leading-none text-ink">Study Plans</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Step Builder</span>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-line bg-paper p-3">
          <p className="text-xs font-black uppercase tracking-wide text-ink/50">Workflow</p>
          {[
            "Create plan details",
            "Add week/day steps",
            "Choose info, test, or lecture",
            "Add questions inside test steps"
          ].map((label, index) => (
            <div className="mt-3 flex gap-2" key={label}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-700 text-[11px] font-black text-white">{index + 1}</span>
              <span className="text-xs font-bold leading-6 text-ink/70">{label}</span>
            </div>
          ))}
        </div>

        <button
          className="mt-6 flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-line text-xs font-bold text-ink hover:bg-paper"
          onClick={logout}
          type="button"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </aside>

      <main className="flex-1 space-y-6 p-6 lg:p-8 overflow-y-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Plan Detail</span>
            <h2 className="mt-1 text-3xl font-black text-ink">{selectedPlan?.title ?? "Study Plan Detail"}</h2>
            <p className="mt-1 text-sm text-ink/65">Edit basic details, configure timeline weeks/steps, and manage test content.</p>
          </div>
          {!initialPlanId && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-ink/60">Selected Plan:</span>
              <select
                className="h-10 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink"
                value={selectedPlanId}
                onChange={(event) => {
                  setSelectedPlanId(event.target.value);
                  setSelectedItemId(null);
                  setSelectedTest(null);
                }}
              >
                <option value="">Create or select a plan</option>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
              </select>
            </div>
          )}
        </div>

        {message && <p className="rounded-md border border-line bg-white px-3 py-2 text-sm font-bold text-civic">{message}</p>}

        {/* Top read-only Plan Overview banner */}
        {selectedPlan && (
          <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900">{selectedPlan.title}</h3>
                {selectedPlan.subtitle && <p className="mt-1 text-sm font-bold text-slate-500">{selectedPlan.subtitle}</p>}
                
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <span className="rounded-md bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-xs font-black text-indigo-700">{selectedPlan.duration_weeks} Weeks</span>
                  <span className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-black text-slate-600">{selectedPlan.language}</span>
                  {selectedPlan.level_label && <span className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-black text-slate-600">{selectedPlan.level_label}</span>}
                  <span className="rounded-md bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700">{formatPlanPrice(selectedPlan.price_amount_minor, selectedPlan.currency)}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-black capitalize border ${
                    selectedPlan.status === "published" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-amber-50 border-amber-100 text-amber-700"
                  }`}>{selectedPlan.status}</span>
                  {selectedPlan.subject?.name && (
                    <span className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-black text-slate-600">Subject: {selectedPlan.subject.name}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlanEditForm({
                      title: selectedPlan.title,
                      subtitle: selectedPlan.subtitle || "",
                      description: selectedPlan.description || "",
                      subject_node_id: selectedPlan.subject_node_id ? String(selectedPlan.subject_node_id) : "",
                      duration_weeks: String(selectedPlan.duration_weeks),
                      price_rupees: String(Number(selectedPlan.price_amount_minor ?? 0) / 100),
                      status: selectedPlan.status
                    });
                    setIsEditingPlanDetails(true);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Plan Details
                </button>
                <Link
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-civic bg-white px-3 text-xs font-black text-civic hover:bg-civic/5"
                  href={`/study-plans/${selectedPlan.id}`}
                  target="_blank"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Student Preview
                </Link>
              </div>
            </div>

            {selectedPlan.description && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Plan Description</p>
                <div
                  className="mt-2 text-sm leading-relaxed text-slate-600 prose prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedPlan.description }}
                />
              </div>
            )}
          </div>
        )}

        {/* Side-by-side Timeline and Step Editor */}
        {selectedPlan ? (
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Left Column: Timeline */}
            <div className="rounded-lg border border-line bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-civic/10 text-civic">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <h3 className="text-lg font-black text-ink">Timeline inside this plan</h3>
              </div>

              <div className="space-y-3">
                {weeks.map(([week, items]) => (
                  <div className="rounded-md border border-line overflow-hidden" key={week}>
                    {(() => {
                      const overview = selectedPlan.week_overviews?.find((wo) => wo.week_no === week);
                      return (
                        <div className="border-b border-line bg-paper px-4 py-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black uppercase tracking-wide text-ink/50">Week {week}</p>
                            <button
                              className="text-xs font-bold text-civic hover:underline"
                              onClick={() => setEditingWeek({
                                weekNo: week,
                                title: overview?.title ?? "",
                                description: overview?.description ?? ""
                              })}
                              type="button"
                            >
                              {overview ? "Edit Overview" : "+ Add Week Overview"}
                            </button>
                          </div>
                          {overview && (
                            <div className="rounded border border-civic/10 bg-civic/5 p-2.5">
                              <h4 className="text-xs font-black text-ink">{overview.title}</h4>
                              {overview.description && <p className="mt-1 text-[11px] font-semibold leading-4 text-ink/65">{overview.description}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div className="divide-y divide-line">
                      {items.length === 0 ? (
                        <p className="p-4 text-center text-xs font-bold text-ink/40 bg-white italic">
                          No steps added for this week yet. Use the form on the right to add steps.
                        </p>
                      ) : (
                        items.map((item) => (
                          <button
                            className={`flex w-full items-start gap-3 p-3 text-left transition-colors ${selectedItemId === item.id ? "bg-emerald-50" : "bg-white hover:bg-paper"}`}
                            key={item.id}
                            onClick={() => { setSelectedItemId(item.id); setIsEditingItem(false); }}
                            type="button"
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white text-civic ring-1 ring-line">
                              {itemIcon(item.item_type)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-black uppercase tracking-wide text-civic">Day {item.day_no} - {formatStudyPlanItemType(item.item_type)}</span>
                              <span className="mt-1 block truncate text-sm font-black text-ink">{item.title}</span>
                              {item.test_template && <span className="mt-1 block text-xs font-bold text-ink/50">{item.test_template.title}</span>}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Add Step / Selected Step */}
            <div className="space-y-5">
              {!selectedItem ? (
                <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-ink/50">Add step to plan</p>
                  <div className="mt-3 grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FieldReference label="Week no." reference="Relative week inside the plan.">
                        <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder="Week" value={stepForm.week_no} onChange={(event) => setStepForm({ ...stepForm, week_no: event.target.value })} />
                      </FieldReference>
                      <FieldReference label="Day no." reference="Relative day inside the selected week.">
                        <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder="Day" value={stepForm.day_no} onChange={(event) => setStepForm({ ...stepForm, day_no: event.target.value })} />
                      </FieldReference>
                    </div>
                    <FieldReference label="Step type" reference="Decides whether this item is reading, revision, live lecture, or a test.">
                      <select className="h-10 rounded-md border border-line px-3 text-sm" value={stepForm.item_type} onChange={(event) => setStepForm({ ...stepForm, item_type: event.target.value as StudyPlanItemType })}>
                        {STEP_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </FieldReference>
                    <FieldReference label="Step title" reference="Visible title for this step.">
                      <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder="Example: Read Fundamental Rights" value={stepForm.title} onChange={(event) => setStepForm({ ...stepForm, title: event.target.value })} />
                    </FieldReference>
                    <FieldReference label="Step details" reference="Instructions or details.">
                      <textarea className="min-h-20 rounded-md border border-line p-3 text-sm" placeholder="Write what the student must do in this step." value={stepForm.description} onChange={(event) => setStepForm({ ...stepForm, description: event.target.value })} />
                    </FieldReference>
                    {!isTestStep(stepForm.item_type) && (
                      <FieldReference label="Estimated time" reference="Approximate effort in minutes.">
                        <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder="Estimated minutes" value={stepForm.estimated_minutes} onChange={(event) => setStepForm({ ...stepForm, estimated_minutes: event.target.value })} />
                      </FieldReference>
                    )}

                    {!isTestStep(stepForm.item_type) && (
                      <FieldReference
                        label={stepForm.item_type === "live_lecture" ? "Lecture link" : "Resource link"}
                        reference={stepForm.item_type === "live_lecture" ? "Meeting/recording link." : "Reading material or resource link."}
                      >
                        <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder={stepForm.item_type === "live_lecture" ? "Lecture link" : "Resource link"} value={stepForm.item_type === "live_lecture" ? stepForm.lecture_url : stepForm.resource_url} onChange={(event) => stepForm.item_type === "live_lecture" ? setStepForm({ ...stepForm, lecture_url: event.target.value }) : setStepForm({ ...stepForm, resource_url: event.target.value })} />
                      </FieldReference>
                    )}

                    {stepForm.item_type === "live_lecture" && (
                      <FieldReference
                        label="Schedule live class"
                        reference="Creates a real Agora broadcast session tied to this step, hosted by you. Leave blank to add the step without scheduling a session yet -- you can schedule one later by re-adding it as a step, or via the API."
                      >
                        <input
                          type="datetime-local"
                          className="h-10 rounded-md border border-line px-3 text-sm"
                          value={stepForm.live_class_scheduled_at}
                          onChange={(event) => setStepForm({ ...stepForm, live_class_scheduled_at: event.target.value })}
                        />
                      </FieldReference>
                    )}

                    {isTestStep(stepForm.item_type) && (
                      <div className="grid gap-3 rounded-md border border-civic/20 bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-civic">Test created inside this step</p>
                        {matchingExamLevels.length > 1 && (
                          <FieldReference label="Exam level" reference="Maps this test to an exam level.">
                            <select className="h-10 rounded-md border border-line px-3 text-sm" value={stepForm.exam_level_id} onChange={(event) => setStepForm({ ...stepForm, exam_level_id: event.target.value })}>
                              <option value="">Exam level</option>
                              {matchingExamLevels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
                            </select>
                          </FieldReference>
                        )}
                        {matchingExamLevels.length === 0 && (
                          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
                            No matching exam level is configured for {formatStudyPlanItemType(stepForm.item_type)}.
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <FieldReference label="Test duration" reference="Attempt time limit in minutes.">
                            <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder="Duration minutes" value={stepForm.duration_minutes} onChange={(event) => setStepForm({ ...stepForm, duration_minutes: event.target.value })} />
                          </FieldReference>
                          <FieldReference label="Test status" reference="Draft keeps it unpublished.">
                            <select className="h-10 rounded-md border border-line px-3 text-sm" value={stepForm.test_status} onChange={(event) => setStepForm({ ...stepForm, test_status: event.target.value })}>
                              <option value="draft">Draft</option>
                              <option value="published">Published</option>
                            </select>
                          </FieldReference>
                        </div>
                      </div>
                    )}

                    <label className="grid gap-1.5 text-xs font-bold text-ink/70">
                      <span className="flex items-center gap-2 text-sm font-bold text-ink/70">
                        <input checked={stepForm.is_preview} onChange={(event) => setStepForm({ ...stepForm, is_preview: event.target.checked })} type="checkbox" />
                        Free preview item
                      </span>
                      <span className="text-[11px] font-semibold leading-4 text-ink/45">Allows students to open this step before purchase.</span>
                    </label>
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 text-sm font-black text-white disabled:opacity-60" disabled={busy === "step" || !stepForm.title} onClick={addStep} type="button">
                      {busy === "step" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Add step
                    </button>
                  </div>
                </div>
              ) : isEditingItem ? (
                <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-ink/50">Edit step details</p>
                  <div className="mt-3 grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FieldReference label="Week no." reference="Relative week inside the plan.">
                        <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder="Week" value={stepEditForm.week_no} onChange={(event) => setStepEditForm({ ...stepEditForm, week_no: event.target.value })} />
                      </FieldReference>
                      <FieldReference label="Day no." reference="Relative day inside the selected week.">
                        <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder="Day" value={stepEditForm.day_no} onChange={(event) => setStepEditForm({ ...stepEditForm, day_no: event.target.value })} />
                      </FieldReference>
                    </div>
                    <FieldReference label="Step type" reference="Decides whether this item is reading, revision, live lecture, or a test.">
                      <select className="h-10 rounded-md border border-line px-3 text-sm" value={stepEditForm.item_type} onChange={(event) => setStepEditForm({ ...stepEditForm, item_type: event.target.value as StudyPlanItemType })}>
                        {STEP_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </FieldReference>
                    <FieldReference label="Step title" reference="Visible title for this step.">
                      <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder="Example: Read Fundamental Rights" value={stepEditForm.title} onChange={(event) => setStepEditForm({ ...stepEditForm, title: event.target.value })} />
                    </FieldReference>
                    <FieldReference label="Step details" reference="Instructions or details.">
                      <textarea className="min-h-20 rounded-md border border-line p-3 text-sm" placeholder="Write what the student must do in this step." value={stepEditForm.description} onChange={(event) => setStepEditForm({ ...stepEditForm, description: event.target.value })} />
                    </FieldReference>
                    {!isTestStep(stepEditForm.item_type) && (
                      <FieldReference label="Estimated time" reference="Approximate effort in minutes.">
                        <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder="Estimated minutes" value={stepEditForm.estimated_minutes} onChange={(event) => setStepEditForm({ ...stepEditForm, estimated_minutes: event.target.value })} />
                      </FieldReference>
                    )}

                    {!isTestStep(stepEditForm.item_type) && (
                      <FieldReference
                        label={stepEditForm.item_type === "live_lecture" ? "Lecture link" : "Resource link"}
                        reference={stepEditForm.item_type === "live_lecture" ? "Meeting/recording link." : "Reading material or resource link."}
                      >
                        <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder={stepEditForm.item_type === "live_lecture" ? "Lecture link" : "Resource link"} value={stepEditForm.item_type === "live_lecture" ? stepEditForm.lecture_url : stepEditForm.resource_url} onChange={(event) => stepEditForm.item_type === "live_lecture" ? setStepEditForm({ ...stepEditForm, lecture_url: event.target.value }) : setStepEditForm({ ...stepEditForm, resource_url: event.target.value })} />
                      </FieldReference>
                    )}

                    {isTestStep(stepEditForm.item_type) && (
                      <div className="grid gap-3 rounded-md border border-civic/20 bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-civic">Test created inside this step</p>
                        {matchingEditExamLevels.length > 1 && (
                          <FieldReference label="Exam level" reference="Maps this test to an exam level.">
                            <select className="h-10 rounded-md border border-line px-3 text-sm" value={stepEditForm.exam_level_id} onChange={(event) => setStepEditForm({ ...stepEditForm, exam_level_id: event.target.value })}>
                              <option value="">Exam level</option>
                              {matchingEditExamLevels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
                            </select>
                          </FieldReference>
                        )}
                        {matchingEditExamLevels.length === 0 && (
                          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
                            No matching exam level is configured for {formatStudyPlanItemType(stepEditForm.item_type)}.
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <FieldReference label="Test duration" reference="Attempt time limit in minutes.">
                            <input className="h-10 rounded-md border border-line px-3 text-sm" placeholder="Duration minutes" value={stepEditForm.duration_minutes} onChange={(event) => setStepEditForm({ ...stepEditForm, duration_minutes: event.target.value })} />
                          </FieldReference>
                          <FieldReference label="Test status" reference="Draft keeps it unpublished.">
                            <select className="h-10 rounded-md border border-line px-3 text-sm" value={stepEditForm.test_status} onChange={(event) => setStepEditForm({ ...stepEditForm, test_status: event.target.value as StudyPlanStatus })}>
                              <option value="draft">Draft</option>
                              <option value="published">Published</option>
                            </select>
                          </FieldReference>
                        </div>
                      </div>
                    )}

                    <label className="grid gap-1.5 text-xs font-bold text-ink/70">
                      <span className="flex items-center gap-2 text-sm font-bold text-ink/70">
                        <input checked={stepEditForm.is_preview} onChange={(event) => setStepEditForm({ ...stepEditForm, is_preview: event.target.checked })} type="checkbox" />
                        Free preview item
                      </span>
                      <span className="text-[11px] font-semibold leading-4 text-ink/45">Allows students to open this step before purchase.</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white text-sm font-black text-ink hover:bg-paper"
                        onClick={() => setIsEditingItem(false)}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 text-sm font-black text-white disabled:opacity-60"
                        disabled={busy === "step-edit" || !stepEditForm.title}
                        onClick={saveStepEdits}
                        type="button"
                      >
                        {busy === "step-edit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Save Edits
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-line bg-white p-5 shadow-sm space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-civic">Selected step</p>
                      <h3 className="mt-1 text-xl font-black text-ink">{selectedItem.title}</h3>
                      <p className="mt-1 text-sm font-bold text-ink/55">Week {selectedItem.week_no}, Day {selectedItem.day_no} - {formatStudyPlanItemType(selectedItem.item_type)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedItem.is_preview && <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">Free preview</span>}
                      <button
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-slate-700 disabled:opacity-50"
                        onClick={() => {
                          setStepEditForm({
                            week_no: String(selectedItem.week_no),
                            day_no: String(selectedItem.day_no),
                            item_type: selectedItem.item_type,
                            title: selectedItem.title,
                            description: selectedItem.description || "",
                            estimated_minutes: selectedItem.estimated_minutes ? String(selectedItem.estimated_minutes) : "",
                            resource_url: selectedItem.resource_url || "",
                            lecture_url: selectedItem.lecture_url || "",
                            is_preview: selectedItem.is_preview,
                            exam_level_id: selectedItem.test_template?.exam_level_id ? String(selectedItem.test_template.exam_level_id) : "",
                            duration_minutes: selectedItem.test_template?.duration_minutes ? String(selectedItem.test_template.duration_minutes) : "90",
                            test_status: selectedItem.test_template?.status ?? "draft"
                          });
                          setIsEditingItem(true);
                        }}
                        type="button"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit step
                      </button>
                      <button
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-2 text-xs font-black text-rose-700 disabled:opacity-50"
                        disabled={busy === `delete-step-${selectedItem.id}`}
                        onClick={() => deleteStep(selectedItem)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete step
                      </button>
                    </div>
                  </div>

                  {!isTestStep(selectedItem.item_type) && (
                    <div className="mt-4 rounded-md border border-line bg-paper p-4">
                      <p className="text-sm font-bold text-ink">Information step</p>
                      {selectedItem.description && <p className="mt-2 text-sm leading-6 text-ink/65">{selectedItem.description}</p>}
                      {(selectedItem.resource_url || selectedItem.lecture_url) && (
                        <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-civic">
                          <Link2 className="h-4 w-4" />
                          {selectedItem.lecture_url || selectedItem.resource_url}
                        </p>
                      )}
                    </div>
                  )}

                  {selectedItem.item_type === "live_lecture" && (
                    <div className="mt-4 rounded-md border border-civic/20 bg-white p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-civic">Live class</p>
                      {!selectedItem.live_class ? (
                        <p className="mt-2 text-sm font-bold text-ink/50">No session scheduled for this step yet. Delete and re-add it with a scheduled time to create one.</p>
                      ) : (
                        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-black text-ink">
                              {selectedItem.live_class.status === "live" ? "Live now" : selectedItem.live_class.status === "ended" ? "Session ended" : selectedItem.live_class.status === "cancelled" ? "Cancelled" : "Scheduled"}
                            </p>
                            <p className="mt-1 text-xs font-bold text-ink/50">{new Date(selectedItem.live_class.scheduled_start).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
                            {selectedItem.live_class.status === "scheduled" && (
                              <button
                                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-civic bg-civic px-3 text-xs font-black text-white disabled:opacity-50"
                                disabled={busy === "live-class-start"}
                                onClick={() => startLiveClassStep(selectedItem.live_class!.id)}
                                type="button"
                              >
                                Start now
                              </button>
                            )}
                            {selectedItem.live_class.status === "live" && (
                              <button
                                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 disabled:opacity-50"
                                disabled={busy === "live-class-end"}
                                onClick={() => endLiveClassStep(selectedItem.live_class!.id)}
                                type="button"
                              >
                                End class
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isTestStep(selectedItem.item_type) && (
                    <div className="mt-4 rounded-md border border-civic/20 bg-paper p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-black text-ink">Linked test content</p>
                          <p className="mt-1 text-xs font-bold text-ink/50">{selectedTest?.title ?? "Loading test"} - {selectedTest?.questions?.length ?? 0} questions</p>
                        </div>
                        {selectedItem.test_template_id && (
                          <Link
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-black text-white"
                            href={`/admin/study-plans/tests/${selectedItem.test_template_id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ClipboardList className="h-4 w-4" />
                            Add and manage test content
                          </Link>
                        )}
                      </div>
                      <p className="mt-3 text-xs font-semibold leading-5 text-ink/55">
                        Question parsing, category tree mapping, edit/delete controls, and saved-question list are managed in the full-page test window.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedItemId(null)}
                    className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 px-3 text-xs font-black text-slate-600 hover:text-slate-800"
                  >
                    + Add Another Step
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : (
          <p className="rounded-md border border-dashed border-line bg-paper p-8 text-center text-sm font-bold text-ink/50">
            Select a study plan from the dropdown above to manage it.
          </p>
        )}
      </main>

      {/* Edit Plan Basics Modal (including TipTap RichTextMarkdownEditor) */}
      {isEditingPlanDetails && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl border border-line bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 my-8">
            <h3 className="text-xl font-black text-ink">Edit Plan Details</h3>
            <p className="text-xs font-semibold text-ink/50 mt-1">Update title, subtitle, subject scope, duration, pricing, and status.</p>
            <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid gap-3 md:grid-cols-2">
                <FieldReference label="Plan title *" reference="Shown to students on listing and purchase.">
                  <input
                    className="h-10 rounded-md border border-line px-3 text-sm"
                    value={planEditForm.title}
                    onChange={(event) => setPlanEditForm({ ...planEditForm, title: event.target.value })}
                  />
                </FieldReference>
                <FieldReference label="Subtitle" reference="Short positioning line below the title.">
                  <input
                    className="h-10 rounded-md border border-line px-3 text-sm"
                    value={planEditForm.subtitle}
                    onChange={(event) => setPlanEditForm({ ...planEditForm, subtitle: event.target.value })}
                  />
                </FieldReference>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <FieldReference label="Subject scope" reference="Choose a subject-specific scope or leave blank.">
                  <select
                    className="h-10 rounded-md border border-line px-3 text-sm"
                    value={planEditForm.subject_node_id}
                    onChange={(event) => setPlanEditForm({ ...planEditForm, subject_node_id: event.target.value })}
                  >
                    <option value="">Full exam / no subject</option>
                    {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                  </select>
                </FieldReference>
                <FieldReference label="Duration (weeks)" reference="Relative week count for this plan.">
                  <input
                    className="h-10 rounded-md border border-line px-3 text-sm"
                    value={planEditForm.duration_weeks}
                    onChange={(event) => setPlanEditForm({ ...planEditForm, duration_weeks: event.target.value })}
                  />
                </FieldReference>
                <FieldReference label="Price (INR)" reference="One-time price in rupees.">
                  <input
                    className="h-10 rounded-md border border-line px-3 text-sm"
                    value={planEditForm.price_rupees}
                    onChange={(event) => setPlanEditForm({ ...planEditForm, price_rupees: event.target.value })}
                  />
                </FieldReference>
              </div>

              <FieldReference label="Plan status" reference="Draft stays hidden; published can be visible to students.">
                <select
                  className="h-10 rounded-md border border-line px-3 text-sm"
                  value={planEditForm.status}
                  onChange={(event) => setPlanEditForm({ ...planEditForm, status: event.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </FieldReference>

              <div className="w-full">
                <RichTextMarkdownEditor
                  label="Description"
                  value={planEditForm.description}
                  onChange={(val) => setPlanEditForm({ ...planEditForm, description: val })}
                  placeholder="Enter detailed description of the study plan, topics covered, syllabus scope, etc..."
                  minHeightClass="min-h-[200px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  className="h-9 rounded-md border border-line bg-white px-4 text-xs font-black text-ink/70 hover:bg-paper"
                  onClick={() => setIsEditingPlanDetails(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-9 rounded-md bg-emerald-700 px-4 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-60"
                  disabled={busy === "plan-edit" || !planEditForm.title}
                  onClick={async () => {
                    await savePlanBasics();
                    setIsEditingPlanDetails(false);
                  }}
                  type="button"
                >
                  {busy === "plan-edit" ? "Saving..." : "Save Details"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingWeek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-line bg-white p-5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-ink">Edit Overview for Week {editingWeek.weekNo}</h3>
            <p className="text-xs font-semibold text-ink/50 mt-1">Provide a high-level title and description for what will be covered this week.</p>
            <div className="mt-4 space-y-4">
              <label className="grid gap-1.5 text-xs font-bold text-ink/70">
                <span>Week Overview Title *</span>
                <input
                  className="h-10 rounded-md border border-line px-3 text-sm"
                  placeholder="Example: Indian Polity Fundamentals"
                  value={editingWeek.title}
                  onChange={(e) => setEditingWeek({ ...editingWeek, title: e.target.value })}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-ink/70">
                <span>Description (Optional)</span>
                <textarea
                  className="min-h-24 rounded-md border border-line p-3 text-sm"
                  placeholder="Example: This week we will explore the historical background, features, and preamble of the Constitution."
                  value={editingWeek.description}
                  onChange={(e) => setEditingWeek({ ...editingWeek, description: e.target.value })}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="h-9 rounded-md border border-line bg-white px-4 text-xs font-black text-ink/70 hover:bg-paper"
                  onClick={() => setEditingWeek(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-9 rounded-md bg-civic px-4 text-xs font-black text-white hover:bg-civic/90 disabled:opacity-60"
                  disabled={busy === "week-overview" || !editingWeek.title}
                  onClick={saveWeekOverview}
                  type="button"
                >
                  {busy === "week-overview" ? "Saving..." : "Save Overview"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
