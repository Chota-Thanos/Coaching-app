"use client";

import { Send, MessageSquare } from "lucide-react";
import type { RefObject } from "react";

export type MentorshipMessage = {
  id: number;
  sender_id: number;
  sender_username: string;
  body: string;
  created_at: string;
};

type Props = {
  messages: MentorshipMessage[];
  currentUserId: number | undefined;
  typedMessage: string;
  onTypedMessageChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  sending: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
  theme: "amber" | "indigo";
  title: string;
  subtitle: string;
  badgeLabel: string;
  emptyStateText: string;
  inputPlaceholder: string;
  height?: string;
};

/** Chat thread shared between the student dashboard and mentor workspace --
 * both the pre-payment (amber) and post-payment (indigo) rooms on each side
 * rendered byte-identical markup before this was extracted. */
export function ChatThread({
  messages,
  currentUserId,
  typedMessage,
  onTypedMessageChange,
  onSubmit,
  sending,
  bottomRef,
  theme,
  title,
  subtitle,
  badgeLabel,
  emptyStateText,
  inputPlaceholder,
  height = "480px"
}: Props) {
  const isAmber = theme === "amber";

  return (
    <div
      className={`rounded-[32px] border shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-200 ${
        isAmber ? "border-amber-250/70 bg-white" : "border-indigo-150 bg-white"
      }`}
      style={{ height }}
    >
      <div
        className={`border-b px-6 py-4 flex items-center justify-between ${
          isAmber ? "border-amber-100 bg-amber-50/40" : "border-indigo-55 bg-indigo-50/40"
        }`}
      >
        <div className="flex flex-col">
          <span
            className={`text-xs font-bold flex items-center gap-1.5 ${
              isAmber ? "text-amber-800" : "text-indigo-950"
            }`}
          >
            <MessageSquare className={`h-4 w-4 animate-pulse ${isAmber ? "text-amber-600" : "text-indigo-600"}`} />
            {title}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">{subtitle}</span>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
            isAmber
              ? "text-amber-700 bg-amber-50 border-amber-100"
              : "text-emerald-700 bg-emerald-50 border-emerald-100"
          }`}
        >
          {!isAmber && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          {badgeLabel}
        </span>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400 italic text-center px-4">
            {emptyStateText}
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-slate-400 font-semibold mb-1">
                  {isMe ? "You" : msg.sender_username} ·{" "}
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs leading-normal whitespace-pre-wrap shadow-sm ${
                    isMe
                      ? isAmber
                        ? "bg-amber-100 text-amber-800 border border-amber-200/50 rounded-tr-none"
                        : "bg-indigo-600 text-white rounded-tr-none"
                      : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50"
                  }`}
                >
                  {msg.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={onSubmit} className="border-t border-slate-100 p-4 flex gap-2 bg-slate-50/50">
        <input
          type="text"
          placeholder={inputPlaceholder}
          value={typedMessage}
          onChange={(e) => onTypedMessageChange(e.target.value)}
          className={`flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none ${
            isAmber ? "focus:border-amber-500 focus:ring-1 focus:ring-amber-500" : "focus:border-indigo-500"
          }`}
        />
        <button
          type="submit"
          disabled={sending || !typedMessage.trim()}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50 flex items-center justify-center shrink-0 transition"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
