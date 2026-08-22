"use client";

// The default landing content for /assessment/gk, /csat, /mains-hub —
// browse the syllabus (subjects → sources → topics) with the same visual
// language as the create-test wizard's picker, and start a practice test
// straight from a leaf row. This is the restyled replacement for
// assessment-home.tsx's old quick-start browser (which is no longer
// reachable from anywhere), not a step of test creation — no basket, just
// "pick a topic, name it, choose how many, start now".
//
// Starting the test goes through the same createUserCustomTest +
// attempts/start mechanism the create-test wizard uses (resolved
// server-side via resolveCategoriesToQuestions, which walks the full
// descendant tree from whatever node id it's given) rather than
// /attempts/dynamic — that endpoint does an exact match on
// qtl.subject_node_id and has no field for the Source level at all, so it
// only ever worked for a leaf that happened to be a top-level subject.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { authenticatedGet, guestAwarePost, useAuth } from "../auth/auth-context";
import { getOrCreateGuestToken } from "../../lib/guest";
import { useSubscription } from "../../lib/use-subscription";
import { getQuestionCap, GUEST_QUESTION_CAP } from "./create-test/tier-caps";
import { CategoryPicker, type ContentType } from "./create-test/category-picker";

type Exam = { id: number; name: string; slug: string };
type StartTarget = { id: number; name: string; available: number };

export function CategoryBrowseView({ contentType }: { contentType: ContentType }) {
  const router = useRouter();
  const { token, isInitialized } = useAuth();
  const { hasEntitlement } = useSubscription(token);
  const isPremium = hasEntitlement("assessment.premium_tests");
  const isMains = contentType === "mains";
  const tierCap = !token ? GUEST_QUESTION_CAP : getQuestionCap(isPremium, isMains);

  const [examId, setExamId] = useState<number | null>(null);
  const [startTarget, setStartTarget] = useState<StartTarget | null>(null);
  const [startTitle, setStartTitle] = useState("");
  const [startCount, setStartCount] = useState(1);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    authenticatedGet<Exam[]>("/api/v1/assessment/exams", token || "")
      .then((data) => {
        if (data && data[0]) setExamId(data[0].id);
      })
      .catch(() => {});
  }, [isInitialized, token]);

  function openStartModal(node: { id: number; name: string }, available: number) {
    setError(null);
    setStartTarget({ id: node.id, name: node.name, available });
    setStartTitle(`${node.name} Practice`);
    setStartCount(Math.max(1, Math.min(available, tierCap)));
  }

  async function handleConfirmStart() {
    if (!startTarget || !examId) return;
    const questionFamily = isMains ? "mains_subjective" : "objective";
    const clampedCount = Math.max(1, Math.min(startCount, startTarget.available, tierCap));

    setStarting(true);
    setError(null);
    try {
      const guestToken = token ? null : getOrCreateGuestToken();
      const created = await guestAwarePost<{ id: number }>(
        "/api/v1/assessment/user/custom-tests",
        token,
        guestToken,
        {
          title: startTitle.trim() || `${startTarget.name} Practice`,
          exam_id: examId,
          content_type: contentType,
          categories: [{ subject_node_id: startTarget.id, question_count: clampedCount, question_family: questionFamily }],
          test_type: isMains ? "mains_test" : "sectional_test"
        }
      );
      const attempt = await guestAwarePost<any>(
        `/api/v1/assessment/test-templates/${created.id}/attempts/start`,
        token,
        guestToken,
        {}
      );
      router.push(`/assessment/attempts/${attempt.id ?? attempt}`);
    } catch (err: any) {
      setError(err?.message || "Failed to start this test.");
      setStarting(false);
    }
  }

  if (!examId) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-surface p-8 text-sm font-semibold text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading syllabus…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && !startTarget && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
      )}
      <CategoryPicker
        contentType={contentType}
        examId={examId}
        questionFamily={contentType === "mains" ? "mains_subjective" : "objective"}
        remainingCapacity={0}
        basket={[]}
        onBasketChange={() => {}}
        onQuickStart={openStartModal}
        quickStarting={null}
      />

      {startTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-black text-slate-900">Start test</h3>
              <button type="button" onClick={() => setStartTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <label className="mt-4 block text-xs font-bold text-slate-600">
              Test name
              <input
                autoFocus
                type="text"
                value={startTitle}
                onChange={(e) => setStartTitle(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-surface px-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition"
              />
            </label>

            <label className="mt-4 block text-xs font-bold text-slate-600">
              Number of questions
              <input
                type="number"
                min={1}
                max={Math.min(startTarget.available, tierCap)}
                value={startCount}
                onChange={(e) => setStartCount(Number(e.target.value) || 1)}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-surface px-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition"
              />
              <span className="mt-1.5 block text-[11px] font-semibold text-slate-500">
                {startTarget.available} available · max {tierCap} per test{!token ? " for guests" : !isPremium ? " on the free tier" : ""}.
                {startCount > Math.min(startTarget.available, tierCap) && " The maximum will be used instead."}
              </span>
            </label>

            {error && <p className="mt-3 text-xs font-semibold text-rose-700">{error}</p>}

            <button
              type="button"
              disabled={starting}
              onClick={handleConfirmStart}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting ? <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" /> : null}
              {starting ? "Starting…" : "Start Test"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
