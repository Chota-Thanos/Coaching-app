"use client";

// The single step-by-step "Create Test" flow — replaces every prior
// custom-test builder in the app (the old two-step custom-test/create page,
// the homepage's inline "Quick Custom Test Builder", and assessment-home.tsx's
// cart/checkout modals). See docs at the top of category-picker.tsx for why
// category selection never reconstructs taxonomy levels from tree depth.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Wand2
} from "lucide-react";
import {
  authenticatedGet,
  authenticatedPost,
  guestAwarePost,
  useAuth
} from "../../auth/auth-context";
import { getOrCreateGuestToken } from "../../../lib/guest";
import { useSubscription } from "../../../lib/use-subscription";
import { tabStripClass, tabButtonClass } from "../../ui/tabs";
import { GuidedTourController } from "../../app/guided-tour-engine";
import { FullTourSegment } from "../../app/full-tour-segment";
import { advanceFullTour, isFullTourActiveForPage, PAGE_TOUR_RANGES } from "../../../lib/full-tour";
import {
  CategoryPicker,
  toCategorySelectionSpecs,
  type CategoryBasketItem,
  type ContentType
} from "./category-picker";
import { ExistingTestPicker, type ExistingTest } from "./existing-test-picker";
import { TierLimitBanner } from "./tier-limit-banner";
import { getQuestionCap, GUEST_QUESTION_CAP } from "./tier-caps";

const PAGE_TOUR_RANGES_ATTEMPT_START = PAGE_TOUR_RANGES.attempt[0];

const CUSTOM_TEST_TOUR_STEPS = [
  {
    selector: "#tour-test-name-input",
    badge: "Step 1 of 6: Name Your Test",
    title: "Name Your Custom Test",
    body: "Start by giving your test a memorable name. You'll pick the topics and question counts on the next step.",
    actionTrigger: "input" as const,
    actionText: "Type a name in the input above to proceed."
  },
  {
    selector: "#tour-content-type",
    badge: "Step 2 of 6: Content Type",
    title: "Select Subject Domain",
    body: "Choose the subject for your mock test: General Studies (GS), CSAT / Aptitude, or Mains. Click a button to select.",
    actionTrigger: "click" as const,
    actionText: "Click one of the content type buttons (e.g. GS or CSAT) to proceed."
  },
  {
    selector: "#tour-subject-expand",
    badge: "Step 3 of 6: Browse Subjects",
    title: "Expand a Subject",
    body: "Syllabus categories are shown as expandable subjects. Click on a subject row to reveal its topics.",
    actionTrigger: "click" as const,
    actionText: "Click a subject name above to expand it."
  },
  {
    selector: "#tour-add-topic-btn",
    badge: "Step 4 of 6: Add Topic",
    title: "Add Topic to Your Test",
    body: "Each topic shows the available question count. Click 'Add' to include it in your test with the default quantity.",
    actionTrigger: "click" as const,
    actionText: "Click the 'Add' button next to a topic above."
  },
  {
    selector: "#tour-basket-card",
    badge: "Step 5 of 6: Review Basket",
    title: "Adjust Question Counts",
    body: "Your selected topics appear here. Click 'Next' when ready."
  },
  {
    selector: "#tour-create-test-btn",
    badge: "Step 6 of 6: Launch Test",
    title: "Generate & Start Your Test",
    body: "Click this button to generate your custom test and enter the exam interface.",
    actionTrigger: "click" as const,
    actionText: "Click 'Create & Start Custom Test' to launch."
  }
];

