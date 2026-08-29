"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { authenticatedPatch, useAuth } from "../auth/auth-context";
import { formatStudyPlanItemType, type StudyPlanItem } from "../../lib/study-plans";

/**
 * The one day anyone can open before enrolling.
 *
 * `is_preview` is a per-item boolean, so nothing stopped an author flagging
 * five scattered days — or none, leaving a plan with no way to try it. This
 * makes the free sample a single explicit choice and enforces it by clearing
 * every other flag when one is picked.
 */
export function PlanFreeSamplePicker({
  items,
  onChanged
}: {
  items: StudyPlanItem[];
  onChanged: () => Promise<void> | void;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = items.filter((item) => item.is_preview);
  const currentId = current[0]?.id ?? null;

  const choose = async (nextId: number | null) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      // Clear anything already flagged, then set the chosen one. Done in this
      // order so a half-failed run leaves no sample rather than two.
      for (const item of current) {
        if (item.id !== nextId) {
          await authenticatedPatch(`/api/v1/study-plan-items/${item.id}`, token, { is_preview: false });
        }
      }
      if (nextId !== null && !current.some((item) => item.id === nextId)) {
        await authenticatedPatch(`/api/v1/study-plan-items/${nextId}`, token, { is_preview: true });
      }
      await onChanged();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update the free sample.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-md border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">Free sample</p>
          <p className="mt-0.5 text-xs font-semibold text-ink/50">
            One day anyone can open before enrolling. A plan with no sample gives a buyer nothing to try.
          </p>
        </div>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-ink/40" />}
      </div>

      {current.length > 1 && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs font-bold text-amber-800">
          {current.length} days are currently flagged as previews. Picking one below will clear the rest.
        </p>
      )}

      <div className="mt-3 grid gap-2">
        <select
          className="h-10 rounded-md border border-line bg-surface px-3 text-sm"
          value={currentId === null ? "" : String(currentId)}
          disabled={busy}
          onChange={(event) => void choose(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">No free sample</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              Week {item.week_no}, Day {item.day_no} — {item.title} ({formatStudyPlanItemType(item.item_type)})
            </option>
          ))}
        </select>
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        {currentId === null && !busy && (
          <p className="text-xs font-semibold text-ink/45">
            Nothing is open to visitors right now — the plan page will show no sample.
          </p>
        )}
      </div>
    </div>
  );
}
