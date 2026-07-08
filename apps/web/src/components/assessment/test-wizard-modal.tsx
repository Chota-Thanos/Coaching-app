"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Loader2, X, AlertTriangle, Sparkles, HelpCircle } from "lucide-react";
import { authenticatedGet, authenticatedPost, useAuth } from "../auth/auth-context";

/* ── Types ─────────────────────────────────────────────── */

type Subject = {
  id: string | number;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
};

type Format = {
  id: string;
  label: string;
  icon: string;
  description: string;
  questionRange: [number, number];
};

type QuestionNature = {
  id: number;
  exam_id: number;
  name: string;
  slug: string;
};

/* ── Static data ────────────────────────────────────────── */

const SUBJECT_EMOJIS: Record<string, string> = {
  polity: "🏛️",
  history: "📜",
  geography: "🌍",
  economy: "📈",
  environment: "🌿",
  science: "🔬",
  ir: "🌐",
  social: "👥",
  governance: "⚖️",
  csat: "🧮",
  "current-affairs": "📰",
  ethics: "💡"
};

const SUBJECT_COLORS: Record<string, string> = {
  polity: "blue",
  history: "amber",
  geography: "green",
  economy: "emerald",
  environment: "teal",
  science: "violet",
  ir: "sky",
  social: "rose",
  governance: "indigo",
  csat: "orange",
  "current-affairs": "cyan",
  ethics: "yellow"
};

const FORMATS: Format[] = [
  { id: "quick_test", label: "Quick Test", icon: "⚡", description: "10–25 questions · 15–30 min", questionRange: [10, 25] },
  { id: "sectional_test", label: "Sectional", icon: "📂", description: "25–50 questions · 30–60 min", questionRange: [25, 50] },
  { id: "full_length_test", label: "Full Length", icon: "📋", description: "100 questions · 120 min", questionRange: [100, 100] },
  { id: "pyq_test", label: "PYQ Test", icon: "🏆", description: "Previous year questions", questionRange: [10, 100] }
];

const QUESTION_COUNTS = [10, 20, 30, 50, 100];

const colorMap: Record<string, string> = {
  blue: "bg-indigo-50/50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/30",
  amber: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
  green: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
  emerald: "bg-indigo-50/50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/30",
  teal: "bg-indigo-50/50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/30",
  violet: "bg-indigo-50/50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/30",
  sky: "bg-indigo-50/50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/30",
  rose: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
  orange: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
  cyan: "bg-indigo-50/50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/30",
  yellow: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
};

function selectedColor(isSelected: boolean): string {
  return isSelected ? "ring-2 ring-indigo-600 ring-offset-1 border-indigo-600" : "";
}

