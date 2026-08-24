"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, authenticatedPost, useAuth } from "../components/auth/auth-context";

/**
 * One category to pull questions from, matching
 * apps/api/src/modules/assessment/schemas.ts's compiledCategorySchema.
 * subject_node_id is the only required field — everything else narrows it.
 */
export type StartTestCategory = {
  subject_node_id: number;
  source_node_id?: number | null;
  topic_node_id?: number | null;
  subtopic_node_id?: number | null;
  question_nature_id?: number | null;
  question_count: number;
  question_family?: "objective" | "mains_subjective";
  is_user_private?: boolean | null;
};

/**
 * Starts a real attempt and redirects straight into it — no wizard screen.
 *
 * Always goes through POST /attempts/compiled rather than /attempts/dynamic,
 * even for a single category: /attempts/dynamic only matches questions tagged
 * with the EXACT node id given (no rollup), so it cannot correctly scope a
 * "start on this source/book" request — the compiled endpoint's recursive
 * descendant walk handles subject, source, topic, and subtopic scoping
 * uniformly, so one code path covers every "Start" button in the app instead
 * of needing a second one for the combined-topics case.
 *
 * This mirrors the create-then-redirect pattern already shipping in
 * assessment-home.tsx (POST /attempts/dynamic there, but the same shape) —
 * every Start button built on this hook calls an endpoint proven in
 * production, not a param the destination screen silently ignores.
 */
export function useStartTest() {
  const { token } = useAuth();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const start = useCallback(
    async (
      examId: number,
      categories: StartTestCategory[],
      options?: { testType?: "quick_test" | "sectional_test" | "full_length_test" | "pyq_test" | "diagnostic_test"; title?: string; includeAttempted?: boolean }
    ) => {
      if (!token || categories.length === 0) return;
      setStarting(true);
      setError(null);
      try {
        const attempt = await authenticatedPost<{ id: number }>("/api/v1/assessment/attempts/compiled", token, {
          exam_id: examId,
          test_type: options?.testType ?? "quick_test",
          title: options?.title,
          include_attempted: options?.includeAttempted ?? false,
          categories
        });
        router.push(`/assessment/attempts/${attempt.id}`);
      } catch (err) {
        if (err instanceof ApiError) setError(err);
        else console.error("Failed to start test", err);
      } finally {
        setStarting(false);
      }
    },
    [token, router]
  );

  return { start, starting, error, clearError: () => setError(null) };
}
