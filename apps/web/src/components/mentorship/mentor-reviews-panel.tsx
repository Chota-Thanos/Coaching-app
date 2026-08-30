"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Star, EyeOff } from "lucide-react";
import { useAuth, authenticatedGet } from "../auth/auth-context";

/**
 * What students said, from the mentor's side.
 *
 * Deliberately not the public profile version. That one shows only public,
 * commented reviews; a mentor should see all of theirs, because a bare 3 with
 * no comment still tells them something, and a review the student marked
 * private still counts toward the average printed on their directory card.
 * Hiding those would make the mentor's own average look wrong to them.
 */

type Review = {
  id: number;
  rating: number;
  comment: string | null;
  is_public: boolean;
  created_at: string;
  student_name: string | null;
  session_starts_at: string | null;
};

type Summary = {
  total: number;
  average: number | string | null;
  five: number;
  four: number;
  three: number;
  two: number;
  one: number;
};

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          aria-hidden="true"
          className={n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}
          key={n}
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}

export function MentorReviewsPanel() {
  const { token } = useAuth();
  const [items, setItems] = useState<Review[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await authenticatedGet<{ items: Review[]; summary: Summary }>(
        "/api/v1/mentorship/me/reviews",
        token
      );
      setItems(data.items ?? []);
      setSummary(data.summary ?? null);
      setError(null);
    } catch {
      setError("Could not load your reviews.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-surface p-6 text-sm font-bold text-slate-500">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading your reviews...
      </div>
    );
  }

  if (error) {
    return <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p>;
  }

  // Postgres returns numeric as a string, so this is coerced rather than trusted.
  const parsed = Number(summary?.average);
  const average = Number.isFinite(parsed) ? parsed : null;
  const total = summary?.total ?? 0;

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-8 text-center">
        <Star aria-hidden="true" className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-black text-slate-800">No reviews yet</p>
        <p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-5 text-slate-500">
          A student can rate a session once it has finished. Ratings appear on your card in the mentor
          directory, so the first few matter more than the rest.
        </p>
      </div>
    );
  }

  const distribution: { label: number; count: number }[] = [
    { label: 5, count: summary?.five ?? 0 },
    { label: 4, count: summary?.four ?? 0 },
    { label: 3, count: summary?.three ?? 0 },
    { label: 2, count: summary?.two ?? 0 },
    { label: 1, count: summary?.one ?? 0 }
  ];

  return (
    <div className="space-y-5">
      {/* The number students actually see on the directory card. */}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
        <div className="text-center sm:text-left">
          <p className="font-mono text-4xl font-black leading-none tabular-nums text-slate-900">
            {average !== null ? average.toFixed(1) : "—"}
          </p>
          <div className="mt-2 flex justify-center sm:justify-start">
            <Stars value={Math.round(average ?? 0)} size={16} />
          </div>
          <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {total} {total === 1 ? "review" : "reviews"}
          </p>
        </div>

        <div className="space-y-1.5">
          {distribution.map((row) => {
            const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
            return (
              <div className="flex items-center gap-2.5" key={row.label}>
                <span className="w-3 shrink-0 font-mono text-[11px] font-bold text-slate-500">{row.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-7 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums text-slate-500">
                  {row.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5">
        {items.map((review) => (
          <article className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm" key={review.id}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Stars value={review.rating} />
              <span className="text-sm font-black text-slate-800">{review.student_name || "A student"}</span>
              <span className="font-mono text-[11px] text-slate-400">
                {new Date(review.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })}
              </span>
              {!review.is_public && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <EyeOff aria-hidden="true" className="h-3 w-3" />
                  Not shown publicly
                </span>
              )}
            </div>
            {review.comment ? (
              <p className="mt-2 text-sm leading-6 text-slate-700">{review.comment}</p>
            ) : (
              <p className="mt-2 text-xs font-semibold italic text-slate-400">Rated without a comment.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
