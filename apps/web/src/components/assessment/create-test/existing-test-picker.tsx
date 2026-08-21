"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Layers, Loader2, Plus } from "lucide-react";
import { authenticatedGet, useAuth } from "../../auth/auth-context";
import type { ContentType } from "./category-picker";

export type CategoryBreakdown = {
  subject_node_id: number;
  subject_name: string;
  topic_node_id: number;
  topic_name: string;
  question_count: number;
};

export type ExistingTest = {
  id: number;
  title: string;
  test_type: string;
  duration_minutes: number;
  total_marks: number;
  question_count: number;
  created_at: string;
  category_breakdown?: CategoryBreakdown[];
};

export function CategoryBreakdownList({ breakdown }: { breakdown?: CategoryBreakdown[] }) {
  if (!breakdown || breakdown.length === 0) {
    return <p className="text-xs italic text-slate-400">No category data available.</p>;
  }
  return (
    <div className="space-y-2.5">
      {breakdown.map((cat, idx) => (
        <div key={idx} className="flex items-start justify-between gap-3 border-b border-slate-50 pb-2 text-xs last:border-0 last:pb-0">
          <div>
            <div className="font-extrabold text-slate-800">{cat.subject_name}</div>
            {cat.topic_name && (
              <div className="mt-0.5 flex items-center gap-0.5 text-[10px] font-medium text-slate-400">
                <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
                {cat.topic_name}
              </div>
            )}
          </div>
          <span className="inline-flex h-5 shrink-0 items-center rounded-md border border-indigo-100/50 bg-indigo-50 px-2 text-[10px] font-black text-indigo-700">
            {cat.question_count} Qs
          </span>
        </div>
      ))}
    </div>
  );
}

export function ExistingTestPicker({
  contentType,
  examId,
  selectedTestId,
  onSelect
}: {
  contentType: ContentType;
  examId: number | null;
  selectedTestId: number | null;
  onSelect: (test: ExistingTest) => void;
}) {
  const { token } = useAuth();
  const [tests, setTests] = useState<ExistingTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setTests([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await authenticatedGet<ExistingTest[]>(
          `/api/v1/assessment/test-templates?access_type=private&content_type=${contentType}&limit=100`,
          token
        );
        if (cancelled) return;
        const withBreakdown = await Promise.all(
          (list || []).slice(0, 30).map(async (t) => {
            try {
              const detail = await authenticatedGet<ExistingTest>(`/api/v1/assessment/test-templates/${t.id}`, token);
              return { ...t, category_breakdown: detail.category_breakdown };
            } catch {
              return t;
            }
          })
        );
        if (!cancelled) setTests(withBreakdown);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Could not load your tests.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentType, token]);

  if (!token) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-6 text-center text-sm font-semibold text-slate-500">
        Sign in to add questions to your saved tests.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-surface p-8 text-sm font-semibold text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading your tests…
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>;
  }

  if (tests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-6 text-center text-sm font-semibold text-slate-500">
        You don&apos;t have any {contentType === "mains" ? "Mains" : contentType === "aptitude" ? "CSAT" : "GS"} tests yet — create a new one instead.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {tests.map((test) => {
        const isSelected = selectedTestId === test.id;
        return (
          <li
            key={test.id}
            className={`rounded-2xl border p-4 transition ${isSelected ? "border-indigo-600 bg-indigo-50/40" : "border-slate-200 bg-surface"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{test.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <Layers className="h-3 w-3" aria-hidden="true" />
                  {test.question_count} question{test.question_count === 1 ? "" : "s"} · {test.duration_minutes} min
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelect(test)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  isSelected
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 bg-surface text-slate-700 hover:border-indigo-600 hover:text-indigo-600"
                }`}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {isSelected ? "Selected" : "Add Questions"}
              </button>
            </div>
            {test.category_breakdown && test.category_breakdown.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <CategoryBreakdownList breakdown={test.category_breakdown} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
