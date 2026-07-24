"use client";

import { ArrowLeft, CheckCircle, ExternalLink, FileCheck2, FileEdit, FileText, Loader2, Sparkles, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authenticatedGet, authenticatedPost, useAuth } from "../../../../components/auth/auth-context";

type MainsQuestion = {
  id: number;
  question_family: string;
  status: string;
  created_at: string;
  current_version: {
    id: number;
    question_statement: string;
    supplementary_statement?: string;
    question_prompt?: string;
  };
  mains_details: {
    word_limit?: number;
    marks: string;
    directive?: string;
    model_answer?: string;
    key_points?: string[];
  };
};

type Attempt = {
  id: number;
  question_version_id: number;
  student_answer_text?: string | null;
  answer_file_url?: string | null;
  checked_copy_url?: string | null;
  evaluation_status: "pending" | "ai_evaluating" | "evaluated" | "needs_manual_review";
  score?: number;
  max_score?: number;
  feedback?: string;
  strengths?: string[];
  weaknesses?: string[];
};

export default function StudentMainsPracticePage() {
  const { id } = useParams();
  const router = useRouter();
  const { token, isInitialized, user } = useAuth();

  const [question, setQuestion] = useState<MainsQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [answerFileUrl, setAnswerFileUrl] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load question details and route accordingly
  useEffect(() => {
    const loadQuestionAndRoute = async () => {
      if (!token || !id) return;
      try {
        const data = await authenticatedGet<MainsQuestion>(`/api/v1/assessment/mains/questions/${id}`, token);
        setQuestion(data);
        if (data?.current_version?.id) {
          const attempts = await authenticatedGet<any[]>(
            `/api/v1/assessment/mains/my-answers?question_version_id=${data.current_version.id}`,
            token
          );
          const firstAttempt = attempts?.[0];
          if (firstAttempt) {
            if (firstAttempt.result_id) {
              router.replace(`/assessment/results/${firstAttempt.result_id}`);
              return;
            } else if (firstAttempt.attempt_id) {
              router.replace(`/assessment/attempts/${firstAttempt.attempt_id}`);
              return;
            } else {
              // Legacy data without standard attempt link - render inline
              setAttempt(firstAttempt);
              setStudentAnswer(firstAttempt.student_answer_text ?? "");
              setAnswerFileUrl(firstAttempt.answer_file_url ?? "");
              setLoading(false);
            }
          } else {
            // No prior attempt: automatically start a practice attempt and redirect to Attempt Engine
            try {
              const newAttempt = await authenticatedPost<{ id: number }>(
                "/api/v1/assessment/attempts/mains-question",
                token,
                { question_id: Number(id) }
              );
              router.replace(`/assessment/attempts/${newAttempt.id}`);
            } catch (err) {
              console.error("Failed to auto-start mains practice attempt:", err);
              // Fallback to let them attempt here if API failed
              setLoading(false);
            }
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load question details", err);
        setLoading(false);
      }
    };
    if (isInitialized) {
      void loadQuestionAndRoute();
    }
  }, [id, token, isInitialized, router]);

  // Submit student response to DB
  const handleSubmission = async () => {
    if (!token || !question) return;
    if (!studentAnswer.trim() && !answerFileUrl.trim()) {
      alert("Please write your answer or provide an answer copy link before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        question_version_id: question.current_version.id,
        student_answer_text: studentAnswer.trim() || undefined,
        answer_file_url: answerFileUrl.trim() || undefined
      };
      const data = await authenticatedPost<Attempt>("/api/v1/assessment/mains/answers", token, payload);
      setAttempt(data);
      alert("Your answer copy has been submitted for evaluator review.");
    } catch (err) {
      console.error(err);
      alert("Failed to submit response.");
    } finally {
      setSubmitting(false);
    }
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 text-civic animate-spin" />
        <span className="text-sm font-semibold text-ink/66">Loading answering canvas...</span>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center mt-12 border border-line rounded-2xl bg-surface space-y-4">
        <AlertCircle className="h-10 w-10 text-berry mx-auto" />
        <h2 className="text-lg font-black text-ink">Question Not Found</h2>
        <p className="text-sm text-ink/65">This subjective practice question does not exist or has been archived.</p>
        <Link href="/assessment/mains" className="inline-block px-4 py-2 bg-civic text-white text-xs font-bold rounded-lg">
          Back to list
        </Link>
      </div>
    );
  }

  const wordCount = getWordCount(studentAnswer);
  const limit = question.mains_details?.word_limit || 250;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-6 animate-in fade-in duration-300">
      
      {/* Header Link */}
      <div className="flex items-center gap-3">
        <Link
          href="/assessment/mains"
          className="h-10 w-10 grid place-items-center rounded-xl border border-line bg-surface hover:bg-paper transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <span className="text-[10px] font-bold text-civic uppercase tracking-wider">Mains subjective sheet</span>
          <h1 className="text-xl font-black text-ink leading-tight">Answering Canvas</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        
        {/* Left Column: Question statement and answer sheet */}
        <div className="space-y-6">
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
              <span className="px-2 py-0.5 rounded bg-civic/10 text-civic text-[10px] font-extrabold uppercase">
                {question.mains_details?.directive || "Discuss"}
              </span>
              <span className="text-xs font-bold text-ink/50">
                {question.mains_details?.marks || "15"} Marks
              </span>
              <span className="text-xs font-bold text-ink/50 border-l border-line pl-2">
                Limit: {limit} Words
              </span>
            </div>

            <h2 className="text-base font-extrabold text-ink leading-relaxed">
              {question.current_version.question_statement}
            </h2>

            {question.current_version.supplementary_statement && (
              <div className="p-3 bg-paper/30 border border-line rounded-lg text-xs leading-relaxed text-ink/65 italic">
                {question.current_version.supplementary_statement}
              </div>
            )}

            {question.current_version.question_prompt && (
              <div className="p-3 bg-indigo-50/20 border border-indigo-100 rounded-lg text-xs font-bold leading-relaxed text-indigo-900">
                {question.current_version.question_prompt}
              </div>
            )}
          </div>

          {/* Answering block */}
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <FileEdit className="h-4 w-4 text-civic" />
                Write Your Answer Response
              </label>
              <span className={`text-xs font-bold ${wordCount > limit ? "text-berry" : "text-civic"}`}>
                {wordCount} / {limit} Words
              </span>
            </div>

            <textarea
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
              disabled={attempt !== null}
              placeholder="Structure your introduction, elaborate details using subheadings, and wrap up with a forward-looking conclusion..."
              className="w-full min-h-[320px] p-4 rounded-xl border border-line text-sm outline-none focus:border-civic text-ink focus:ring-2 focus:ring-civic/10 transition-all font-sans disabled:opacity-75 disabled:bg-paper/35 resize-y"
            />

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-civic" />
                Answer Copy URL
              </span>
              <input
                type="url"
                value={answerFileUrl}
                onChange={(e) => setAnswerFileUrl(e.target.value)}
                disabled={attempt !== null}
                placeholder="Paste uploaded PDF, image, or document link"
                className="h-11 w-full rounded-xl border border-line px-3 text-sm font-semibold text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/10 disabled:opacity-75 disabled:bg-paper/35"
              />
              <span className="block text-[11px] font-semibold text-ink/50">Use this when the student answer is written on a separate sheet or scanned copy.</span>
            </label>

            {/* Actions */}
            {!attempt ? (
              <button
                onClick={handleSubmission}
                disabled={submitting || (!studentAnswer.trim() && !answerFileUrl.trim())}
                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-civic text-white font-bold text-sm shadow-md hover:bg-civic/90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Submit Answer Sheet
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-250 text-emerald-700 text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  Your answer sheet has been submitted and locked for evaluator checking.
                </div>
                {attempt.answer_file_url && (
                  <a
                    href={attempt.answer_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-civic/20 bg-civic/5 px-3 py-2 text-xs font-black text-civic hover:bg-civic/10"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open submitted answer copy
                  </a>
                )}

                {attempt.evaluation_status === "pending" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-bold text-amber-700">
                    Evaluation is pending. Marks and checked copy will appear here after evaluator review.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Feedback details & Model Answer comparisons */}
        <div className="space-y-6">
          
          {/* Evaluation output results */}
          {attempt && attempt.evaluation_status === "evaluated" && (
            <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-line/60 pb-4">
                <div>
                  <h3 className="font-black text-base text-ink flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-civic" />
                    Evaluation Score Card
                  </h3>
                  <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Checked by evaluator</span>
                </div>
                
                <div className="text-right">
                  <span className="text-3xl font-black text-civic">
                    {attempt.score}
                    <span className="text-sm text-ink/40 font-bold">/{attempt.max_score}</span>
                  </span>
                  <span className="block text-[9px] font-extrabold uppercase tracking-wide text-ink/60 mt-0.5">Marks Granted</span>
                </div>
              </div>

              {attempt.checked_copy_url && (
                <a
                  href={attempt.checked_copy_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-civic/20 bg-civic/5 px-3 py-2 text-xs font-black text-civic hover:bg-civic/10"
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Open checked copy
                </a>
              )}

              {/* Strengths & Weaknesses checklists */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                  <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wide">Key Strengths</h4>
                  {attempt.strengths && attempt.strengths.length > 0 ? (
                    <ul className="list-disc list-inside text-[11px] text-emerald-700 space-y-1 leading-relaxed">
                      {attempt.strengths.map((str, i) => (
                        <li key={i}>{str}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-emerald-600">Great structural layout maintained.</p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 space-y-2">
                  <h4 className="text-xs font-black text-rose-800 uppercase tracking-wide">Areas of Improvement</h4>
                  {attempt.weaknesses && attempt.weaknesses.length > 0 ? (
                    <ul className="list-disc list-inside text-[11px] text-rose-700 space-y-1 leading-relaxed">
                      {attempt.weaknesses.map((weak, i) => (
                        <li key={i}>{weak}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-rose-600">Consider linking more committees/citations.</p>
                  )}
                </div>
              </div>

              {/* Detailed html feedback block */}
              {attempt.feedback && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-ink uppercase tracking-wide border-b border-line pb-1.5">Detailed Feedback Report</h4>
                  <div
                    dangerouslySetInnerHTML={{ __html: attempt.feedback }}
                    className="prose prose-sm text-xs leading-relaxed text-ink/75 space-y-3 prose-h3:font-black prose-h3:text-ink prose-h3:mt-3 prose-p:my-1.5 prose-strong:text-ink"
                  />
                </div>
              )}
            </div>
          )}

          {/* Model Answer Panel */}
          {question.mains_details?.model_answer && (
            <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-4">
              <div className="border-b border-line pb-3">
                <h3 className="font-black text-base text-ink">UPSC Reference Model Answer</h3>
                <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Use this as an ideal framework blueprint</span>
              </div>

              <div className="prose prose-sm max-h-[300px] overflow-y-auto pr-2 text-xs leading-relaxed text-ink/75 bg-paper/30 p-4 rounded-xl space-y-3 whitespace-pre-line font-sans border border-line/60">
                {question.mains_details.model_answer}
              </div>

              {question.mains_details.key_points && question.mains_details.key_points.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-ink block">Must-Include Keypoints Checklist:</span>
                  <div className="flex flex-wrap gap-2">
                    {question.mains_details.key_points.map((pt, i) => (
                      <span key={i} className="text-[10px] font-semibold text-civic bg-civic/5 border border-civic/10 px-2 py-1 rounded-lg">
                        ✓ {pt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
