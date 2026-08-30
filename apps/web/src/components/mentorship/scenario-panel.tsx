"use client";

import type { ReactNode } from "react";

/**
 * What is happening with this request, and the one thing to do about it.
 *
 * The desk previously expressed all of this as conditionals scattered down an
 * 883-line column: a Pay button that greyed out with the reason in fine print,
 * a slot picker that appeared without explanation, and two states — `expired`
 * and `completed` — that the interface never acknowledged at all. Each state
 * now gets its own sentence in its own words, because what a student needs to
 * know changes completely between them.
 */

export type ScenarioState =
  | "requested"
  | "agenda_pending"
  | "payment_due"
  | "choose_slot"
  | "scheduled"
  | "completed"
  | "declined"
  | "expired";

export type ScenarioInput = {
  status: "requested" | "accepted" | "rejected" | "completed" | "cancelled" | "expired";
  paymentStatus: "pending" | "paid" | "refunded" | "failed";
  scheduledSlotId: number | null;
  /** True while any agenda point is still `proposed` — payment stays locked. */
  hasProposedAgenda: boolean;
  agendaCount: number;
};

/**
 * One state, derived once, rather than each control deciding for itself.
 *
 * Order matters: a finished request is finished whatever its payment says, and
 * an unpaid request cannot be at the slot step even if a slot exists.
 */
export function deriveScenario(input: ScenarioInput): ScenarioState {
  if (input.status === "completed") return "completed";
  if (input.status === "rejected" || input.status === "cancelled") return "declined";
  if (input.status === "expired") return "expired";
  if (input.status === "requested") return "requested";

  // status === "accepted" from here.
  if (input.agendaCount > 0 && input.hasProposedAgenda) return "agenda_pending";
  if (input.paymentStatus !== "paid") return "payment_due";
  if (!input.scheduledSlotId) return "choose_slot";
  return "scheduled";
}

type Tone = "wait" | "action" | "ok" | "ended";

const TONE_CLASS: Record<Tone, { chip: string; card: string }> = {
  wait: { chip: "bg-amber-100 text-amber-800 border-amber-200", card: "border-amber-200 bg-amber-50/50" },
  action: { chip: "bg-indigo-100 text-indigo-800 border-indigo-200", card: "border-indigo-200 bg-indigo-50/50" },
  ok: { chip: "bg-emerald-100 text-emerald-800 border-emerald-200", card: "border-emerald-200 bg-emerald-50/50" },
  ended: { chip: "bg-slate-100 text-slate-700 border-slate-200", card: "border-slate-200 bg-slate-50" }
};

function copyFor(
  state: ScenarioState,
  ctx: { mentorName: string; fee: string; sentAgo: string | null; slotLabel: string | null }
): { tone: Tone; chip: string; title: string; body: string; footnote?: string } {
  switch (state) {
    case "requested":
      return {
        tone: "wait",
        chip: "Waiting on mentor",
        title: `${ctx.mentorName} has your request`,
        body: `Sent ${ctx.sentAgo ?? "just now"}. Mentors usually reply within 24 hours.`,
        footnote: "Nothing is charged unless they accept and you agree the agenda."
      };
    case "agenda_pending":
      return {
        tone: "action",
        chip: "Action needed",
        title: "Agree the agenda to continue",
        body: `${ctx.mentorName} proposed what the session will cover. Payment opens once you agree it.`,
        footnote: "This is why the pay button is not available yet."
      };
    case "payment_due":
      return {
        tone: "action",
        chip: "Fee due",
        title: `Pay ${ctx.fee} to confirm`,
        body: "The agenda is agreed. Paying confirms the session and unlocks slot booking.",
        footnote: "Refunded in full if the mentor cancels or no offered time works for you."
      };
    case "choose_slot":
      return {
        tone: "action",
        chip: "Pick a time",
        title: "Choose when to meet",
        body: `${ctx.mentorName} has offered times below. Picking one books it immediately.`
      };
    case "scheduled":
      return {
        tone: "ok",
        chip: "Scheduled",
        title: ctx.slotLabel ? `Your session is ${ctx.slotLabel}` : "Your session is booked",
        body: "The join button appears ten minutes before it starts.",
        footnote: "Message your mentor beforehand if anything changes."
      };
    case "completed":
      return {
        tone: "ok",
        chip: "Completed",
        title: "Session finished",
        body: "Your notes and the agreed agenda are kept below.",
        footnote: "You can book the same mentor again from their profile."
      };
    case "declined":
      return {
        tone: "ended",
        chip: "Not taken up",
        title: `${ctx.mentorName} could not take this one`,
        body: "Nothing was charged.",
        footnote: "Other mentors cover the same areas."
      };
    case "expired":
      return {
        tone: "ended",
        chip: "Expired",
        title: "This request timed out",
        body: "The mentor did not respond in time, so it closed itself. Nothing was charged.",
        footnote: "Sending it to another mentor usually gets a faster reply."
      };
  }
}

export function MentorshipScenarioPanel({
  state,
  mentorName,
  fee,
  sentAgo,
  slotLabel,
  action
}: {
  state: ScenarioState;
  mentorName: string;
  fee: string;
  /** e.g. "2 hours ago" — omitted when unknown. */
  sentAgo?: string | null;
  /** e.g. "Thursday 4 September, 7:00 pm". */
  slotLabel?: string | null;
  /** The one primary control for this state, supplied by the page. */
  action?: ReactNode;
}) {
  const copy = copyFor(state, {
    mentorName,
    fee,
    sentAgo: sentAgo ?? null,
    slotLabel: slotLabel ?? null
  });
  const tone = TONE_CLASS[copy.tone];

  return (
    <section className={`rounded-2xl border p-5 ${tone.card}`}>
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${tone.chip}`}
      >
        {copy.chip}
      </span>
      <h2 className="mt-3 text-lg font-black leading-snug text-slate-900">{copy.title}</h2>
      <p className="mt-1.5 text-sm font-medium leading-6 text-slate-600">{copy.body}</p>
      {copy.footnote && <p className="mt-2 text-xs font-semibold text-slate-500">{copy.footnote}</p>}
      {action && <div className="mt-4 flex flex-wrap items-center gap-2">{action}</div>}
    </section>
  );
}
