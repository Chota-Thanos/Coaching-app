"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  CheckCircle,
  HelpCircle,
  ClipboardList
} from "lucide-react";
import { useAuth, authenticatedGet, authenticatedPost } from "../../../../components/auth/auth-context";
import { useSubscription } from "../../../../lib/use-subscription";

type Exam = {
  id: number;
  name: string;
  slug: string;
};

type TaxonomyNode = {
  id: number;
  name: string;
  slug: string;
  node_type: string;
  parent_id: number | null;
  content_type?: string;
};

type Question = {
  id: number;
  question_family: string;
  current_version: {
    question_statement: string;
  };
  subject_node_id?: number;
  topic_node_id?: number | null;
};

export default function CreateCustomTestPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
      </div>
    }>
      <CreateCustomTestInner />
    </Suspense>
  );
}

function CreateCustomTestInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, isInitialized } = useAuth();
  const { hasEntitlement } = useSubscription(token);
  const isAssessmentPremium = hasEntitlement("assessment.premium_tests");

  // Page States
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  
  const contentParam = searchParams.get("content_type");
  const defaultContentType = (contentParam === "aptitude" || contentParam === "mains" || contentParam === "csat")
    ? (contentParam === "csat" ? "aptitude" : contentParam)
    : "gk";
  const [contentType, setContentType] = useState<"gk" | "aptitude" | "mains">(defaultContentType as any);
  const [title, setTitle] = useState("");

  // Categories & Question Counts States
  const [allNodes, setAllNodes] = useState<TaxonomyNode[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<number, number>>({});
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  
  // Custom Test Builder Basket
  const [addedCategories, setAddedCategories] = useState<Array<{ node: TaxonomyNode; count: number }>>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  // Status States
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock content type if provided as query param
  const isContentTypeLocked = !!contentParam;

  // 1. Fetch Exams
  useEffect(() => {
    if (!token) return;
    const fetchExams = async () => {
      try {
        const data = await authenticatedGet<Exam[]>("/api/v1/assessment/exams", token);
        setExams(data || []);
        if (data && data.length > 0) {
          setSelectedExamId(data[0]?.id ?? null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load exams.");
      } finally {
        setLoadingExams(false);
      }
    };
    fetchExams();
  }, [token]);

  // 2. Fetch Taxonomy Nodes (Syllabus Categories)
  useEffect(() => {
    if (!token || !selectedExamId) return;
    const fetchCategories = async () => {
      setLoadingCategories(true);
      setError(null);
      try {
        const url = contentType === "mains"
          ? `/api/v1/assessment/mains/taxonomy-nodes?exam_id=${selectedExamId}&limit=1000`
          : `/api/v1/assessment/taxonomy-nodes?exam_id=${selectedExamId}&limit=1000`;
        const data = await authenticatedGet<TaxonomyNode[]>(url, token);
        setAllNodes(data || []);
        setExpandedNodes(new Set()); // Reset expand states
        setAddedCategories([]); // Clear basket on switch
      } catch (err: any) {
        setError(err.message || "Failed to load syllabus categories.");
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [token, selectedExamId, contentType]);

  // 3. Fetch Question Counts per Category
  useEffect(() => {
    if (!token || !selectedExamId) return;
    const fetchCounts = async () => {
      setLoadingCounts(true);
      try {
        const family = contentType === "mains" ? "mains_subjective" : "objective";
        const data = await authenticatedGet<any[]>(
          `/api/v1/assessment/question-counts?exam_id=${selectedExamId}&question_family=${family}`,
          token
        );
        const countMap: Record<number, number> = {};
        (data || []).forEach((row) => {
          countMap[Number(row.node_id)] = Number(row.question_count);
        });
        setQuestionCounts(countMap);
      } catch (err: any) {
        console.error("Failed to load question counts:", err);
      } finally {
        setLoadingCounts(false);
      }
    };
    fetchCounts();
  }, [token, selectedExamId, contentType]);

  // Filter nodes by current content type
  const filteredNodes = useMemo(() => {
    if (contentType === "mains") return allNodes;
    return allNodes.filter((node) => node.content_type === contentType);
  }, [allNodes, contentType]);

  // Group nodes into subjects and topics
  const subjects = useMemo(() => {
    if (contentType === "mains") {
      return filteredNodes.filter((node) => node.node_type === "paper");
    }
    return filteredNodes.filter((node) => node.node_type === "subject");
  }, [filteredNodes, contentType]);

  const topicsBySubject = useMemo(() => {
    const map: Record<number, TaxonomyNode[]> = {};
    subjects.forEach((sub) => {
      if (contentType === "mains") {
        map[sub.id] = filteredNodes.filter(
          (node) => node.parent_id === sub.id
        );
      } else {
        map[sub.id] = filteredNodes.filter(
          (node) => node.node_type === "topic" && node.parent_id === sub.id
        );
      }
    });
    return map;
  }, [filteredNodes, subjects, contentType]);

  // Expand/Collapse Toggle
  const toggleExpand = (id: number) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Quantity Stepper Helpers
  const getQuantity = (nodeId: number, available: number) => {
    return quantities[nodeId] ?? Math.min(10, available);
  };

  const handleStepQuantity = (nodeId: number, delta: number, available: number) => {
    const currentVal = getQuantity(nodeId, available);
    const nextVal = Math.max(1, Math.min(currentVal + delta, available));
    setQuantities((prev) => ({
      ...prev,
      [nodeId]: nextVal
    }));
  };

  // Basket Handlers
  const handleAddCategory = (node: TaxonomyNode) => {
    const available = questionCounts[node.id] ?? 0;
    if (available <= 0) return;

    const count = getQuantity(node.id, available);

    setAddedCategories((prev) => {
      const existing = prev.find((item) => item.node.id === node.id);
      if (existing) {
        return prev.map((item) =>
          item.node.id === node.id
            ? { ...item, count: Math.min(item.count + count, available) }
            : item
        );
      }
      return [...prev, { node, count }];
    });
  };

  const handleRemoveCategory = (nodeId: number) => {
    setAddedCategories((prev) => prev.filter((item) => item.node.id !== nodeId));
  };

  const totalAddedQuestions = useMemo(() => {
    return addedCategories.reduce((sum, item) => sum + item.count, 0);
  }, [addedCategories]);

  // Submit Handler - Fetch random questions and create test
  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedExamId) return;
    if (!title.trim()) {
      setError("Please specify a custom test name.");
      return;
    }
    if (addedCategories.length === 0) {
      setError("Please add questions from at least one category to create your test.");
      return;
    }
    if (!isAssessmentPremium && totalAddedQuestions > 10) {
      setError("⚡ Free tier is limited to 10 questions per custom test. Please reduce the number of questions or upgrade to Assessment Premium for unlimited testing.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const allPickedQuestionIds: number[] = [];

      // Step 1: Query and compile question pools for each category
      for (const item of addedCategories) {
        let url = "";
        if (contentType === "mains") {
          url = `/api/v1/assessment/mains/questions?exam_id=${selectedExamId}&limit=1000`;
          if (item.node.node_type !== "paper") {
            url += `&topic_node_id=${item.node.id}`;
          }
        } else {
          url = `/api/v1/assessment/questions?exam_id=${selectedExamId}&content_type=${contentType}&limit=1000`;
          if (item.node.node_type === "subject") {
            url += `&subject_node_ids=${item.node.id}`;
          } else if (item.node.node_type === "topic") {
            url += `&topic_node_ids=${item.node.id}`;
          }
        }

        const data = await authenticatedGet<Question[]>(url, token);
        if (data && data.length > 0) {
          // Shuffle list
          const shuffled = [...data].sort(() => Math.random() - 0.5);
          // Pick requested count
          const picked = shuffled
            .slice(0, Math.min(item.count, shuffled.length))
            .map((q) => q.id);
          allPickedQuestionIds.push(...picked);
        }
      }

      if (allPickedQuestionIds.length === 0) {
        throw new Error("No questions were found in the selected categories. Please check other categories.");
      }

      // Step 2: Create user custom test template
      const response = await authenticatedPost<{ id: number }>(
        "/api/v1/assessment/user/custom-tests",
        token,
        {
          title: title.trim(),
          exam_id: selectedExamId,
          exam_level_id: 1, // Fallback exam level
          question_ids: allPickedQuestionIds,
          test_type: contentType === "mains" ? "mains_test" : "sectional_test"
        }
      );

      // Step 3: Automatically start attempt
      const attemptId = await authenticatedPost<any>(
        `/api/v1/assessment/test-templates/${response.id}/attempts/start`,
        token,
        {}
      );

      // Step 4: Route to attempts screen
      router.push(`/assessment/attempts/${attemptId.id ?? attemptId}`);
    } catch (err: any) {
      setError(err.message || "Failed to construct custom test.");
      setSubmitting(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
      </div>
    );
  }

  const backUrl = `/assessment/${contentType === "aptitude" ? "csat" : contentType}`;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Top Navigation Header */}
      <div className="border-b border-line bg-white px-4 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={backUrl}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
            >
              <ArrowLeft className="h-5 w-5 text-slate-655" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Create Custom Test</h1>
              <p className="text-xs text-slate-500">Add questions from categories to build your practice exam</p>
            </div>
          </div>
          <div>
            <Link
              href={`/assessment/custom-test?content_type=${contentType}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <ClipboardList className="h-4 w-4 text-indigo-600" />
              <span>My Custom Tests</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-8">
        {!isAssessmentPremium && token && (
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm font-semibold text-indigo-800">
            <p className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-650 shrink-0 fill-indigo-200" />
              <span>Free Tier: Custom tests are limited to a maximum of 10 questions. Upgrade for unlimited questions.</span>
            </p>
            <Link href="/pricing" className="text-xs font-black text-indigo-700 hover:text-indigo-900 underline uppercase tracking-wider shrink-0">
              Upgrade Now
            </Link>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateTest} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left/Sidebar Panel - Config & Basket Summary */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Configuration Card */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-650" />
                <span>Test Config</span>
              </h2>

              <label className="block text-xs font-bold text-slate-655 space-y-1.5">
                <span>Test Name</span>
                <input
                  type="text"
                  placeholder="e.g. My History Focus Test"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                  required
                />
              </label>

              <label className="block text-xs font-bold text-slate-655 space-y-1.5">
                <span>Exam Profile</span>
                <select
                  value={selectedExamId ?? ""}
                  onChange={(e) => setSelectedExamId(Number(e.target.value))}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-905 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                >
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Hide content type picker if locked, or render as read-only */}
              {!isContentTypeLocked ? (
                <div className="block text-xs font-bold text-slate-655 space-y-2">
                  <span>Content Type</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: "gk", label: "GS" },
                      { id: "aptitude", label: "CSAT" },
                      { id: "mains", label: "Mains" }
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setContentType(opt.id);
                        }}
                        className={`h-11 rounded-xl border text-[11px] font-bold transition ${
                          contentType === opt.id
                            ? "border-indigo-650 bg-indigo-50 text-indigo-755"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="block text-xs font-bold text-slate-655 space-y-1">
                  <span>Content Type</span>
                  <div className="h-10 flex items-center justify-between rounded-xl bg-slate-100/70 border border-slate-200 px-3 text-sm font-bold text-slate-700">
                    <span className="capitalize">{contentType === "aptitude" ? "CSAT / Aptitude" : contentType === "gk" ? "General Studies (GS)" : "Mains Syllabus"}</span>
                    <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded uppercase font-black tracking-wider text-slate-500">Locked</span>
                  </div>
                </div>
              )}
            </div>

            {/* Selected Categories Summary basket */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-indigo-600" />
                <span>Selected Categories ({addedCategories.length})</span>
              </h2>

              {addedCategories.length === 0 ? (
                <div className="py-6 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                  <HelpCircle className="h-6 w-6 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">No categories added yet.</p>
                  <p className="text-[10px] text-slate-450 mt-0.5">Use the "Add" buttons in the right panel.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {addedCategories.map((item) => (
                    <div
                      key={item.node.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/70 group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{item.node.name}</p>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          {item.count} question{item.count > 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(item.node.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-100 shadow-sm transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {addedCategories.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-700">Total Questions</span>
                    <span className={`font-black text-base ${!isAssessmentPremium && totalAddedQuestions > 10 ? "text-rose-600" : "text-indigo-650"}`}>
                      {totalAddedQuestions}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold flex justify-between items-center">
                    <span className="text-slate-500">Tier Status</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isAssessmentPremium ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"}`}>
                      {isAssessmentPremium ? "Premium (Unlimited)" : `Free Limit: 10 Qs (${totalAddedQuestions}/10)`}
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right Panel - Expandable Syllabus Tree with Quantity Selectors */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-black uppercase text-slate-850 tracking-wider flex items-center gap-2">
                <Filter className="h-4 w-4 text-indigo-650" />
                <span>Select Categories & Quantity</span>
              </h2>

              {loadingCategories || loadingCounts ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-indigo-650" />
                  <p className="text-xs text-slate-450">Loading syllabus categories & questions counts...</p>
                </div>
              ) : subjects.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <HelpCircle className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm font-bold text-slate-700">No categories available</p>
                  <p className="text-xs text-slate-450 mt-1">Try selecting a different exam profile or category.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {subjects.map((sub) => {
                    const subTopics = topicsBySubject[sub.id] || [];
                    const isExpanded = expandedNodes.has(sub.id);
                    const subAvailable = questionCounts[sub.id] ?? 0;
                    const subAdded = addedCategories.find((item) => item.node.id === sub.id);

                    return (
                      <div key={sub.id} className="rounded-xl border border-slate-100 bg-white p-4 space-y-3">
                        
                        {/* Parent Category Card Row */}
                        <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                          
                          {/* Expander Arrow & Title */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {subTopics.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => toggleExpand(sub.id)}
                                className="grid h-7 w-7 place-items-center rounded-lg border border-slate-100 hover:bg-slate-50 transition"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-500" />
                                )}
                              </button>
                            ) : (
                              <div className="w-7 h-7" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{sub.name}</p>
                              <p className="text-[10px] text-slate-455 mt-0.5 font-bold uppercase tracking-wider">
                                {subTopics.length > 0 ? `${subTopics.length} Sub-Levels` : "Parent Category"}
                              </p>
                            </div>
                          </div>

                          {/* Stepper counter & Add Button */}
                          {subAvailable > 0 ? (
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-extrabold text-indigo-650 px-2 py-1 bg-indigo-50 rounded-lg">
                                {subAvailable} Available
                              </span>

                              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/50">
                                <button
                                  type="button"
                                  onClick={() => handleStepQuantity(sub.id, -1, subAvailable)}
                                  className="h-8 w-8 grid place-items-center text-slate-655 hover:text-slate-800 transition"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-8 text-center text-xs font-bold text-slate-800">
                                  {getQuantity(sub.id, subAvailable)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleStepQuantity(sub.id, 1, subAvailable)}
                                  className="h-8 w-8 grid place-items-center text-slate-655 hover:text-slate-800 transition"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddCategory(sub)}
                                className={`h-8 px-4 rounded-lg text-xs font-bold shadow-sm transition ${
                                  subAdded
                                    ? "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                    : "bg-indigo-600 text-white hover:bg-indigo-500"
                                }`}
                              >
                                {subAdded ? "Add More" : "Add"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                              No Questions
                            </span>
                          )}
                        </div>

                        {/* Child Categories (Topics) inside Expanded Subject */}
                        {isExpanded && subTopics.length > 0 && (
                          <div className="pl-4 border-l border-slate-100 ml-3.5 space-y-3 pt-2">
                            {subTopics.map((topic) => {
                              const topicAvailable = questionCounts[topic.id] ?? 0;
                              const topicAdded = addedCategories.find((item) => item.node.id === topic.id);

                              return (
                                <div
                                  key={topic.id}
                                  className="flex items-center justify-between gap-4 p-2.5 rounded-lg border border-slate-50 bg-slate-50/30 flex-wrap sm:flex-nowrap"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 truncate">{topic.name}</p>
                                  </div>

                                  {topicAvailable > 0 ? (
                                    <div className="flex items-center gap-3 shrink-0">
                                      <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {topicAvailable} Qs
                                      </span>

                                      <div className="flex items-center border border-slate-200 rounded-md bg-white">
                                        <button
                                          type="button"
                                          onClick={() => handleStepQuantity(topic.id, -1, topicAvailable)}
                                          className="h-7 w-7 grid place-items-center text-slate-500 hover:text-slate-800 transition"
                                        >
                                          <Minus className="h-3 w-3" />
                                        </button>
                                        <span className="w-6 text-center text-[11px] font-bold text-slate-800">
                                          {getQuantity(topic.id, topicAvailable)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleStepQuantity(topic.id, 1, topicAvailable)}
                                          className="h-7 w-7 grid place-items-center text-slate-500 hover:text-slate-800 transition"
                                        >
                                          <Plus className="h-3 w-3" />
                                        </button>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleAddCategory(topic)}
                                        className={`h-7 px-3 rounded-md text-[11px] font-bold shadow-sm transition ${
                                          topicAdded
                                            ? "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                            : "bg-indigo-600 text-white hover:bg-indigo-500"
                                        }`}
                                      >
                                        {topicAdded ? "Add More" : "Add"}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-400">
                                      No Qs
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Submit trigger */}
              <div className="pt-4 border-t border-slate-150">
                <button
                  type="submit"
                  disabled={submitting || addedCategories.length === 0}
                  className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 hover:bg-slate-850 px-4 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                  <span>Create & Start Custom Test</span>
                </button>
              </div>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