const FULL_TOUR_CREATE_STEPS = [
  {
    selector: "#tour-content-type",
    badge: "Tour · Step 2 of 12",
    title: "Select Your Subject",
    body: "Your test is named! Now choose the subject domain: GS (General Studies), CSAT / Aptitude, or Mains."
  },
  {
    selector: "#tour-subject-expand",
    badge: "Tour · Step 3 of 12",
    title: "Browse the Syllabus",
    body: "Click 'Browse sub-categories' on any row to drill into its topics and sources."
  },
  {
    selector: "#tour-add-topic-btn",
    badge: "Tour · Step 4 of 12",
    title: "Add a Topic",
    body: "Click 'Add' next to a topic to include it in your test basket."
  },
  {
    selector: "#tour-basket-card",
    badge: "Tour · Step 5 of 12",
    title: "Review Your Basket",
    body: "Topics you've added appear here with question counts."
  },
  {
    selector: "#tour-create-test-btn",
    badge: "Tour · Step 6 of 12",
    title: "Generate & Start the Test",
    body: "Ready! Click this button to create your test and enter the exam interface."
  }
];

type Exam = { id: number; name: string; slug: string };
type Mode = "choose" | "manual" | "ai";
type ManualStep = "content_type" | "tab" | "name" | "pick_test" | "categories";
type AiStep = "content_type" | "config";

