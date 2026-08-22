"use client";

// The default landing content for /assessment/gk, /csat, /mains-hub —
// browse the syllabus (subjects → sources → topics) with the same visual
// language as the create-test wizard's picker, and start an instant
// single-category practice test straight from a leaf row. This is the
// restyled replacement for assessment-home.tsx's old quick-start browser
// (which is no longer reachable from anywhere), not a step of test
// creation — no basket, no title, just "pick a topic, start now".

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authenticatedGet, authenticatedPost, useAuth } from "../auth/auth-context";
import { CategoryPicker, type ContentType } from "./create-test/category-picker";

type Exam = { id: number; name: string; slug: string };

export function CategoryBrowseView({ contentType }: { contentType: ContentType }) {
  const router = useRouter();
  const { token, isInitialized } = useAuth();
  const [examId, setExamId] = useState<number | null>(null);
  const [quickStarting, setQuickStarting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    authenticatedGet<Exam[]>("/api/v1/assessment/exams", token || "")
      .then((data) => {
        if (data && data[0]) setExamId(data[0].id);
      })
      .catch(() => {});
  }, [isInitialized, token]);

  async function handleQuickStart(node: { id: number; name: string }, available: number) {
    if (!token) {
      setError("Please sign in to start a practice test.");
      return;
    }
    if (!examId || available <= 0) return;
    setQuickStarting(node.id);
    setError(null);
    try {
      const questionFamily = contentType === "mains" ? "mains_subjective" : "objective";
      const attempt = await authenticatedPost<any>("/api/v1/assessment/attempts/dynamic", token, {
        exam_id: examId,
        subject_node_id: node.id,
        question_count: Math.min(available, 50),
        test_type: contentType === "mains" ? "sectional_test" : "quick_test",
        question_family: questionFamily
      });
      router.push(`/assessment/attempts/${attempt.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to start this category test.");
      setQuickStarting(null);
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
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
      )}
      <CategoryPicker
        contentType={contentType}
        examId={examId}
        questionFamily={contentType === "mains" ? "mains_subjective" : "objective"}
        remainingCapacity={0}
        basket={[]}
        onBasketChange={() => {}}
        onQuickStart={handleQuickStart}
        quickStarting={quickStarting}
      />
    </div>
  );
}
