"use client";

import { AlertCircle, FileText, Trash2 } from "lucide-react";

export type MentorshipAgenda = {
  id: number;
  title: string;
  description: string | null;
  status: "proposed" | "agreed" | "solved_proposed" | "solved";
  created_by: number;
  creator_username: string;
  meta?: { attached_question?: { url: string; file_name: string } | null } | null;
};

const STATUS_COLORS: Record<string, string> = {
  proposed: "bg-amber-100 text-amber-800 border-amber-200",
  agreed: "bg-indigo-100 text-indigo-800 border-indigo-200",
  solved_proposed: "bg-orange-100 text-orange-800 border-orange-200 animate-pulse",
  solved: "bg-emerald-100 text-emerald-800 border-emerald-200"
};

const STATUS_LABELS_BY_ROLE: Record<"mentor" | "student", Record<string, string>> = {
  student: {
    proposed: "Proposed",
    agreed: "Agreed",
    solved_proposed: "Solved (Waiting for your confirmation)",
    solved: "Solved & Confirmed"
  },
  mentor: {
    proposed: "Proposed",
    agreed: "Agreed",
    solved_proposed: "Solved proposed (pending student consent)",
    solved: "Solved & Confirmed"
  }
};

type Props = {
  agendas: MentorshipAgenda[];
  currentUserId: number | undefined;
  viewerRole: "mentor" | "student";
  paymentStatus: "pending" | "paid" | "refunded" | "failed";
  isClosed: boolean;
  icon: React.ReactNode;
  proposing: boolean;
  newTitle: string;
  newDesc: string;
  onTitleChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onSubmitPropose: (e: React.FormEvent) => void;
  onAgree: (agendaId: number) => void;
  onProposeSolve?: (agendaId: number) => void; // mentor only
  onConfirmSolve?: (agendaId: number) => void; // student only
  onDelete: (agendaId: number) => void;
  titlePlaceholder: string;
  emptyStateText: string;
  extraFormContent?: React.ReactNode;
  footerContent?: React.ReactNode;
};

/** Agenda propose/agree/solve panel shared between the student dashboard and
 * mentor workspace. New agendas may be proposed any time the request isn't
 * closed (completed/rejected/cancelled/expired) -- not just pre-payment. */
export function AgendaPanel({
  agendas,
  currentUserId,
  viewerRole,
  paymentStatus,
  isClosed,
  icon,
  proposing,
  newTitle,
  newDesc,
  onTitleChange,
  onDescChange,
  onSubmitPropose,
  onAgree,
  onProposeSolve,
  onConfirmSolve,
  onDelete,
  titlePlaceholder,
  emptyStateText,
  extraFormContent,
  footerContent
}: Props) {
  const statusLabels = STATUS_LABELS_BY_ROLE[viewerRole];
  const hasUnagreed = agendas.some((a) => a.status === "proposed");

  return (
    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
          {icon}
          Mentorship Request Agendas ({agendas.length})
        </h3>
        {paymentStatus === "pending" && (
          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
            Pre-Payment Coordination
          </span>
        )}
        {paymentStatus === "paid" && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
            Active Deliverables Tracker
          </span>
        )}
      </div>

      {paymentStatus === "pending" && hasUnagreed && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/10 p-4 flex gap-2.5 items-start text-xs text-amber-800 leading-normal">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Proposed Agendas Pending Agreement</p>
            <p className="mt-0.5">
              Please review and agree to the proposed agendas below. Payment cannot proceed until all proposed
              agendas are agreed to by both parties.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {agendas.map((agenda) => {
          const isCreatorMe = Number(agenda.created_by) === currentUserId;

          return (
            <div
              key={agenda.id}
              className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-3 transition hover:bg-white hover:border-slate-200 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-xs">{agenda.title}</h4>
                  {agenda.description && (
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">{agenda.description}</p>
                  )}
                  <p className="text-[9px] text-slate-400 mt-1.5">
                    Proposed by: {isCreatorMe ? "You" : agenda.creator_username || "User"} · Status:
                    <span
                      className={`inline-block ml-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border ${STATUS_COLORS[agenda.status]}`}
                    >
                      {statusLabels[agenda.status]}
                    </span>
                  </p>
                  {agenda.meta?.attached_question && (
                    <div className="mt-2">
                      <a
                        href={agenda.meta.attached_question.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100"
                      >
                        <FileText className="h-3 w-3 text-indigo-600 shrink-0" />
                        Attached Question: {agenda.meta.attached_question.file_name}
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {agenda.status === "proposed" && !isCreatorMe && (
                    <button
                      type="button"
                      onClick={() => onAgree(agenda.id)}
                      className="rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-black text-white hover:bg-indigo-700 transition"
                    >
                      Agree
                    </button>
                  )}

                  {viewerRole === "mentor" && agenda.status === "agreed" && onProposeSolve && (
                    <button
                      type="button"
                      onClick={() => onProposeSolve(agenda.id)}
                      className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-black text-white hover:bg-emerald-700 transition"
                    >
                      Mark Solved
                    </button>
                  )}

                  {viewerRole === "student" && agenda.status === "solved_proposed" && onConfirmSolve && (
                    <button
                      type="button"
                      onClick={() => onConfirmSolve(agenda.id)}
                      className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-black text-white hover:bg-emerald-700 transition"
                    >
                      Confirm Solved
                    </button>
                  )}

                  {agenda.status === "proposed" && isCreatorMe && (
                    <button
                      type="button"
                      onClick={() => onDelete(agenda.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition"
                      title="Delete Agenda"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {agendas.length === 0 && (
          <p className="text-xs text-slate-400 italic text-center py-4">{emptyStateText}</p>
        )}
      </div>

      {/* Propose agenda form -- allowed any time the request isn't closed */}
      {!isClosed && (
        <form onSubmit={onSubmitPropose} className="border-t border-slate-100 pt-4 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
            Propose Mentorship Deliverable / Agenda Query
          </span>
          <div className="space-y-2">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={titlePlaceholder}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
            />
            <textarea
              rows={2}
              value={newDesc}
              onChange={(e) => onDescChange(e.target.value)}
              placeholder="Provide optional detail or explanation..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none"
            />
            {extraFormContent}
          </div>
          <button
            type="submit"
            disabled={proposing}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600 transition disabled:opacity-50"
          >
            {proposing ? "Proposing..." : "Propose Agenda"}
          </button>
        </form>
      )}

      {footerContent}
    </div>
  );
}