export function CreateTestWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, isInitialized } = useAuth();
  const { hasEntitlement } = useSubscription(token);
  const isPremium = hasEntitlement("assessment.premium_tests");
  const isGuest = !token;

  const contentTypeParam = searchParams.get("content_type");
  const normalizedContentTypeParam: ContentType | null =
    contentTypeParam === "aptitude" || contentTypeParam === "csat"
      ? "aptitude"
      : contentTypeParam === "mains"
      ? "mains"
      : contentTypeParam === "gk"
      ? "gk"
      : null;
  const titleParam = searchParams.get("title") ?? "";
  const modeParam = searchParams.get("mode");
  const tabParam = searchParams.get("tab");
  const testTemplateIdParam = searchParams.get("test_template_id");
  const startTourOnLoad = isInitialized && searchParams.get("start_tour") === "true";
  const isFullTourActive = isFullTourActiveForPage("create");

  const [mode, setMode] = useState<Mode>(() => {
    if (modeParam === "manual" || modeParam === "ai") return modeParam;
    if (testTemplateIdParam || titleParam || startTourOnLoad || isFullTourActive) return "manual";
    return "choose";
  });

  const [contentType, setContentType] = useState<ContentType>(normalizedContentTypeParam ?? "gk");
  const isContentTypeLocked = !!normalizedContentTypeParam;

  // The standalone single-page tour (?start_tour=true, no pre-filled title)
  // enters directly on the 'name' step (its step 1 target is
  // #tour-test-name-input), skipping the normal content_type -> tab -> name
  // order — so 'name' -> Continue must route back through content_type
  // instead of assuming it was already picked, the way the normal
  // content_type -> tab -> name path guarantees.
  const nameStepEntersDirectly = startTourOnLoad && !titleParam && !normalizedContentTypeParam;

  const [manualStep, setManualStep] = useState<ManualStep>(() => {
    if (nameStepEntersDirectly) return "name";
    // Content type must always be resolved first otherwise — either locked
    // via ?content_type= or picked by the user — before any deep-link can
    // skip ahead to categories. A bare ?title= with no content_type still
    // needs the content-type step (matches the old page's behavior and
    // keeps the tests-page tour's #tour-content-type target reachable).
    if (!normalizedContentTypeParam) return "content_type";
    if (testTemplateIdParam || titleParam) return "categories";
    return "tab";
  });
  const [manualTab, setManualTab] = useState<"new" | "existing">(tabParam === "existing" || testTemplateIdParam ? "existing" : "new");

  // startTourOnLoad is gated on isInitialized (auth still loading on first
  // render), so the lazy useState initializers above can miss it entirely on
  // mount. Once auth finishes initializing, re-apply the tour entry point
  // once so ?start_tour=true still lands on the right screen.
  const appliedTourEntry = useRef(false);
  useEffect(() => {
    if (appliedTourEntry.current || !isInitialized) return;
    appliedTourEntry.current = true;
    if (searchParams.get("start_tour") !== "true") return;
    if (modeParam === "manual" || modeParam === "ai") return;
    setMode("manual");
    if (!titleParam && !normalizedContentTypeParam) {
      setManualStep("name");
    } else if (!normalizedContentTypeParam) {
      setManualStep("content_type");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  const [aiStep, setAiStep] = useState<AiStep>(normalizedContentTypeParam ? "config" : "content_type");

  const [title, setTitle] = useState(titleParam);
  const [selectedExistingTest, setSelectedExistingTest] = useState<ExistingTest | null>(null);
  const [basket, setBasket] = useState<CategoryBasketItem[]>([]);
  const [aiBasket, setAiBasket] = useState<CategoryBasketItem[]>([]);
  const [aiTargetsExisting, setAiTargetsExisting] = useState(false);

  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState<number | null>(null);
  const [freeTestUsage, setFreeTestUsage] = useState<{ used: number; limit: number } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fetch the existing test named in ?test_template_id= so "Add More
  // Questions" deep-links from custom-test/[id] land straight on the
  // categories step for that specific test, skipping the picker list.
  useEffect(() => {
    if (!testTemplateIdParam || !token) return;
    authenticatedGet<ExistingTest>(`/api/v1/assessment/test-templates/${testTemplateIdParam}`, token)
      .then((detail) => setSelectedExistingTest(detail))
      .catch(() => {});
  }, [testTemplateIdParam, token]);

  useEffect(() => {
    if (!isInitialized) return;
    authenticatedGet<Exam[]>("/api/v1/assessment/exams", token || "")
      .then((data) => {
        setExams(data || []);
        if (data && data[0]) setExamId(data[0].id);
      })
      .catch((err) => setError(err?.message || "Failed to load exam profiles."));
  }, [isInitialized, token]);

  useEffect(() => {
    if (!token) {
      setFreeTestUsage(null);
      return;
    }
    authenticatedGet<{ used: number; limit: number; hasPremium: boolean }>("/api/v1/assessment/user/free-test-usage", token)
      .then((data) => setFreeTestUsage({ used: data.used, limit: data.limit }))
      .catch(() => setFreeTestUsage(null));
  }, [token]);

  const questionFamily = contentType === "mains" ? "mains_subjective" : "objective";
  const isMains = contentType === "mains";

  const tierCap = useMemo(() => {
    if (isGuest) return GUEST_QUESTION_CAP;
    return getQuestionCap(isPremium, isMains);
  }, [isGuest, isPremium, isMains]);

  const freeTestsExhausted = !isGuest && !isPremium && !!freeTestUsage && freeTestUsage.used >= freeTestUsage.limit;

  async function handleManualCreateNew() {
    if (!examId) return;
    if (!title.trim()) {
      setError("Please name your test.");
      return;
    }
    if (basket.length === 0) {
      setError("Add at least one category before creating your test.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const specs = toCategorySelectionSpecs(basket, questionFamily);
      const guestToken = token ? null : getOrCreateGuestToken();
      const created = await guestAwarePost<{ id: number }>(
        "/api/v1/assessment/user/custom-tests",
        token,
        guestToken,
        {
          title: title.trim(),
          exam_id: examId,
          content_type: contentType,
          categories: specs,
          test_type: isMains ? "mains_test" : "sectional_test"
        }
      );
      const attempt = await guestAwarePost<any>(
        `/api/v1/assessment/test-templates/${created.id}/attempts/start`,
        token,
        guestToken,
        {}
      );
      if (isFullTourActive) advanceFullTour(PAGE_TOUR_RANGES_ATTEMPT_START);
      router.push(`/assessment/attempts/${attempt.id ?? attempt}`);
    } catch (err: any) {
      setError(err?.message || "Failed to create your test.");
      setSubmitting(false);
    }
  }

  async function handleManualAddToExisting() {
    if (!selectedExistingTest || !token) return;
    if (basket.length === 0) {
      setError("Add at least one category before continuing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const specs = toCategorySelectionSpecs(basket, questionFamily);
      await authenticatedPost(`/api/v1/assessment/user/custom-tests/${selectedExistingTest.id}/add-questions`, token, {
        categories: specs
      });
      router.push(`/assessment/custom-test/${selectedExistingTest.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to add questions to your test.");
      setSubmitting(false);
    }
  }

  // AI-Assisted only ever picks from the existing published question bank —
  // same selection mechanism as Manual (toCategorySelectionSpecs +
  // createUserCustomTest/addQuestionsToUserTest), just reached through one
  // guided form instead of a step-by-step drill-down. It never generates
  // new questions.
  async function handleAiCreate() {
    if (!examId) return;
    if (aiTargetsExisting) {
      if (!selectedExistingTest || !token) return;
    } else if (!title.trim()) {
      setError("Please name your test.");
      return;
    }
    if (aiBasket.length === 0) {
      setError("Pick at least one category before continuing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const specs = toCategorySelectionSpecs(aiBasket, questionFamily);
      if (aiTargetsExisting && selectedExistingTest) {
        await authenticatedPost(`/api/v1/assessment/user/custom-tests/${selectedExistingTest.id}/add-questions`, token!, {
          categories: specs
        });
        router.push(`/assessment/custom-test/${selectedExistingTest.id}`);
        return;
      }

      const guestToken = token ? null : getOrCreateGuestToken();
      const created = await guestAwarePost<{ id: number }>(
        "/api/v1/assessment/user/custom-tests",
        token,
        guestToken,
        {
          title: title.trim(),
          exam_id: examId,
          content_type: contentType,
          categories: specs,
          test_type: isMains ? "mains_test" : "sectional_test"
        }
      );
      router.push(`/assessment/custom-test/${created.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to create your test.");
      setSubmitting(false);
    }
  }

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" aria-hidden="true" />
      </div>
    );
  }

  const backHref = mode === "choose" ? "/assessment/custom-test" : undefined;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      <div className="border-b border-line bg-surface px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (mode === "choose") {
                  router.push("/assessment/custom-test");
                  return;
                }
                setMode("choose");
                setError(null);
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-surface transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-5 w-5 text-slate-655" aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">Create Test</h1>
              <p className="text-xs text-slate-500">Build a practice test step by step</p>
            </div>
          </div>
          <Link
            href="/assessment/custom-test"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-4.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ClipboardList className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <span>My Custom Tests</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-semibold text-rose-700">{error}</div>
        )}

        {mode === "choose" && (
          <ModeSelectStep onSelect={(m) => setMode(m)} />
        )}

        {mode === "manual" && (
          <ManualFlow
            step={manualStep}
            setStep={setManualStep}
            contentType={contentType}
            setContentType={setContentType}
            isContentTypeLocked={isContentTypeLocked}
            tab={manualTab}
            setTab={setManualTab}
            title={title}
            setTitle={setTitle}
            examId={examId}
            questionFamily={questionFamily}
            isMains={isMains}
            isGuest={isGuest}
            isPremium={isPremium}
            freeTestUsage={freeTestUsage}
            freeTestsExhausted={freeTestsExhausted}
            tierCap={tierCap}
            basket={basket}
            setBasket={setBasket}
            selectedExistingTest={selectedExistingTest}
            setSelectedExistingTest={setSelectedExistingTest}
            submitting={submitting}
            onSubmitCreateNew={handleManualCreateNew}
            onSubmitAddExisting={handleManualAddToExisting}
            nameStepEntersDirectly={nameStepEntersDirectly}
          />
        )}

        {mode === "ai" && (
          <AiFlow
            step={aiStep}
            setStep={setAiStep}
            contentType={contentType}
            setContentType={setContentType}
            isGuest={isGuest}
            isPremium={isPremium}
            title={title}
            setTitle={setTitle}
            examId={examId}
            questionFamily={questionFamily}
            isMains={isMains}
            freeTestUsage={freeTestUsage}
            tierCap={tierCap}
            aiBasket={aiBasket}
            setAiBasket={setAiBasket}
            aiTargetsExisting={aiTargetsExisting}
            setAiTargetsExisting={setAiTargetsExisting}
            selectedExistingTest={selectedExistingTest}
            setSelectedExistingTest={setSelectedExistingTest}
            submitting={submitting}
            onCreate={handleAiCreate}
          />
        )}
      </div>

      {startTourOnLoad && (
        <GuidedTourController tourKey="custom_test_tour" token={token} fallbackSteps={CUSTOM_TEST_TOUR_STEPS} />
      )}
      {isFullTourActive && <FullTourSegment pageKey="create" steps={FULL_TOUR_CREATE_STEPS} />}
    </div>
  );
}

