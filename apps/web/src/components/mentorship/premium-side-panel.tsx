"use client";

import Link from "next/link";
import { Video, Link2 } from "lucide-react";
import type { MentorshipAgenda } from "./agenda-panel";
import type { MentorshipMessage } from "./chat-thread";

type Props = {
  agendas: MentorshipAgenda[];
  messages: MentorshipMessage[];
  scheduledSlotId: number | null;
  sessionId: number | null;
  sessionStartsAt: string | null;
  scratchpad: string;
  onScratchpadChange: (value: string) => void;
};

/** Post-payment sidebar shared between the student dashboard and mentor
 * workspace: deliverables progress, upcoming call schedule, links shared in
 * chat, and a per-request scratchpad. Was byte-identical in both files. */
export function PremiumSidePanel({
  agendas,
  messages,
  scheduledSlotId,
  sessionId,
  sessionStartsAt,
  scratchpad,
  onScratchpadChange
}: Props) {
  const trackableAgendas = agendas.filter((a) => ["agreed", "solved_proposed", "solved"].includes(a.status));
  const solvedAgendas = agendas.filter((a) => ["solved_proposed", "solved"].includes(a.status));
  const totalCount = trackableAgendas.length;
  const solvedCount = solvedAgendas.length;
  const percentage = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

  const extractUrls = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };
  const sharedLinks = Array.from(
    new Set(messages.flatMap((msg) => extractUrls(msg.body)).map((url) => url.replace(/[.,;!?]$/, "")))
  );

  return (
    <div className="space-y-4 flex flex-col h-[480px]">
      {/* Deliverables Progress Bar */}
      <div className="rounded-2xl border border-indigo-105 bg-surface p-4 shadow-sm space-y-2">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-indigo-950">Deliverables Progress</h4>
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span>Agendas Solved</span>
          <span>
            {solvedCount}/{totalCount} ({percentage}%)
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      {/* Call Schedule Status */}
      {scheduledSlotId && sessionId && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/20 p-4 shadow-sm space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Call Schedule</h4>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-805">Next Upcoming Slot</p>
            <p className="text-[10px] text-slate-500 font-semibold">
              {sessionStartsAt ? new Date(sessionStartsAt).toLocaleString() : "Date pending"}
            </p>
          </div>
          <Link
            href={`/mentorship/session/${sessionId}`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
          >
            <Video className="h-3.5 w-3.5" />
            Join Call Room
          </Link>
        </div>
      )}

      {/* Shared Resources Link Index */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm space-y-2 flex-1 flex flex-col overflow-hidden">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1 shrink-0">
          <Link2 className="h-3.5 w-3.5 text-indigo-500" />
          Shared Resources ({sharedLinks.length})
        </h4>
        <div className="overflow-y-auto space-y-1.5 pr-1 text-xs flex-1">
          {sharedLinks.map((link, idx) => {
            let displayLink = link;
            try {
              const urlObj = new URL(link);
              displayLink = urlObj.hostname + (urlObj.pathname.length > 15 ? urlObj.pathname.substring(0, 12) + "..." : urlObj.pathname);
            } catch {
              // keep raw link as display text
            }
            return (
              <a
                key={idx}
                href={link}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-[11px] font-bold text-slate-650 truncate transition-all"
                title={link}
              >
                {displayLink}
              </a>
            );
          })}
          {sharedLinks.length === 0 && (
            <p className="text-[10px] text-slate-400 italic text-center py-4">No shared links in this chat yet.</p>
          )}
        </div>
      </div>

      {/* Active Workspace Scratchpad */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm space-y-2 shrink-0">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">Scratchpad</h4>
        <textarea
          value={scratchpad}
          onChange={(e) => onScratchpadChange(e.target.value)}
          placeholder="Capture notes, action items, or session goals here..."
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-medium outline-none focus:border-indigo-500 bg-slate-50/50 resize-none h-20"
        />
      </div>
    </div>
  );
}