export function TestWizardModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { token } = useAuth();

  const [step, setStep] = useState(1);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [format, setFormat] = useState<Format | null>(null);
  const [questionCount, setQuestionCount] = useState(20);
  const [selectedNature, setSelectedNature] = useState<QuestionNature | null>(null);

  // Dynamic Syllabus Taxonomy States
  const [exams, setExams] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [allTaxonomyNodes, setAllTaxonomyNodes] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [natures, setNatures] = useState<QuestionNature[]>([]);
  
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string>("");

  const [loadingConfig, setLoadingConfig] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showAIGeneratePrompt, setShowAIGeneratePrompt] = useState(false);

  const TOTAL_STEPS = 4;

  // 1. Fetch exams, levels, taxonomy, and natures dynamically
  useEffect(() => {
    const loadWizardConfig = async () => {
      setLoadingConfig(true);
      try {
        const examsData = await authenticatedGet<any[]>("/api/v1/assessment/exams", token || "");
        setExams(examsData || []);
        const activeExam = examsData?.[0];
        if (!activeExam) return;

        const levelsData = await authenticatedGet<any[]>(`/api/v1/assessment/exams/${activeExam.id}/levels`, token || "");
        setLevels(levelsData || []);

        const nodesData = await authenticatedGet<any[]>(`/api/v1/assessment/taxonomy-nodes?exam_id=${activeExam.id}&limit=1000`, token || "");
        
        let filteredNodes = nodesData || [];
        try {
          const exclusions = await authenticatedGet<{ objective: number[]; mains: number[] }>(
            "/api/v1/assessment/taxonomy/excluded",
            token || ""
          );
          const objectiveExclusions = exclusions.objective || [];
          if (objectiveExclusions.length > 0) {
            const excludedSet = new Set<number>(objectiveExclusions);
            let changed = true;
            while (changed) {
              changed = false;
              for (const n of nodesData) {
                if (n.parent_id && excludedSet.has(n.parent_id) && !excludedSet.has(n.id)) {
                  excludedSet.add(n.id);
                  changed = true;
                }
              }
            }
            filteredNodes = nodesData.filter((node: any) => !excludedSet.has(node.id));
          }
        } catch (e) {
          console.error("Failed to load exclusions in wizard:", e);
        }

        setAllTaxonomyNodes(filteredNodes);

        const subs = filteredNodes
          ?.filter((n: any) => n.node_type === "subject")
          .map((n: any) => ({
            id: n.id,
            name: n.name,
            slug: n.slug,
            icon: SUBJECT_EMOJIS[n.slug] || "📚",
            color: SUBJECT_COLORS[n.slug] || "blue"
          })) || [];
        setSubjects(subs);

        const naturesData = await authenticatedGet<QuestionNature[]>(`/api/v1/assessment/question-natures?exam_id=${activeExam.id}`, token || "");
        setNatures(naturesData || []);
      } catch (err) {
        console.error("Failed to load wizard configurations", err);
      } finally {
        setLoadingConfig(false);
      }
    };
    void loadWizardConfig();
  }, [token]);

  // Topic and Subtopic lists based on selection
  const activeTopics = useMemo(() => {
    if (!subject) return [];
    return allTaxonomyNodes.filter(n => n.node_type === "topic" && String(n.parent_id) === String(subject.id));
  }, [allTaxonomyNodes, subject]);

  const activeSubtopics = useMemo(() => {
    if (!selectedTopicId) return [];
    return allTaxonomyNodes.filter(n => n.node_type === "subtopic" && String(n.parent_id) === String(selectedTopicId));
  }, [allTaxonomyNodes, selectedTopicId]);

  // Handle subject change
  const handleSubjectSelect = (sub: Subject) => {
    setSubject(sub);
    setSelectedTopicId("");
    setSelectedSubtopicId("");
    setShowAIGeneratePrompt(false);
  };

  // Generate Questions via AI for current taxonomy
  async function generateAIQuestions() {
    if (!token || !subject) return;
    setGeneratingAI(true);
    setError(null);
    try {
      const activeExamId = exams[0]?.id;
      const activeLevelId = levels[0]?.id;
      if (!activeExamId || !activeLevelId) {
        throw new Error("Examination metadata not loaded.");
      }

      const payload = {
        exam_id: activeExamId,
        exam_level_id: activeLevelId,
        subject_node_id: Number(subject.id),
        topic_node_id: selectedTopicId ? Number(selectedTopicId) : null,
        subtopic_node_id: selectedSubtopicId ? Number(selectedSubtopicId) : null,
        question_nature_id: selectedNature ? Number(selectedNature.id) : null,
        count: 5
      };

      await authenticatedPost(
        "/api/v1/assessment/attempts/dynamic/generate",
        token,
        payload
      );
      
      setShowAIGeneratePrompt(false);
      await startDynamicTest();
    } catch (err: any) {
      console.error(err);
      setError("Failed to auto-generate questions via AI. Please check server availability.");
    } finally {
      setGeneratingAI(false);
    }
  }

  // Start dynamic attempt
  async function startDynamicTest() {
    if (!token) {
      setError("Please sign in to start a practice test.");
      return;
    }
    if (!subject) {
      setError("Please select a subject.");
      return;
    }
    setStarting(true);
    setError(null);
    setShowAIGeneratePrompt(false);
    try {
      const activeExamId = exams[0]?.id;
      const activeLevelId = levels[0]?.id;
      if (!activeExamId || !activeLevelId) {
        throw new Error("Examination metadata is not fully initialized.");
      }

      const payload = {
        exam_id: activeExamId,
        exam_level_id: activeLevelId,
        subject_node_id: Number(subject.id),
        topic_node_id: selectedTopicId ? Number(selectedTopicId) : null,
        subtopic_node_id: selectedSubtopicId ? Number(selectedSubtopicId) : null,
        question_nature_id: selectedNature ? Number(selectedNature.id) : null,
        question_count: questionCount,
        test_type: format?.id || "quick_test"
      };

      const result = await authenticatedPost<{ id: number }>(
        "/api/v1/assessment/attempts/dynamic",
        token,
        payload
      );
      router.push(`/assessment/attempts/${result.id}`);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(null);
      setShowAIGeneratePrompt(true);
      setStarting(false);
    }
  }

  function goToStep2() {
    if (!subject) return;
    setStep(2);
  }

  function goToStep3() {
    if (!format) return;
    setStep(3);
  }

  function goToStep4() {
    setStep(4);
  }

  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg animate-slide-up rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl border border-line">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4.5 w-4.5 text-indigo-600" aria-hidden="true" />
            <h2 className="text-base font-black text-ink">
              {step === 1 && "Choose a Subject"}
              {step === 2 && "Choose Test Format"}
              {step === 3 && "Questions Count & Nature"}
              {step === 4 && "Practice Session Summary"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-muted hover:bg-slate-100 hover:text-ink"
            aria-label="Close wizard"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="relative h-1 bg-line">
          <div
            className="absolute inset-y-0 left-0 bg-indigo-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 px-5 py-2">
          {[1, 2, 3, 4].map((s) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-indigo-600" : "bg-line"} transition-colors`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-5 pb-5">
          {loadingConfig ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-7 w-7 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-ink/65">Loading syllabus options & natures...</p>
            </div>
          ) : (
            <>
              {/* Step 1 — Subject & Refining Category */}
              {step === 1 && (
                <div className="tab-content space-y-4">
                  <p className="text-xs font-semibold text-muted">Select the subject you want to practice</p>
                  <div className="grid grid-cols-3 gap-2">
                    {subjects.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => handleSubjectSelect(sub)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                          colorMap[sub.color || "blue"] ?? "bg-paper border-line"
                        } ${selectedColor(subject?.id === sub.id)}`}
                      >
                        <span className="text-2xl">{sub.icon}</span>
                        <span className="text-[11px] font-bold leading-tight truncate w-full">{sub.name}</span>
                      </button>
                    ))}
                  </div>

                  {subject && activeTopics.length > 0 && (
                    <div className="rounded-xl border border-line bg-paper/50 p-4 space-y-3 animate-in fade-in">
                      <span className="text-[10px] font-black uppercase text-ink/50 tracking-wider">
                        Refine Syllabus (Optional)
                      </span>
                      
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1 text-[10px] font-bold text-ink">
                          Topic node
                          <select
                            value={selectedTopicId}
                            onChange={(e) => {
                              setSelectedTopicId(e.target.value);
                              setSelectedSubtopicId("");
                            }}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                          >
                            <option value="">All Topics</option>
                            {activeTopics.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </label>

                        <label className="grid gap-1 text-[10px] font-bold text-ink">
                          Subtopic node
                          <select
                            value={selectedSubtopicId}
                            onChange={(e) => setSelectedSubtopicId(e.target.value)}
                            disabled={!selectedTopicId}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 disabled:opacity-50"
                          >
                            <option value="">All Subtopics</option>
                            {activeSubtopics.map(st => (
                              <option key={st.id} value={st.id}>{st.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 — Format */}
              {step === 2 && (
                <div className="tab-content grid gap-3 animate-in fade-in">
                  <p className="text-xs font-semibold text-muted">How do you want to test yourself?</p>
                  {FORMATS.map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => setFormat(fmt)}
                      className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-left transition-all hover:border-indigo-600 hover:bg-indigo-50/30 ${selectedColor(format?.id === fmt.id)}`}
                    >
                      <span className="text-2xl">{fmt.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-ink">{fmt.label}</p>
                        <p className="text-xs text-muted">{fmt.description}</p>
                      </div>
                      {format?.id === fmt.id && (
                        <Check className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 3 — Question count & Nature selection */}
              {step === 3 && (
                <div className="tab-content space-y-5 animate-in fade-in">
                  
                  {/* Counts */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted">How many questions?</p>
                    <div className="grid grid-cols-5 gap-2">
                      {QUESTION_COUNTS.map((count) => (
                        <button
                          key={count}
                          onClick={() => setQuestionCount(count)}
                          className={`rounded-xl border py-3 text-sm font-black transition-all ${
                            questionCount === count
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-200 bg-slate-50/50 text-ink hover:border-indigo-600 hover:bg-indigo-50/30"
                          }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Natures */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted">Question Nature / Difficulty Profile</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSelectedNature(null)}
                        className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-extrabold text-left transition-all ${
                          selectedNature === null
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-slate-50/50 text-ink hover:border-indigo-300"
                        }`}
                      >
                        <span>All Natures</span>
                        {selectedNature === null && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                      </button>

                      {natures.map((nature) => (
                        <button
                          key={nature.id}
                          onClick={() => setSelectedNature(nature)}
                          className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-extrabold text-left transition-all ${
                            selectedNature?.id === nature.id
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 bg-slate-50/50 text-ink hover:border-indigo-300"
                          }`}
                        >
                          <span>{nature.name}</span>
                          {selectedNature?.id === nature.id && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Config details */}
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted">Target syllabus selection</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                        {subject?.icon} {subject?.name}
                      </span>
                      {selectedTopicId && (
                        <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                          {allTaxonomyNodes.find(n => String(n.id) === selectedTopicId)?.name}
                        </span>
                      )}
                      <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                        {format?.icon} {format?.label}
                      </span>
                    </div>
                  </div>

                </div>
              )}

              {/* Step 4 — Pick a test -> Practice Session Summary & Launch */}
              {step === 4 && (
                <div className="tab-content space-y-4 animate-in fade-in">
                  
                  <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 border border-indigo-100/60 rounded-2xl p-5 text-center space-y-4">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-600/10 text-indigo-700 flex items-center justify-center mx-auto text-xl font-bold">
                      ⚡
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-base text-slate-900">Dynamic Practice Simulator</h4>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        Generates a randomized practice quiz matching your target subjects and nature profile on the fly.
                      </p>
                    </div>

                    <div className="grid gap-2 grid-cols-2 text-left bg-white/70 border border-indigo-100 p-4 rounded-xl text-xs font-bold text-slate-700">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Syllabus Path</span>
                        <span className="truncate block max-w-[180px]">
                          {subject?.name} {selectedTopicId ? `> ${allTaxonomyNodes.find(n => String(n.id) === selectedTopicId)?.name}` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Format Style</span>
                        <span>{format?.label}</span>
                      </div>
                      <div className="mt-2">
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Questions Count</span>
                        <span>{questionCount} Questions</span>
                      </div>
                      <div className="mt-2">
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Question Nature</span>
                        <span>{selectedNature ? selectedNature.name : "All Natures"}</span>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 flex gap-2 items-start text-xs font-bold text-rose-600">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {showAIGeneratePrompt ? (
                    <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-5 space-y-3.5 text-center animate-in fade-in">
                      <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-lg font-bold">
                        ⚡
                      </div>
                      <div className="space-y-1">
                        <h5 className="font-extrabold text-xs text-amber-800">Syllabus Questions Exhausted</h5>
                        <p className="text-[11px] text-amber-700 max-w-xs mx-auto leading-relaxed">
                          We don't have enough active questions in this category right now. Would you like the AI pipeline to draft 5 new questions for <strong>{subject?.name}</strong>?
                        </p>
                      </div>
                      <button
                        onClick={generateAIQuestions}
                        disabled={generatingAI}
                        className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {generatingAI ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            AI Drafting Questions...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Generate & Start Practice Test
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startDynamicTest}
                      disabled={starting}
                      className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-md hover:bg-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50 animate-in fade-in"
                    >
                      {starting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating session...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Start Practice Session
                        </>
                      )}
                    </button>
                  )}

                </div>
              )}
            </>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 bg-slate-50 rounded-b-3xl">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            disabled={starting}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 bg-white disabled:opacity-40 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 4 && (
            <button
              onClick={() => {
                if (step === 1) goToStep2();
                else if (step === 2) goToStep3();
                else if (step === 3) goToStep4();
              }}
              disabled={
                loadingConfig ||
                (step === 1 && !subject) ||
                (step === 2 && !format)
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-40 transition-colors"
            >
              Next
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {step === 4 && (
            <a
              href="/assessment/dashboard"
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Performance Hub →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