function ModeSelectStep({
  onSelect
}: {
  onSelect: (mode: "manual" | "ai") => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onSelect("manual")}
        className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-slate-200 bg-surface p-6 text-left transition hover:border-indigo-600 hover:bg-indigo-50/30"
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
          <BookOpen className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-900">Manual</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Browse the syllabus tree yourself and pick subjects, sources and topics.</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect("ai")}
        className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-slate-200 bg-surface p-6 text-left transition hover:border-indigo-600 hover:bg-indigo-50/30"
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
          <Wand2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-900">AI-Assisted</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Tell us the test name, categories and how many questions — we'll assemble it from the question bank in one go and hand you a link to start.
          </p>
        </div>
      </button>
    </div>
  );
}

function ContentTypePicker({
  contentType,
  onSelect
}: {
  contentType: ContentType;
  onSelect: (type: ContentType) => void;
}) {
  return (
    <div id="tour-content-type" className="grid grid-cols-3 gap-3">
      {([
        { id: "gk", label: "GS", sub: "General Studies" },
        { id: "aptitude", label: "CSAT", sub: "Aptitude" },
        { id: "mains", label: "Mains", sub: "Subjective" }
      ] as const).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelect(opt.id)}
          className={`h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-xs font-black transition ${
            contentType === opt.id
              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
              : "border-slate-200 bg-surface text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40"
          }`}
        >
          <span className="text-[13px]">{opt.label}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${contentType === opt.id ? "text-indigo-400" : "text-slate-400"}`}>
            {opt.sub}
          </span>
        </button>
      ))}
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>}
    </div>
  );
}

function ManualFlow(props: {
  step: ManualStep;
  setStep: (s: ManualStep) => void;
  contentType: ContentType;
  setContentType: (c: ContentType) => void;
  isContentTypeLocked: boolean;
  tab: "new" | "existing";
  setTab: (t: "new" | "existing") => void;
  title: string;
  setTitle: (t: string) => void;
  examId: number | null;
  questionFamily: "objective" | "mains_subjective";
  isMains: boolean;
  isGuest: boolean;
  isPremium: boolean;
  freeTestUsage: { used: number; limit: number } | null;
  freeTestsExhausted: boolean;
  tierCap: number;
  basket: CategoryBasketItem[];
  setBasket: (b: CategoryBasketItem[]) => void;
  selectedExistingTest: ExistingTest | null;
  setSelectedExistingTest: (t: ExistingTest | null) => void;
  submitting: boolean;
  onSubmitCreateNew: () => void;
  onSubmitAddExisting: () => void;
  nameStepEntersDirectly: boolean;
}) {
  const {
    step,
    setStep,
    contentType,
    setContentType,
    isContentTypeLocked,
    tab,
    setTab,
    title,
    setTitle,
    examId,
    questionFamily,
    isMains,
    isGuest,
    isPremium,
    freeTestUsage,
    freeTestsExhausted,
    tierCap,
    basket,
    setBasket,
    selectedExistingTest,
    setSelectedExistingTest,
    submitting,
    onSubmitCreateNew,
    onSubmitAddExisting,
    nameStepEntersDirectly
  } = props;

  if (step === "content_type") {
    return (
      <div>
        <StepHeader title="What kind of test?" subtitle="Choose the content type for this test." />
        <ContentTypePicker
          contentType={contentType}
          onSelect={(c) => {
            setContentType(c);
            // A pre-filled title (from a ?title= deep-link) already implies
            // "create new" intent — skip the new/existing tab choice and go
            // straight to picking categories, same as the old single-screen page did.
            setStep(title.trim() ? "categories" : "tab");
          }}
        />
      </div>
    );
  }

  if (step === "tab") {
    return (
      <div>
        <StepHeader title="Create new, or add to an existing test?" />
        <div className={tabStripClass("mb-5")}>
          <button type="button" className={tabButtonClass(tab === "new")} onClick={() => setTab("new")}>
            Create New Test
          </button>
          <button type="button" className={tabButtonClass(tab === "existing")} onClick={() => setTab("existing")}>
            Add to Existing Test
          </button>
        </div>
        {tab === "new" ? (
          <button
            type="button"
            onClick={() => setStep("name")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <ExistingTestPicker
            contentType={contentType}
            examId={examId}
            selectedTestId={selectedExistingTest?.id ?? null}
            onSelect={(t) => {
              setSelectedExistingTest(t);
              setStep("categories");
            }}
          />
        )}
      </div>
    );
  }

  if (step === "name") {
    return (
      <div className="mx-auto max-w-md">
        <StepHeader title="Name your test" subtitle="You'll pick topics on the next step." />
        <input
          id="tour-test-name-input"
          autoFocus
          type="text"
          placeholder="e.g. Ancient History Focus Test"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) setStep(nameStepEntersDirectly ? "content_type" : "categories");
          }}
          className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-slate-50/70 px-4 text-[15px] font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:bg-surface focus:ring-4 focus:ring-indigo-500/10 transition"
        />
        <button
          type="button"
          disabled={!title.trim()}
          onClick={() => setStep(nameStepEntersDirectly ? "content_type" : "categories")}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  // step === 'categories'
  const isAddToExisting = tab === "existing";
  const existingCount = isAddToExisting ? selectedExistingTest?.question_count ?? 0 : 0;
  const remainingCapacity = Math.max(0, tierCap - existingCount);
  const canSubmit = basket.length > 0 && (isAddToExisting ? !!selectedExistingTest : title.trim().length > 0);

  return (
    <div>
      <StepHeader
        title={isAddToExisting ? `Add questions to "${selectedExistingTest?.title ?? "test"}"` : `Pick categories for "${title}"`}
      />
      <div className="mb-4 space-y-3">
        <TierLimitBanner isMains={isMains} isGuest={isGuest} hasPremium={isPremium} freeTestUsage={freeTestUsage} />
        {!isAddToExisting && freeTestsExhausted && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            You&apos;ve used all your free tests — upgrade to Assessment Premium, or add questions to an existing test instead.
          </div>
        )}
      </div>
      {examId && (!freeTestsExhausted || isAddToExisting) && (
        <div id="tour-basket-card">
          <CategoryPicker
            contentType={contentType}
            examId={examId}
            questionFamily={questionFamily}
            remainingCapacity={remainingCapacity}
            basket={basket}
            onBasketChange={setBasket}
            tourIds
          />
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <button
          id="tour-create-test-btn"
          type="button"
          disabled={submitting || !canSubmit || (!isAddToExisting && freeTestsExhausted)}
          onClick={isAddToExisting ? onSubmitAddExisting : onSubmitCreateNew}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-slate-850 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          {isAddToExisting ? "Add Questions" : "Create & Start Test"}
        </button>
      </div>
    </div>
  );
}

function AiFlow(props: {
  step: AiStep;
  setStep: (s: AiStep) => void;
  contentType: ContentType;
  setContentType: (c: ContentType) => void;
  isGuest: boolean;
  isPremium: boolean;
  title: string;
  setTitle: (t: string) => void;
  examId: number | null;
  questionFamily: "objective" | "mains_subjective";
  isMains: boolean;
  freeTestUsage: { used: number; limit: number } | null;
  tierCap: number;
  aiBasket: CategoryBasketItem[];
  setAiBasket: (b: CategoryBasketItem[]) => void;
  aiTargetsExisting: boolean;
  setAiTargetsExisting: (v: boolean) => void;
  selectedExistingTest: ExistingTest | null;
  setSelectedExistingTest: (t: ExistingTest | null) => void;
  submitting: boolean;
  onCreate: () => void;
}) {
  const {
    step,
    setStep,
    contentType,
    setContentType,
    isGuest,
    isPremium,
    title,
    setTitle,
    examId,
    questionFamily,
    isMains,
    freeTestUsage,
    tierCap,
    aiBasket,
    setAiBasket,
    aiTargetsExisting,
    setAiTargetsExisting,
    selectedExistingTest,
    setSelectedExistingTest,
    submitting,
    onCreate
  } = props;

  if (step === "content_type") {
    return (
      <div>
        <StepHeader title="What kind of test?" />
        <ContentTypePicker
          contentType={contentType}
          onSelect={(c) => {
            setContentType(c);
            setStep("config");
          }}
        />
      </div>
    );
  }

  const aiBasketTotal = aiBasket.reduce((sum, item) => sum + item.count, 0);
  const canCreate = aiBasket.length > 0 && (aiTargetsExisting ? !!selectedExistingTest : title.trim().length > 0);
  const remainingCapacity = aiTargetsExisting ? Math.max(0, tierCap - (selectedExistingTest?.question_count ?? 0)) : tierCap;

  return (
    <div className="space-y-5">
      <StepHeader title="AI-Assisted test" subtitle="Tell us what you want, in one go — we'll pull matching questions from the bank." />
      <TierLimitBanner isMains={isMains} isGuest={isGuest} hasPremium={isPremium} freeTestUsage={freeTestUsage} />

      <div className="grid gap-2">
        <span className={tabStripClass()}>
          <button
            type="button"
            className={tabButtonClass(!aiTargetsExisting)}
            onClick={() => setAiTargetsExisting(false)}
          >
            New Test
          </button>
          <button
            type="button"
            className={tabButtonClass(aiTargetsExisting)}
            onClick={() => setAiTargetsExisting(true)}
          >
            Add to Existing Test
          </button>
        </span>
      </div>

      {aiTargetsExisting ? (
        <ExistingTestPicker
          contentType={contentType}
          examId={examId}
          selectedTestId={selectedExistingTest?.id ?? null}
          onSelect={(t) => setSelectedExistingTest(t)}
        />
      ) : (
        <input
          type="text"
          placeholder="e.g. Modern History Deep Dive"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-12 w-full max-w-md rounded-xl border-2 border-slate-200 bg-slate-50/70 px-4 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:bg-surface focus:ring-4 focus:ring-indigo-500/10 transition"
        />
      )}

      {examId && (
        <CategoryPicker
          contentType={contentType}
          examId={examId}
          questionFamily={questionFamily}
          remainingCapacity={remainingCapacity}
          basket={aiBasket}
          onBasketChange={setAiBasket}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500">{aiBasketTotal} questions selected</p>
        <button
          type="button"
          disabled={submitting || !canCreate}
          onClick={onCreate}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-slate-850 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Wand2 className="h-5 w-5" aria-hidden="true" />}
          {aiTargetsExisting ? "Add Questions" : "Create & Start Test"}
        </button>
      </div>
    </div>
  );
}
