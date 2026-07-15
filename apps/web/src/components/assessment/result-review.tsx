"use client";

import Link from "next/link";
import { BarChart3, CheckCircle2, CircleAlert, Clock3, Filter, Target, Trophy, XCircle, Bookmark, Sparkles, FileCheck2, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ResultReview as ResultReviewType, TestQuestionItem } from "../../lib/assessment";
import { assessmentHref, formatMarks, formatPercent, optionKey, optionText, selectedAnswerKey } from "../../lib/assessment";
import { authenticatedGet, useAuth, authenticatedPost, authenticatedDelete, authenticatedPatch } from "../auth/auth-context";
import { SignInPanel } from "../auth/sign-in-panel";
import { TopicHeatmap } from "./topic-heatmap";
import { TimeChart } from "./time-chart";
import { ErrorTagger } from "./error-tagger";

type Tab = "summary" | "questions" | "topics" | "time";
type QuestionFilter = "all" | "correct" | "incorrect" | "unattempted";

function outcomeClass(outcome: string | undefined): string {
  if (outcome === "correct") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (outcome === "incorrect") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function outcomeLabel(outcome: string | undefined): string {
  if (outcome === "correct") return "✓ Correct";
  if (outcome === "incorrect") return "✗ Incorrect";
  return "— Unattempted";
}

/* ── Score gauge ──────────────────────────────────────── */
function ScoreGauge({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0;
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="gauge-ring"
            style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-ink">{Math.round(pct)}%</span>
          <span className="text-[11px] font-semibold text-muted">score</span>
        </div>
      </div>
      <p className="mt-2 text-sm font-bold text-ink">
        {formatMarks(score)} / {formatMarks(maxScore)}
      </p>
    </div>
  );
}

/* ── Tab button ───────────────────────────────────────── */
function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all border ${
        active
          ? "bg-slate-900 text-white shadow-sm border-slate-900"
          : "bg-white text-slate-650 hover:bg-slate-50 border-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Main component ───────────────────────────────────── */
export function ResultReview({ resultId }: { resultId: string }) {
  const { token, user } = useAuth();
  const [review, setReview] = useState<ResultReviewType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [qFilter, setQFilter] = useState<QuestionFilter>("all");

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const [evaluatingIds, setEvaluatingIds] = useState<Set<number>>(new Set());

  // Manual evaluation form state
  const [editingAnswerId, setEditingAnswerId] = useState<number | null>(null);
  const [manualScore, setManualScore] = useState<string>("");
  const [manualMaxScore, setManualMaxScore] = useState<string>("");
  const [manualFeedback, setManualFeedback] = useState<string>("");
  const [manualCheckedCopyUrl, setManualCheckedCopyUrl] = useState<string>("");
  const [manualStrengths, setManualStrengths] = useState<string>("");
  const [manualWeaknesses, setManualWeaknesses] = useState<string>("");
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);

  const mainsPendingEvaluation = useMemo(() => {
    if (!review) return false;
    return review.questions.some(
      (q) =>
        q.question_format?.question_family === "mains_subjective" &&
        q.response &&
        (q.response as any).evaluation_status !== "evaluated"
    );
  }, [review]);

  const canEvaluate = useMemo(() => {
    if (!review || !user) return false;
    return (
      ["admin", "moderator", "evaluator", "mentor"].includes(user.role) ||
      Number(user.id) === Number(review.attempt.user_id)
    );
  }, [review, user]);

  const startManualEvaluation = (question: any) => {
    const response = question.response;
    if (!response) return;
    setEditingAnswerId(response.id);
    setManualScore(response.score !== null && response.score !== undefined ? String(response.score) : "");
    setManualMaxScore(response.max_score !== null && response.max_score !== undefined ? String(response.max_score) : String(question.marks || 10));
    setManualFeedback(response.feedback || "");
    setManualCheckedCopyUrl(response.checked_copy_url || "");
    setManualStrengths(Array.isArray(response.strengths) ? response.strengths.join("\n") : "");
    setManualWeaknesses(Array.isArray(response.weaknesses) ? response.weaknesses.join("\n") : "");
  };

  const cancelManualEvaluation = () => {
    setEditingAnswerId(null);
  };

  const handleSaveManualEvaluation = async () => {
    if (!token || !editingAnswerId) return;
    const scoreNum = parseFloat(manualScore);
    const maxScoreNum = parseFloat(manualMaxScore) || 10;
    if (isNaN(scoreNum) || scoreNum < 0) {
      alert("Please enter a valid non-negative score.");
      return;
    }
    if (scoreNum > maxScoreNum) {
      alert(`Score cannot exceed maximum marks (${maxScoreNum}).`);
      return;
    }

    setIsSavingManual(true);
    try {
      const strengthsArr = manualStrengths
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const weaknessesArr = manualWeaknesses
        .split("\n")
        .map((w) => w.trim())
        .filter(Boolean);

      await authenticatedPatch(`/api/v1/assessment/mains/answers/${editingAnswerId}/evaluation`, token, {
        score: scoreNum,
        max_score: maxScoreNum,
        feedback: manualFeedback.trim() || undefined,
        checked_copy_url: manualCheckedCopyUrl.trim() || undefined,
        strengths: strengthsArr,
        weaknesses: weaknessesArr
      });

      setEditingAnswerId(null);
      await loadReview();
    } catch (err: any) {
      console.error("Failed to save manual evaluation:", err);
      alert(err.message || "Failed to save manual evaluation. Please try again.");
    } finally {
      setIsSavingManual(false);
    }
  };

  const triggerAiEvaluation = async (answerAttemptId: number, questionId: number) => {
    if (!token) return;
    setEvaluatingIds((prev) => {
      const next = new Set(prev);
      next.add(questionId);
      return next;
    });
    try {
      await authenticatedPost(`/api/v1/assessment/mains/answers/${answerAttemptId}/ai-evaluate`, token, {});
      // Refresh the review details
      await loadReview();
    } catch (err) {
      console.error("AI Evaluation failed:", err);
      alert("Failed to trigger AI evaluation. Please try again.");
    } finally {
      setEvaluatingIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    }
  };

  const renderSubjectiveAnswer = (question: any) => {
    const response = question.response;
    if (!response) {
      return (
        <div className="mt-4 rounded-xl border border-slate-205 bg-slate-50/50 p-4 text-sm text-slate-500 italic">
          No answer response was submitted for this question.
        </div>
      );
    }

    const isEvaluating = evaluatingIds.has(question.id) || response.evaluation_status === "ai_evaluating";

    if (editingAnswerId === response.id) {
      return (
        <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/20 p-5 space-y-4">
          <h4 className="font-extrabold text-sm text-indigo-800 flex items-center gap-1.5 border-b border-indigo-100 pb-2">
            <FileCheck2 className="h-4 w-4 text-indigo-650" />
            Manual Evaluation & Marks
          </h4>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Score Obtained</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max={manualMaxScore}
                value={manualScore}
                onChange={(e) => setManualScore(e.target.value)}
                className="w-full rounded-xl border border-slate-205 bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                placeholder="e.g. 6.5"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Maximum Score</label>
              <input
                type="number"
                value={manualMaxScore}
                onChange={(e) => setManualMaxScore(e.target.value)}
                className="w-full rounded-xl border border-slate-205 bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                placeholder="e.g. 10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Manually Checked Copy URL (Optional)</label>
            <input
              type="url"
              value={manualCheckedCopyUrl}
              onChange={(e) => setManualCheckedCopyUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-205 bg-white px-3 py-2 text-sm text-slate-850 focus:border-indigo-500 focus:outline-none"
              placeholder="https://example.com/checked-copy.pdf"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-emerald-800 mb-1">Strengths (One per line)</label>
              <textarea
                value={manualStrengths}
                onChange={(e) => setManualStrengths(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. Good introduction&#10;Addressed all core parts"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-rose-800 mb-1">Areas of Improvement (One per line)</label>
              <textarea
                value={manualWeaknesses}
                onChange={(e) => setManualWeaknesses(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-rose-500 focus:outline-none"
                placeholder="e.g. Improve conclusion&#10;Word limit exceeded"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Detailed Feedback Report (Markdown/HTML supported)</label>
            <textarea
              value={manualFeedback}
              onChange={(e) => setManualFeedback(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-205 bg-white px-3 py-2 text-sm text-slate-855 focus:border-indigo-500 focus:outline-none"
              placeholder="Write detailed review, structure analysis, verdict..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={cancelManualEvaluation}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveManualEvaluation}
              disabled={isSavingManual}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-650 px-4 text-xs font-bold text-white hover:bg-indigo-750 transition-colors disabled:opacity-50"
            >
              {isSavingManual && <Loader2 className="h-3 w-3 animate-spin" />}
              Save Evaluation
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-5 space-y-4">
        {/* Student's answer submission */}
        {response.student_answer_text && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wide mb-2">Submitted Answer Text</h4>
            <p className="text-sm text-slate-705 whitespace-pre-wrap leading-relaxed font-sans">
              {response.student_answer_text}
            </p>
          </div>
        )}

        {response.answer_file_url && (
          <div className="flex items-center gap-2">
            <a
              href={response.answer_file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Submitted Answer Copy
            </a>
          </div>
        )}

        {/* Evaluation status and details */}
        {response.evaluation_status === "evaluated" ? (
          <div className="bg-slate-50/50 border border-slate-205 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-650" />
                AI Evaluation Report
              </h4>
              <div className="text-right">
                <span className="text-2xl font-black text-indigo-650">{response.score}</span>
                <span className="text-xs text-slate-400 font-bold">/{response.max_score || question.marks || 10}</span>
              </div>
            </div>

            {response.checked_copy_url && (
              <a
                href={response.checked_copy_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50 transition-colors"
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                Open Checked Copy with Notes
              </a>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3.5 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-1.5">
                <h5 className="text-[10px] font-black text-emerald-800 uppercase tracking-wide">Key Strengths</h5>
                {response.strengths && response.strengths.length > 0 ? (
                  <ul className="list-disc list-inside text-xs text-emerald-700 space-y-1 leading-relaxed">
                    {response.strengths.map((s: string, idx: number) => <li key={idx}>{s}</li>)}
                  </ul>
                ) : (
                  <p className="text-xs text-emerald-605">Structured layout maintained.</p>
                )}
              </div>

              <div className="p-3.5 bg-rose-50/40 border border-rose-100 rounded-xl space-y-1.5">
                <h5 className="text-[10px] font-black text-rose-800 uppercase tracking-wide">Areas of Improvement</h5>
                {response.weaknesses && response.weaknesses.length > 0 ? (
                  <ul className="list-disc list-inside text-xs text-rose-750 space-y-1 leading-relaxed">
                    {response.weaknesses.map((w: string, idx: number) => <li key={idx}>{w}</li>)}
                  </ul>
                ) : (
                  <p className="text-xs text-rose-605">Link relevant commissions/case laws.</p>
                )}
              </div>
            </div>

            {response.feedback && (
              <div className="space-y-1.5">
                <h5 className="text-[10px] font-black text-slate-450 uppercase tracking-wide">Detailed feedback report</h5>
                <div
                  dangerouslySetInnerHTML={{ __html: response.feedback }}
                  className="prose prose-sm max-h-[300px] overflow-y-auto pr-1 text-sm leading-relaxed text-slate-700 space-y-2 border border-slate-200/60 p-4 bg-white rounded-xl"
                />
              </div>
            )}
            
            {/* Allow re-evaluating */}
            <div className="pt-2 border-t border-slate-200/50 flex justify-end gap-2">
              {canEvaluate && (
                <button
                  type="button"
                  onClick={() => startManualEvaluation(question)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-650 hover:bg-slate-50 transition-colors"
                >
                  Edit Manual Marks
                </button>
              )}
              <button
                type="button"
                onClick={() => triggerAiEvaluation(response.id, question.id)}
                disabled={isEvaluating}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-650 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Re-evaluating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    Re-evaluate with AI
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-amber-800">
                  {response.evaluation_status === "ai_evaluating"
                    ? "AI is evaluating this response..."
                    : response.evaluation_status === "needs_manual_review"
                    ? "Needs manual evaluator review"
                    : "Evaluation is pending"}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {response.evaluation_status === "ai_evaluating"
                    ? "Our AI model is currently scoring and analyzing your answer sheet. This will take a moment."
                    : "A checked copy and detailed examiner scorecard will be generated."}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {canEvaluate && (
                  <button
                    type="button"
                    onClick={() => startManualEvaluation(question)}
                    className="h-10 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 text-amber-850 font-bold text-xs px-4 shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                  >
                    Enter Manual Marks
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => triggerAiEvaluation(response.id, question.id)}
                  disabled={isEvaluating}
                  className="h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 shadow-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Evaluate Answer with AI
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (!token) return;
    const fetchBookmarks = async () => {
      try {
        const data = await authenticatedGet<any[]>("/api/v1/assessment/me/bookmarks", token);
        const ids = new Set((data || []).map((b) => b.question_id));
        setBookmarkedIds(ids);
      } catch (err) {
        console.error("Failed to load bookmarks", err);
      }
    };
    fetchBookmarks();
  }, [token]);

  const toggleBookmark = async (questionId: number, questionVersionId: number) => {
    if (!token) return;
    const isBookmarked = bookmarkedIds.has(questionId);
    
    // Optimistic UI update
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });

    try {
      if (isBookmarked) {
        await authenticatedDelete(`/api/v1/assessment/me/bookmarks/${questionId}`, token);
      } else {
        await authenticatedPost("/api/v1/assessment/me/bookmarks", token, {
          question_id: questionId,
          question_version_id: questionVersionId
        });
      }
    } catch (err) {
      console.error("Failed to toggle bookmark", err);
      // Revert on error
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (isBookmarked) {
          next.add(questionId);
        } else {
          next.delete(questionId);
        }
        return next;
      });
    }
  };

  const loadReview = useCallback(async () => {
    if (!token) return;
    try {
      const record = await authenticatedGet<ResultReviewType>(
        `/api/v1/assessment/results/${resultId}/review`,
        token
      );
      setReview(record);
    } catch {
      setMessage("Could not load this result review.");
    }
  }, [resultId, token]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  // Polling for AI evaluation status
  useEffect(() => {
    if (!review || !token) return;
    const hasEvaluating = review.questions.some(
      (q) =>
        q.question_format?.question_family === "mains_subjective" &&
        (q.response as any)?.evaluation_status === "ai_evaluating"
    );
    if (!hasEvaluating) return;

    const interval = setInterval(() => {
      void loadReview();
    }, 4000);

    return () => clearInterval(interval);
  }, [review, token, loadReview]);

  // Configure MathJax
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).MathJax = {
        tex: {
          inlineMath: [['$', '$'], ['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']]
        },
        options: {
          ignoreHtmlClass: 'tex2jax_ignore',
          processHtmlClass: 'tex2jax_process'
        }
      };
    }
  }, []);

  // Typeset math formula text whenever data renders or tab changes
  useEffect(() => {
    if (!review) return;
    const scriptId = "mathjax-script-cdn";
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
      script.async = true;
      document.head.appendChild(script);
      script.onload = () => {
        if ((window as any).MathJax && typeof (window as any).MathJax.typesetPromise === "function") {
          (window as any).MathJax.typesetPromise().catch((err: any) => console.error("MathJax init error:", err));
        }
      };
    } else {
      if ((window as any).MathJax) {
        setTimeout(() => {
          if ((window as any).MathJax && typeof (window as any).MathJax.typesetPromise === "function") {
            (window as any).MathJax.typesetPromise().catch((err: any) => console.error("MathJax typesetting error:", err));
          }
        }, 150);
      }
    }
  }, [tab, review, qFilter]);

  const filteredQuestions = useMemo(() => {
    if (!review) return [];
    return review.questions.filter((q) => {
      if (qFilter === "all") return true;
      const outcome = q.score_item?.outcome;
      if (qFilter === "correct") return outcome === "correct";
      if (qFilter === "incorrect") return outcome === "incorrect";
      if (qFilter === "unattempted") return !outcome || outcome === "unattempted";
      return true;
    });
  }, [review, qFilter]);

  const groupedItems = useMemo(() => {
    if (!review) return [];
    const items: Array<
      | { type: "independent"; question: TestQuestionItem; originalIndex: number }
      | { type: "passage"; passage: Exclude<TestQuestionItem["passage"], null | undefined>; questions: Array<{ question: TestQuestionItem; originalIndex: number }> }
    > = [];

    const passageMap = new Map<number, typeof items[number] & { type: "passage" }>();

    filteredQuestions.forEach((q) => {
      const originalIndex = review.questions.findIndex((x) => x.id === q.id);
      if (q.passage) {
        const existing = passageMap.get(q.passage.id);
        if (existing) {
          existing.questions.push({ question: q, originalIndex });
        } else {
          const group: { type: "passage"; passage: Exclude<TestQuestionItem["passage"], null | undefined>; questions: Array<{ question: TestQuestionItem; originalIndex: number }> } = {
            type: "passage",
            passage: q.passage,
            questions: [{ question: q, originalIndex }]
          };
          passageMap.set(q.passage.id, group);
          items.push(group);
        }
      } else {
        items.push({
          type: "independent",
          question: q,
          originalIndex
        });
      }
    });

    return items;
  }, [filteredQuestions, review]);

  if (!token) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="h-1.5 bg-gradient-to-r from-civic to-emerald" />
          <div className="p-6 md:p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-civic/10 text-2xl">
              🎉
            </div>
            <h1 className="text-2xl font-black text-ink">Your result is ready</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
              Create a free account (takes 10 seconds) to unlock your score, topic-wise breakdown, and full answer review — and save it to your dashboard for good.
            </p>
            <div className="mx-auto mt-6 max-w-sm text-left">
              <SignInPanel />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!review) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <p className="rounded-2xl border border-line bg-surface p-6 text-sm font-semibold text-muted">
          {message ?? "Loading result…"}
        </p>
      </main>
    );
  }

  const clearedCutoff = review.cutoff_status === "cleared";
  const weakTopics = (review.topic_breakdowns ?? []).filter((t) => Number(t.accuracy) < 0.6);

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-0.5">
      <main className="mx-auto max-w-7xl space-y-5 px-4 pt-5">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-surface px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              Result Review
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <h1 className="text-xl font-black leading-snug text-slate-900 md:text-2xl">
                {review.test_template.title}
              </h1>
              <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border ${
                review.test_template.test_type === "mains_test"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : (review.topic_breakdowns?.[0] as any)?.taxonomy_content_type === "aptitude"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}>
                {review.test_template.test_type === "mains_test" 
                  ? "Mains Section" 
                  : (review.topic_breakdowns?.[0] as any)?.taxonomy_content_type === "aptitude" 
                  ? "CSAT Section" 
                  : "GK Section"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={assessmentHref("/dashboard")}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-650 hover:border-indigo-650 hover:text-indigo-650 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href={assessmentHref("/tests")}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-indigo-600 transition-colors"
            >
              Try again
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-205 bg-white p-1.5 shadow-card">
          <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Summary
          </TabButton>
          <TabButton active={tab === "questions"} onClick={() => setTab("questions")}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Questions ({review.questions.length})
          </TabButton>
          <TabButton active={tab === "topics"} onClick={() => setTab("topics")}>
            <Target className="h-4 w-4" aria-hidden="true" />
            Topics
          </TabButton>
          <TabButton active={tab === "time"} onClick={() => setTab("time")}>
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            Time Analysis
          </TabButton>
        </div>

      {/* ── Tab: Summary ──────────────────────────────── */}
      {tab === "summary" && (
        <div className="tab-content space-y-5">
          {mainsPendingEvaluation ?
            <div className="space-y-6">
              {/* Premium Gradient Hero Card */}
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-slate-50 to-indigo-50/30 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-600 text-white text-xl shadow-sm shrink-0">
                    ✍️
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Mains Evaluation Pending</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Your subjective answer sheets are successfully registered. You can evaluate them using our AI UPSC Examiner, or submit manual grading scores and upload checked copies.
                    </p>
                    {/* Visual Progress */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-indigo-100/70 border border-indigo-200 px-3 py-1 text-xs font-black text-indigo-750">
                        {review.questions.filter(q => q.response && (q.response as any).evaluation_status === 'evaluated').length} / {review.questions.filter(q => q.response).length} Evaluated
                      </span>
                      <span className="rounded-full bg-amber-100/70 border border-amber-200 px-3 py-1 text-xs font-black text-amber-750">
                        {review.questions.filter(q => q.response && (q.response as any).evaluation_status !== 'evaluated').length} Awaiting Evaluation
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Mains Questions Evaluation Checklist */}
              <div className="rounded-2xl border border-slate-205 bg-white p-5 shadow-card space-y-4">
                <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Mains Answer Copies & Grading Checklist</h3>
                <div className="divide-y divide-slate-100">
                  {review.questions.map((q, idx) => {
                    const response = q.response as any;
                    const status = response?.evaluation_status;
                    const isEvaluating = evaluatingIds.has(q.id) || status === "ai_evaluating";

                    return (
                      <div key={q.id} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-400">Q{idx + 1}</span>
                            {/* Status Badge */}
                            {!response ? (
                              <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-black text-slate-500">
                                Unattempted
                              </span>
                            ) : status === "evaluated" ? (
                              <span className="rounded-full bg-emerald-50 border border-emerald-250 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                                Score: {response.score} / {response.max_score || q.marks || 10}
                              </span>
                            ) : isEvaluating ? (
                              <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[10px] font-black text-indigo-700 animate-pulse">
                                AI Evaluating...
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-black text-amber-800">
                                Pending Evaluation
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-800 line-clamp-2">
                            {q.question_version.question_statement}
                          </p>
                        </div>

                        {/* Quick actions in checklist */}
                        {response && (
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {canEvaluate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTab("questions");
                                  setTimeout(() => {
                                    document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                                    startManualEvaluation(q);
                                  }, 150);
                                }}
                                className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
                              >
                                {status === "evaluated" ? "Edit Marks" : "Manual Marks"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => triggerAiEvaluation(response.id, q.id)}
                              disabled={isEvaluating}
                              className="h-9 px-3.5 rounded-lg bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                            >
                              {isEvaluating ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Evaluating...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3 w-3" />
                                  {status === "evaluated" ? "Re-evaluate" : "AI Evaluate"}
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          : (
            <>
              <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
                {/* Score gauge */}
                <div className="flex items-center justify-center rounded-2xl border border-line bg-surface p-8 shadow-card">
                  <ScoreGauge score={Number(review.score)} maxScore={Number(review.max_score)} />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                  {[
                    { label: "Score", value: `${formatMarks(review.score)} / ${formatMarks(review.max_score)}`, icon: "🎯" },
                    { label: "Accuracy", value: formatPercent(review.accuracy), icon: "📊" },
                    { label: "Correct", value: review.correct_count, icon: "✅" },
                    { label: "Incorrect", value: review.incorrect_count, icon: "❌" },
                    { label: "Unattempted", value: review.unattempted_count, icon: "⬜" },
                    { label: "Negative", value: `-${formatMarks(review.negative_marks)}`, icon: "⚠️" },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4 shadow-card">
                      <span className="text-base">{icon}</span>
                      <span className="mt-1 text-xl font-black text-ink">{value}</span>
                      <span className="text-xs font-semibold text-muted">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cutoff status banner */}
              {review.cutoff_status && (
                <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 border ${clearedCutoff ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"}`}>
                  <span className="text-2xl">{clearedCutoff ? "🎉" : "📈"}</span>
                  <div>
                    <p className={`text-sm font-black ${clearedCutoff ? "text-emerald-700" : "text-rose-700"}`}>
                      {clearedCutoff ? "Cutoff Cleared!" : "Just below cutoff"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {review.cutoff_status}
                    </p>
                  </div>
                </div>
              )}

              {/* Diagnostic Test Category Accuracy Breakdown */}
              {review.test_template.test_type === "diagnostic_test" && review.topic_breakdowns && review.topic_breakdowns.length > 0 && (
                <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <span className="text-2xl">🩺</span>
                    <div>
                      <h2 className="text-base font-black text-slate-900">Diagnostic Performance Report</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Syllabus-wise accuracy diagnosis. Use this breakdown to focus your study plan.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {review.topic_breakdowns.map((topic) => {
                      const accuracyVal = Number(topic.accuracy);
                      const percent = accuracyVal <= 1 ? accuracyVal * 100 : accuracyVal;
                      const roundedPercent = Math.round(percent);
                      
                      let barColor = "bg-rose-500";
                      let bgColor = "bg-rose-50 border-rose-100";
                      let diagnosticLabel = "Critical Gap";

                      if (roundedPercent >= 70) {
                        barColor = "bg-emerald-500";
                        bgColor = "bg-emerald-50 border-emerald-100";
                        diagnosticLabel = "Strong Concept";
                      } else if (roundedPercent >= 40) {
                        barColor = "bg-amber-500";
                        bgColor = "bg-amber-50 border-amber-100";
                        diagnosticLabel = "Moderate Gap";
                      }

                      return (
                        <div
                          key={`${topic.taxonomy_name}-${topic.id}`}
                          className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${bgColor}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-900 truncate">
                                {topic.taxonomy_name ?? "General Syllabus"}
                              </span>
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                roundedPercent >= 70 ? "bg-emerald-100 text-emerald-800" :
                                roundedPercent >= 40 ? "bg-amber-100 text-amber-800" :
                                "bg-rose-100 text-rose-800"
                              }`}>
                                {diagnosticLabel}
                              </span>
                            </div>
                            
                            <div className="mt-3 flex items-baseline gap-1 text-2xl font-black text-slate-900">
                              <span>{roundedPercent}%</span>
                              <span className="text-xs font-semibold text-slate-500">accuracy</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {/* Progress bar */}
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${roundedPercent}%`, transition: "width 1s ease-out" }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                              <span>{topic.correct_count} Correct / {topic.total_questions} Questions</span>
                              <span>Avg Time: {Math.round(Number(topic.avg_time_seconds || 0))}s/Q</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Weak topics summary */}
              {weakTopics.length > 0 && (
                <div className="space-y-3">
                  <h2 className="flex items-center gap-2 text-base font-black text-ink">
                    <Target className="h-4 w-4 text-rose-600" aria-hidden="true" />
                    Priority Revision Areas
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {weakTopics.slice(0, 4).map((topic) => (
                      <div
                        key={`${topic.taxonomy_name}-${topic.question_nature_name}`}
                        className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/50 p-4"
                      >
                        <span className="mt-0.5 text-lg">🔴</span>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{topic.taxonomy_name ?? "Unmapped"}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatPercent(topic.accuracy)} accuracy · {topic.total_questions} questions
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-600">
                            Revise this topic before your next test.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions Summary Grid */}
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <h2 className="flex items-center gap-2 text-base font-black text-ink">
                  <span className="text-lg">📋</span>
                  Questions Status & Bookmarks
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Click a cell to review the question, or click the bookmark icon to toggle it.
                </p>
                <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15">
                  {review.questions.map((q, idx) => {
                    const outcome = q.score_item?.outcome;
                    const isBookmarked = bookmarkedIds.has(q.id);
                    let bgClass = "bg-slate-50 border-slate-205 text-slate-650 hover:bg-slate-100/80";
                    if (outcome === "correct") {
                      bgClass = "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70";
                    } else if (outcome === "incorrect") {
                      bgClass = "bg-rose-50 border-rose-100 text-rose-800 hover:bg-rose-100/70";
                    }
                    return (
                      <div
                        key={q.id}
                        className={`relative flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all cursor-pointer ${bgClass}`}
                        onClick={() => {
                          setTab("questions");
                          setTimeout(() => {
                            document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 100);
                        }}
                      >
                        <span className="text-xs font-bold">Q{idx + 1}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(q.id, q.question_version.id);
                          }}
                          className={`mt-1.5 rounded-md p-1 transition ${
                            isBookmarked ? "text-amber-500 hover:bg-amber-100/50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                          }`}
                          title={isBookmarked ? "Remove Bookmark" : "Bookmark Question"}
                        >
                          <Bookmark className="h-3 w-3" fill={isBookmarked ? "currentColor" : "none"} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Questions ─────────────────────────────── */}
      {tab === "questions" && (
        <div className="tab-content space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
            <Filter className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {(["all", "correct", "incorrect", "unattempted"] as QuestionFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setQFilter(f)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold capitalize transition-all border ${
                  qFilter === f
                    ? f === "correct"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : f === "incorrect"
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {f} ({f === "all"
                  ? review.questions.length
                  : f === "correct"
                    ? review.correct_count
                    : f === "incorrect"
                      ? review.incorrect_count
                      : review.unattempted_count})
              </button>
            ))}
          </div>

          <div className="grid gap-4">
            {groupedItems.map((item, groupIdx) => {
              if (item.type === "independent") {
                const { question, originalIndex } = item;
                const outcome = question.score_item?.outcome;
                const selected = selectedAnswerKey(
                  question.response?.selected_answer ?? question.score_item?.selected_answer
                );
                const correct = selectedAnswerKey(
                  question.question_version.correct_answer ?? question.score_item?.correct_answer
                );
                const timeSpent = question.score_item?.time_spent_seconds ?? 0;

                return (
                  <article
                    id={`q-${question.id}`}
                    key={question.id}
                    className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
                  >
                    {/* Question header */}
                    <div className="flex items-center justify-between gap-3 border-b border-line/50 bg-paper px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {question.question_format?.question_family === "mains_subjective" ? (
                          !question.response ? (
                            <span className="rounded-full border border-slate-205 bg-slate-50 px-2.5 py-0.5 text-[11px] font-black text-slate-650">
                              — Not Submitted
                            </span>
                          ) : (
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${
                              (question.response as any).evaluation_status === 'evaluated'
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : (question.response as any).evaluation_status === 'ai_evaluating'
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-amber-250 bg-amber-50 text-amber-700"
                            }`}>
                              {(question.response as any).evaluation_status === 'evaluated'
                                ? "✓ Evaluated"
                                : (question.response as any).evaluation_status === 'ai_evaluating'
                                ? "⚙ AI Evaluating..."
                                : "🕒 Under Review"}
                            </span>
                          )
                        ) : (
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${outcomeClass(outcome)}`}>
                            {outcomeLabel(outcome)}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-muted">
                          Q{originalIndex + 1}
                        </span>
                        {question.question_version.created_by_user_id && (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-700" title="This is a private question added by you. WayToIAS does not take responsibility for its correctness.">
                            ⚠️ Your Question
                          </span>
                        )}
                        {timeSpent > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-muted">
                            <Clock3 className="h-3 w-3" aria-hidden="true" />
                            {Math.round(Number(timeSpent))}s
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleBookmark(question.id, question.question_version.id)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                            bookmarkedIds.has(question.id)
                              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/50"
                              : "border-slate-200 bg-white text-slate-650 hover:bg-slate-50 hover:text-slate-800"
                          }`}
                          title={bookmarkedIds.has(question.id) ? "Remove Bookmark" : "Bookmark Question"}
                        >
                          <Bookmark className="h-3.5 w-3.5" fill={bookmarkedIds.has(question.id) ? "currentColor" : "none"} />
                          <span>{bookmarkedIds.has(question.id) ? "Marked for Revision" : "Mark for Revision"}</span>
                        </button>
                        <span className="text-xs font-black text-ink">
                          {formatMarks(question.score_item?.score)} pts
                        </span>
                      </div>
                    </div>

                    {/* Question body */}
                    <div className="p-4">
                      <h3 className="text-sm font-bold leading-snug text-ink md:text-base">
                        {question.question_version.question_statement}
                      </h3>
                      {question.question_version.supplementary_statement && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                          {question.question_version.supplementary_statement}
                        </p>
                      )}
                      {question.question_version.question_prompt && (
                        <p className="mt-2 text-sm font-bold text-ink">
                          {question.question_version.question_prompt}
                        </p>
                      )}

                      {/* Options */}
                      {question.question_format?.question_family === "mains_subjective" ? (
                        renderSubjectiveAnswer(question)
                      ) : (
                        question.question_version.options && Array.isArray(question.question_version.options) && (
                          <div className="mt-4 grid gap-2">
                            {question.question_version.options.map((option, optIndex) => {
                              const key = optionKey(option, optIndex);
                              const isSelected = selected === key;
                              const isCorrect = correct === key;
                              return (
                                <div
                                  key={`${question.id}-${key}`}
                                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm leading-6 transition-colors ${
                                    isCorrect
                                      ? "border-emerald-250 bg-emerald-50 text-emerald-800"
                                      : isSelected
                                        ? "border-rose-200 bg-rose-50 text-rose-800"
                                        : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                                  }`}
                                >
                                  <span
                                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${
                                      isCorrect
                                        ? "bg-emerald-600 text-white"
                                        : isSelected
                                          ? "bg-rose-600 text-white"
                                          : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {key}
                                  </span>
                                  <span className="flex-1 text-slate-800">{optionText(option, optIndex)}</span>
                                  {isCorrect && (
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                                  )}
                                  {isSelected && !isCorrect && (
                                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )
                      )}

                      {/* Explanation */}
                      {question.question_version.explanation && (
                        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                          <p className="flex items-center gap-2 text-xs font-black text-indigo-700">
                            <CircleAlert className="h-3.5 w-3.5 text-indigo-650" aria-hidden="true" />
                            Explanation
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-650">
                            {question.question_version.explanation}
                          </p>
                        </div>
                      )}

                      {/* Error tagger */}
                      <ErrorTagger questionId={question.id} />
                    </div>
                  </article>
                );
              } else {
                const { passage, questions } = item;
                return (
                  <article
                    key={`passage-group-${passage.id}-${groupIdx}`}
                    className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
                  >
                    <div className="bg-paper border-b border-line/50 px-4 py-2 text-xs font-black text-muted uppercase tracking-wider">
                      Passage-Based Question Group
                    </div>

                    <div className="p-4 space-y-6">
                      <aside className="rounded-xl border border-line bg-paper p-4">
                        {passage.title && (
                          <h3 className="text-sm font-black text-ink">{passage.title}</h3>
                        )}
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                          {passage.body}
                        </p>
                      </aside>

                      <div className="space-y-6 divide-y divide-line/60">
                        {questions.map(({ question: q, originalIndex }, subIdx) => {
                          const outcome = q.score_item?.outcome;
                          const selected = selectedAnswerKey(
                            q.response?.selected_answer ?? q.score_item?.selected_answer
                          );
                          const correct = selectedAnswerKey(
                            q.question_version.correct_answer ?? q.score_item?.correct_answer
                          );
                          const timeSpent = q.score_item?.time_spent_seconds ?? 0;

                          return (
                            <div id={`q-${q.id}`} key={q.id} className={subIdx > 0 ? "pt-6" : ""}>
                              <div className="flex flex-wrap items-center justify-between gap-3 bg-paper/50 rounded-xl border border-line/50 px-3.5 py-2 mb-4">
                                <div className="flex items-center gap-2">
                                  {q.question_format?.question_family === "mains_subjective" ? (
                                    !q.response ? (
                                      <span className="rounded-full border border-slate-205 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-655">
                                        — Not Submitted
                                      </span>
                                    ) : (
                                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${
                                        (q.response as any).evaluation_status === 'evaluated'
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                          : (q.response as any).evaluation_status === 'ai_evaluating'
                                          ? "border-blue-200 bg-blue-50 text-blue-700"
                                          : "border-amber-250 bg-amber-50 text-amber-700"
                                      }`}>
                                        {(q.response as any).evaluation_status === 'evaluated'
                                          ? "✓ Evaluated"
                                          : (q.response as any).evaluation_status === 'ai_evaluating'
                                          ? "⚙ AI Evaluating..."
                                          : "🕒 Under Review"}
                                      </span>
                                    )
                                  ) : (
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${outcomeClass(outcome)}`}>
                                      {outcomeLabel(outcome)}
                                    </span>
                                  )}
                                  <span className="text-xs font-semibold text-muted">
                                    Q{originalIndex + 1}
                                  </span>
                                  {q.question_version.created_by_user_id && (
                                    <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-700" title="This is a private question added by you. WayToIAS does not take responsibility for its correctness.">
                                      ⚠️ Your Question
                                    </span>
                                  )}
                                  {timeSpent > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] text-muted">
                                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                                      {Math.round(Number(timeSpent))}s
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => toggleBookmark(q.id, q.question_version.id)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                                      bookmarkedIds.has(q.id)
                                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/50"
                                        : "border-slate-200 bg-white text-slate-650 hover:bg-slate-50 hover:text-slate-800"
                                    }`}
                                    title={bookmarkedIds.has(q.id) ? "Remove Bookmark" : "Bookmark Question"}
                                  >
                                    <Bookmark className="h-3.5 w-3.5" fill={bookmarkedIds.has(q.id) ? "currentColor" : "none"} />
                                    <span>{bookmarkedIds.has(q.id) ? "Marked for Revision" : "Mark for Revision"}</span>
                                  </button>
                                  <span className="text-xs font-black text-ink">
                                    {formatMarks(q.score_item?.score)} pts
                                  </span>
                                </div>
                              </div>

                              <h3 className="text-sm font-bold leading-snug text-ink md:text-base">
                                {q.question_version.question_statement}
                              </h3>
                              {q.question_version.supplementary_statement && (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                                  {q.question_version.supplementary_statement}
                                </p>
                              )}
                              {q.question_version.question_prompt && (
                                <p className="mt-2 text-sm font-bold text-ink">
                                  {q.question_version.question_prompt}
                                </p>
                              )}

                              {q.question_format?.question_family === "mains_subjective" ? (
                                renderSubjectiveAnswer(q)
                              ) : (
                                q.question_version.options && Array.isArray(q.question_version.options) && (
                                  <div className="mt-4 grid gap-2">
                                    {q.question_version.options.map((option, optIndex) => {
                                      const key = optionKey(option, optIndex);
                                      const isSelected = selected === key;
                                      const isCorrect = correct === key;
                                      return (
                                        <div
                                          key={`${q.id}-${key}`}
                                          className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm leading-6 transition-colors ${
                                            isCorrect
                                              ? "border-emerald-250 bg-emerald-50 text-emerald-800"
                                              : isSelected
                                                ? "border-rose-200 bg-rose-50 text-rose-800"
                                                : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                                          }`}
                                        >
                                          <span
                                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${
                                              isCorrect
                                                ? "bg-emerald-600 text-white"
                                                : isSelected
                                                  ? "bg-rose-600 text-white"
                                                  : "bg-slate-100 text-slate-700"
                                            }`}
                                          >
                                            {key}
                                          </span>
                                          <span className="flex-1 text-slate-800">{optionText(option, optIndex)}</span>
                                          {isCorrect && (
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                                          )}
                                          {isSelected && !isCorrect && (
                                            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )
                              )}

                              {q.question_version.explanation && (
                                <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                                  <p className="flex items-center gap-2 text-xs font-black text-indigo-700">
                                    <CircleAlert className="h-3.5 w-3.5 text-indigo-650" aria-hidden="true" />
                                    Explanation
                                  </p>
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-650">
                                    {q.question_version.explanation}
                                  </p>
                                </div>
                              )}

                              <ErrorTagger questionId={q.id} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              }
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Topics ───────────────────────────────── */}
      {tab === "topics" && (
        <div className="tab-content">
          <TopicHeatmap topics={review.topic_breakdowns ?? []} />
        </div>
      )}

      {/* ── Tab: Time ─────────────────────────────────── */}
      {tab === "time" && (
        <div className="tab-content">
          <TimeChart
            questions={review.questions}
            durationMinutes={review.test_template.duration_minutes}
          />
        </div>
      )}
      </main>
    </div>
  );
}
