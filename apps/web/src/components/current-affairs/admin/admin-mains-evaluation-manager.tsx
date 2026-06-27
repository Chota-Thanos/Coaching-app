"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, ClipboardCheck, ExternalLink, FileCheck2, Loader2, RefreshCw, Save, UserRound } from "lucide-react";
import { authenticatedGet, authenticatedPatch, useAuth } from "../../auth/auth-context";

type EvaluationStatus = "pending" | "ai_evaluating" | "evaluated" | "needs_manual_review";
type QueueStatus = EvaluationStatus | "all";

type MainsEvaluationAttempt = {
  id: number;
  user_id: number;
  student_email?: string | null;
  student_username?: string | null;
  question_statement: string;
  question_prompt?: string | null;
  supplementary_statement?: string | null;
  student_answer_text?: string | null;
  answer_file_url?: string | null;
  checked_copy_url?: string | null;
  evaluation_status: EvaluationStatus;
  score?: number | string | null;
  max_score?: number | string | null;
  feedback?: string | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  submitted_at?: string;
  evaluated_at?: string | null;
  word_limit?: number | string | null;
  question_marks?: number | string | null;
  directive?: string | null;
  model_answer?: string | null;
  paper_name?: string | null;
  subject_area_name?: string | null;
  theme_name?: string | null;
  topic_name?: string | null;
  subtopic_name?: string | null;
};

type EvaluationDraft = {
  score: string;
  max_score: string;
  feedback: string;
  checked_copy_url: string;
  strengths: string;
  weaknesses: string;
};

const STATUS_OPTIONS: Array<{ value: QueueStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "needs_manual_review", label: "Needs review" },
  { value: "evaluated", label: "Evaluated" },
  { value: "all", label: "All" }
];

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function toTextList(value: string[] | null | undefined): string {
  return Array.isArray(value) ? value.join("\n") : "";
}

