"use client";

import { Check, XCircle } from "lucide-react";

export type MentorshipLifecycleInput = {
  status: "requested" | "accepted" | "rejected" | "completed" | "cancelled" | "expired";
  payment_status: "pending" | "paid" | "refunded" | "failed";
  scheduled_slot_id: number | null;
  session_id?: number | null;
  mains_answer_attempt_id: number | null;
  evaluation_status?: string | null;
  meta?: { student_copy?: unknown; evaluation?: unknown } | null;
  agendas: { status: string }[];
};

const CLOSED_STATUSES = new Set(["rejected", "cancelled", "expired"]);

export function isMentorshipRequestClosed(status: string): boolean {
  return CLOSED_STATUSES.has(status);
}

const CLOSED_LABELS: Record<string, string> = {
  rejected: "This mentorship request was rejected.",
  cancelled: "This mentorship request was cancelled.",
  expired: "This mentorship request expired before it could be scheduled."
};

type SubStep = { label: string; done: boolean; current: boolean };

type Row = (
  | { kind: "simple"; key: string; label: string; done: boolean }
  | {
      kind: "phase";
      key: string;
      label: string;
      color: "eval" | "mentor";
      done: boolean;
      statusText: string;
      substeps: SubStep[];
    }
) & { current: boolean };

/** Derives the mentorship request's lifecycle as a vertical timeline, analogous to a
 * delivery tracker: three fixed opening checkpoints (Requested, Agenda Agreed, Paid),
 * then two phases that each carry their own inner checklist -- Copy Evaluation (only
 * when a copy was actually attached) and Mentorship (the call itself). A phase's
 * checklist renders directly under its own row rather than needing horizontal room,
 * so this stays readable at any screen width. */
function buildRows(input: MentorshipLifecycleInput): Row[] {
  const hasAgendas = input.agendas.length > 0;
  const agendaAgreedDone = !hasAgendas || input.agendas.every((a) => a.status !== "proposed");
  const hasCopy = Boolean(input.mains_answer_attempt_id) || Boolean(input.meta?.student_copy);
  const isEvaluated = input.mains_answer_attempt_id
    ? input.evaluation_status === "evaluated"
    : Boolean(input.meta?.evaluation);
  const isAccepted = input.status === "accepted" || input.status === "completed";
  const isPaid = input.payment_status === "paid";
  const isScheduled = Boolean(input.scheduled_slot_id) || Boolean(input.session_id);
  const isCompleted = input.status === "completed";

  const rows: Row[] = [
    { kind: "simple", key: "requested", label: "Requested", done: true, current: false },
    { kind: "simple", key: "agenda", label: "Agenda Agreed", done: agendaAgreedDone, current: false },
    { kind: "simple", key: "paid", label: "Paid", done: isPaid, current: false }
  ];

  if (hasCopy) {
    rows.push({
      kind: "phase",
      key: "evaluation",
      label: "Copy Evaluation",
      color: "eval",
      done: isEvaluated,
      current: false,
      statusText: isEvaluated ? "Evaluated" : isAccepted ? "In checking" : "Awaiting acceptance",
      substeps: [
        { label: "Copy submitted", done: true, current: false },
        { label: "Copy received", done: isAccepted, current: !isAccepted },
        { label: "In checking process", done: isEvaluated, current: isAccepted && !isEvaluated },
        { label: "Copy evaluated", done: isEvaluated, current: false }
      ]
    });
  }

  rows.push({
    kind: "phase",
    key: "mentorship",
    label: "Mentorship",
    color: "mentor",
    done: isCompleted,
    current: false,
    statusText: isCompleted ? "Completed" : isScheduled ? "Scheduled" : isPaid ? "Awaiting scheduling" : "Not started",
    substeps: [
      { label: "Requested", done: isPaid, current: !isPaid },
      { label: "Scheduled", done: isScheduled, current: isPaid && !isScheduled },
      { label: "In process", done: isCompleted, current: isScheduled && !isCompleted },
      { label: "Completed", done: isCompleted, current: false }
    ]
  });

  const firstNotDone = rows.find((row) => !row.done);
  if (firstNotDone) firstNotDone.current = true;
  return rows;
}