function formatDate(value?: string | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function taxonomyLabel(attempt: MainsEvaluationAttempt): string {
  return [
    attempt.paper_name,
    attempt.subject_area_name,
    attempt.theme_name,
    attempt.topic_name,
    attempt.subtopic_name
  ].filter(Boolean).join(" / ") || "Mains taxonomy not mapped";
}

function statusClasses(status: EvaluationStatus): string {
  if (status === "evaluated") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "needs_manual_review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "ai_evaluating") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-civic/20 bg-civic/10 text-civic";
}

function statusLabel(status: EvaluationStatus): string {
  if (status === "needs_manual_review") return "Needs manual review";
  if (status === "ai_evaluating") return "AI evaluating";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function Field({
  label,
  reference,
  children
}: {
  label: string;
  reference: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-black uppercase tracking-wide text-ink/65">{label}</span>
      {children}
      <span className="block text-[11px] font-semibold leading-relaxed text-ink/50">{reference}</span>
    </label>
  );
}

export function AdminMainsEvaluationManager() {
  const { token } = useAuth();
  const [status, setStatus] = useState<QueueStatus>("pending");
  const [attempts, setAttempts] = useState<MainsEvaluationAttempt[]>([]);
  const [drafts, setDrafts] = useState<Record<number, EvaluationDraft>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const counts = useMemo(() => {
    return attempts.reduce(
      (acc, attempt) => {
        acc[attempt.evaluation_status] += 1;
        return acc;
      },
      { pending: 0, ai_evaluating: 0, evaluated: 0, needs_manual_review: 0 } as Record<EvaluationStatus, number>
    );
  }, [attempts]);

  const loadQueue = async () => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const rows = await authenticatedGet<MainsEvaluationAttempt[]>(
        `/api/v1/assessment/mains/evaluation-queue?status=${status}&limit=100`,
        token
      );
      setAttempts(rows || []);
      const nextDrafts: Record<number, EvaluationDraft> = {};
      for (const row of rows || []) {
        nextDrafts[row.id] = {
          score: row.score == null ? "" : String(row.score),
          max_score: row.max_score == null ? String(row.question_marks ?? "") : String(row.max_score),
          feedback: row.feedback ?? "",
          checked_copy_url: row.checked_copy_url ?? "",
          strengths: toTextList(row.strengths),
          weaknesses: toTextList(row.weaknesses)
        };
      }
      setDrafts(nextDrafts);
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Could not load Mains evaluation queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token]);

  const updateDraft = (id: number, key: keyof EvaluationDraft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? { score: "", max_score: "", feedback: "", checked_copy_url: "", strengths: "", weaknesses: "" }),
        [key]: value
      }
    }));
  };

  const saveEvaluation = async (attempt: MainsEvaluationAttempt) => {
    if (!token) return;
    const draft = drafts[attempt.id];
    if (!draft) return;

    const score = Number(draft.score);
    const maxScore = Number(draft.max_score);
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
      setMessage("Enter valid score and max marks before saving.");
      return;
    }
    if (score > maxScore) {
      setMessage("Score cannot be greater than max marks.");
      return;
    }

    setSavingId(attempt.id);
    setMessage(null);
    try {
      const payload = {
        score,
        max_score: maxScore,
        feedback: draft.feedback.trim() || undefined,
        checked_copy_url: draft.checked_copy_url.trim() || undefined,
        strengths: splitLines(draft.strengths),
        weaknesses: splitLines(draft.weaknesses)
      };
      const saved = await authenticatedPatch<MainsEvaluationAttempt>(
        `/api/v1/assessment/mains/answers/${attempt.id}/evaluation`,
        token,
        payload
      );
      setAttempts((current) => current.map((item) => (item.id === attempt.id ? { ...item, ...saved } : item)));
      setDrafts((current) => ({
        ...current,
        [attempt.id]: {
          score: saved.score == null ? String(score) : String(saved.score),
          max_score: saved.max_score == null ? String(maxScore) : String(saved.max_score),
          feedback: saved.feedback ?? draft.feedback,
          checked_copy_url: saved.checked_copy_url ?? draft.checked_copy_url,
          strengths: toTextList(saved.strengths) || draft.strengths,
          weaknesses: toTextList(saved.weaknesses) || draft.weaknesses
        }
      }));
      setMessage("Evaluation saved.");
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Could not save evaluation.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-civic">Manual Evaluation</span>
            <h2 className="mt-1 text-2xl font-black text-ink">Mains Answer Copies</h2>
            <p className="mt-1 text-sm font-semibold text-ink/60">
              Review written answers, assign marks, add feedback, and attach the checked copy.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as QueueStatus)}
              className="h-10 rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-civic"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadQueue()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-civic hover:text-civic disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Pending", value: counts.pending },
            { label: "Needs Review", value: counts.needs_manual_review },
            { label: "AI Running", value: counts.ai_evaluating },
            { label: "Evaluated", value: counts.evaluated }
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-line bg-paper/40 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-ink/45">{item.label}</p>
              <p className="mt-1 text-2xl font-black text-ink">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-civic/20 bg-civic/10 px-4 py-3 text-sm font-bold text-civic">
          {message}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-civic" />
          <p className="mt-3 text-sm font-bold text-ink/55">Loading submitted answer copies...</p>
        </div>
      ) : attempts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center shadow-sm">
          <ClipboardCheck className="mx-auto h-9 w-9 text-ink/30" />
          <h3 className="mt-3 text-base font-black text-ink">No answer copies found</h3>
          <p className="mt-1 text-sm font-semibold text-ink/55">Change the status filter or wait for students to submit written answers.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => {
            const draft = drafts[attempt.id] ?? {
              score: "",
              max_score: String(attempt.question_marks ?? ""),
              feedback: "",
              checked_copy_url: "",
              strengths: "",
              weaknesses: ""
            };
            return (
              <article key={attempt.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${statusClasses(attempt.evaluation_status)}`}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {statusLabel(attempt.evaluation_status)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-bold text-ink/65">
                        <UserRound className="h-3.5 w-3.5" />
                        {attempt.student_email || attempt.student_username || `Student #${attempt.user_id}`}
                      </span>
                      <span className="text-[11px] font-bold text-ink/45">Submitted {formatDate(attempt.submitted_at)}</span>
                    </div>

                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-civic">{taxonomyLabel(attempt)}</p>
                      <h3 className="mt-1 text-base font-black leading-relaxed text-ink">{attempt.question_statement}</h3>
                      {attempt.supplementary_statement && (
                        <p className="mt-2 rounded-lg border border-line bg-paper/45 p-3 text-xs font-semibold leading-relaxed text-ink/65">
                          {attempt.supplementary_statement}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] font-bold text-ink/55">
                      <span>{(attempt.question_marks ?? draft.max_score) || "No"} marks</span>
                      <span>|</span>
                      <span>{attempt.word_limit ?? "No"} word limit</span>
                      {attempt.directive && (
                        <>
                          <span>|</span>
                          <span>{attempt.directive}</span>
                        </>
                      )}
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

                    {attempt.student_answer_text && (
                      <div className="max-h-56 overflow-y-auto rounded-xl border border-line bg-paper/35 p-4 text-sm font-semibold leading-relaxed text-ink/75 whitespace-pre-wrap">
                        {attempt.student_answer_text}
                      </div>
                    )}
                  </div>

                  <div className="w-full shrink-0 space-y-3 xl:w-[420px]">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Marks awarded" reference="Evaluator score for this written answer.">
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={draft.score}
                          onChange={(event) => updateDraft(attempt.id, "score", event.target.value)}
                          className="h-10 w-full rounded-xl border border-line px-3 text-sm font-bold text-ink outline-none focus:border-civic"
                        />
                      </Field>
                      <Field label="Max marks" reference="Question total marks.">
                        <input
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={draft.max_score}
                          onChange={(event) => updateDraft(attempt.id, "max_score", event.target.value)}
                          className="h-10 w-full rounded-xl border border-line px-3 text-sm font-bold text-ink outline-none focus:border-civic"
                        />
                      </Field>
                    </div>

                    <Field label="Checked copy URL" reference="Link to evaluated PDF, image, or document returned to the student.">
                      <input
                        type="url"
                        value={draft.checked_copy_url}
                        onChange={(event) => updateDraft(attempt.id, "checked_copy_url", event.target.value)}
                        placeholder="https://..."
                        className="h-10 w-full rounded-xl border border-line px-3 text-sm font-semibold text-ink outline-none focus:border-civic"
                      />
                    </Field>

                    <Field label="Evaluator feedback" reference="Visible comments for the student's answer copy.">
                      <textarea
                        value={draft.feedback}
                        onChange={(event) => updateDraft(attempt.id, "feedback", event.target.value)}
                        rows={4}
                        className="w-full resize-y rounded-xl border border-line p-3 text-sm font-semibold leading-relaxed text-ink outline-none focus:border-civic"
                      />
                    </Field>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Strengths" reference="One point per line.">
                        <textarea
                          value={draft.strengths}
                          onChange={(event) => updateDraft(attempt.id, "strengths", event.target.value)}
                          rows={3}
                          className="w-full resize-y rounded-xl border border-line p-3 text-xs font-semibold leading-relaxed text-ink outline-none focus:border-civic"
                        />
                      </Field>
                      <Field label="Weaknesses" reference="One point per line.">
                        <textarea
                          value={draft.weaknesses}
                          onChange={(event) => updateDraft(attempt.id, "weaknesses", event.target.value)}
                          rows={3}
                          className="w-full resize-y rounded-xl border border-line p-3 text-xs font-semibold leading-relaxed text-ink outline-none focus:border-civic"
                        />
                      </Field>
                    </div>

                    {attempt.checked_copy_url && (
                      <a
                        href={attempt.checked_copy_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-black text-civic hover:underline"
                      >
                        <FileCheck2 className="h-3.5 w-3.5" />
                        Open saved checked copy
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => void saveEvaluation(attempt)}
                      disabled={savingId === attempt.id}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-civic px-4 text-sm font-black text-white shadow-sm transition hover:bg-civic/90 disabled:opacity-60"
                    >
                      {savingId === attempt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Evaluation
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