const PHASE_COLORS = {
  eval: {
    node: "border-indigo-600 text-indigo-600",
    nodeCurrent: "border-indigo-600 bg-indigo-600 text-white",
    label: "text-indigo-700",
    chip: "text-indigo-600",
    list: "bg-indigo-50/60 border-indigo-100"
  },
  mentor: {
    node: "border-amber-500 text-amber-600",
    nodeCurrent: "border-amber-500 bg-amber-500 text-white",
    label: "text-amber-700",
    chip: "text-amber-600",
    list: "bg-amber-50/60 border-amber-100"
  }
} as const;

export function MentorshipLifecycleTracker({ input }: { input: MentorshipLifecycleInput }) {
  if (isMentorshipRequestClosed(input.status)) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-xs font-bold text-rose-700">
        <XCircle className="h-4 w-4 shrink-0" />
        {CLOSED_LABELS[input.status] || "This mentorship request is closed."}
      </div>
    );
  }

  const rows = buildRows(input);

  return (
    <div className="flex flex-col">
      {rows.map((row, idx) => {
        const isLast = idx === rows.length - 1;
        const isCurrent = row.current;

        if (row.kind === "simple") {
          return (
            <div key={row.key} className="flex gap-3.5">
              <div className="flex flex-col items-center w-7 shrink-0">
                <div className={`w-0.5 flex-none h-1.5 ${idx === 0 ? "bg-transparent" : "bg-slate-200"}`} />
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-black shrink-0 ${
                    row.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isCurrent
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-300"
                  }`}
                >
                  {row.done ? <Check className="h-3.5 w-3.5" /> : null}
                </div>
                {!isLast && <div className={`w-0.5 flex-1 min-h-[14px] ${row.done ? "bg-emerald-500" : "bg-slate-200"}`} />}
              </div>
              <div className={`flex-1 min-w-0 pt-1 ${isLast ? "" : "pb-5"}`}>
                <span className={`text-sm font-extrabold ${row.done || isCurrent ? "text-slate-800" : "text-slate-400"}`}>
                  {row.label}
                </span>
              </div>
            </div>
          );
        }

        const colors = PHASE_COLORS[row.color];
        return (
          <div key={row.key} className="flex gap-3.5">
            <div className="flex flex-col items-center w-7 shrink-0">
              <div className="w-0.5 flex-none h-1.5 bg-slate-200" />
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-black shrink-0 ${
                  row.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : isCurrent
                      ? colors.nodeCurrent
                      : `${colors.node} bg-white`
                }`}
              >
                {row.done ? <Check className="h-3.5 w-3.5" /> : null}
              </div>
              {!isLast && <div className={`w-0.5 flex-1 min-h-[14px] ${row.done ? "bg-emerald-500" : "bg-slate-200"}`} />}
            </div>
            <div className={`flex-1 min-w-0 pt-1 ${isLast ? "" : "pb-5"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-extrabold ${row.done || isCurrent ? colors.label : "text-slate-400"}`}>
                  {row.label}
                </span>
                <span className={`text-[10px] font-bold ${colors.chip}`}>{row.statusText}</span>
              </div>

              <div className={`mt-3 space-y-2.5 rounded-2xl border px-3.5 py-3 ${colors.list}`}>
                {row.substeps.map((sub) => (
                  <div key={sub.label} className="flex items-center gap-2.5">
                    <div
                      className={`h-3.5 w-3.5 rounded-full border-2 shrink-0 ${
                        sub.done
                          ? "border-emerald-500 bg-emerald-500"
                          : sub.current
                            ? `${colors.node} bg-white ring-[3px] ring-offset-0 ${row.color === "eval" ? "ring-indigo-100" : "ring-amber-100"}`
                            : "border-slate-200 bg-white"
                      }`}
                    />
                    <span className={`text-[11.5px] font-bold ${sub.done || sub.current ? "text-slate-700" : "text-slate-400"}`}>
                      {sub.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
