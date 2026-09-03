"use client";

import { useEffect, useRef, useState } from "react";
import { Hand, Loader2, MessageSquare, Send } from "lucide-react";
import { authenticatedGet, authenticatedPost } from "../auth/auth-context";

/**
 * The side channel of a live class: chat, and who has a hand up.
 *
 * Polled rather than pushed. The Agora Web SDK installed here carries no data
 * messages and this API has no WebSocket layer, so a short poll against
 * ordinary authenticated REST is both the smallest thing that works and the
 * one the Flutter app can reuse unchanged. One request returns both halves —
 * see the /activity endpoint — so a room open for an hour makes one call every
 * two seconds, not two.
 */

type LiveMessage = {
  id: number;
  user_id: number;
  body: string;
  created_at: string;
  author_name: string;
};

type RaisedHand = {
  user_id: number;
  raised_at: string;
  student_name: string;
};

const POLL_INTERVAL_MS = 2500;

export function LiveClassChat({
  liveClassId,
  token,
  currentUserId,
  isHost
}: {
  liveClassId: number;
  token: string;
  currentUserId: number;
  isHost: boolean;
}) {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [hands, setHands] = useState<RaisedHand[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);

  const myHandRaised = hands.some((hand) => hand.user_id === currentUserId);

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      try {
        const activity = await authenticatedGet<{ messages: LiveMessage[]; hands: RaisedHand[] }>(
          `/api/v1/study-plan-live-classes/${liveClassId}/activity?after=${lastIdRef.current}`,
          token
        );
        if (stopped) return;
        if (activity.messages.length > 0) {
          lastIdRef.current = activity.messages[activity.messages.length - 1]!.id;
          setMessages((current) => [...current, ...activity.messages]);
        }
        setHands(activity.hands);
        setError(null);
      } catch (caught) {
        if (!stopped) setError(caught instanceof Error ? caught.message : "Lost touch with the chat.");
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [liveClassId, token]);

  // Follow new messages, but never yank the view away from someone who has
  // scrolled up to re-read something.
  useEffect(() => {
    const list = listRef.current;
    if (list && pinnedToBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await authenticatedPost(`/api/v1/study-plan-live-classes/${liveClassId}/messages`, token, { body });
      setDraft("");
      pinnedToBottomRef.current = true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That message did not send.");
    } finally {
      setSending(false);
    }
  };

  const setHand = async (raised: boolean, userId?: number) => {
    try {
      await authenticatedPost(`/api/v1/study-plan-live-classes/${liveClassId}/hand`, token, {
        raised,
        ...(userId ? { user_id: userId } : {})
      });
      // Reflect it immediately rather than waiting for the next poll.
      setHands((current) =>
        raised
          ? current
          : current.filter((hand) => hand.user_id !== (userId ?? currentUserId))
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your hand.");
    }
  };

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      {isHost && (
        <div className="border-b border-white/10 p-3">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white/45">
            <Hand className="h-3.5 w-3.5" />
            Hands up ({hands.length})
          </p>
          {hands.length === 0 ? (
            <p className="mt-2 text-xs text-white/35">Nobody is waiting to speak.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {hands.map((hand) => (
                <li className="flex items-center justify-between gap-2" key={hand.user_id}>
                  <span className="truncate text-xs font-bold text-amber-300">{hand.student_name}</span>
                  <button
                    className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-[10px] font-black text-white/60 hover:bg-white/10"
                    onClick={() => void setHand(false, hand.user_id)}
                    type="button"
                  >
                    Called on
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <MessageSquare className="h-3.5 w-3.5 text-white/45" />
        <p className="text-[11px] font-black uppercase tracking-wider text-white/45">Chat</p>
      </div>

      <div
        className="flex-1 space-y-3 overflow-y-auto p-3"
        onScroll={(event) => {
          const element = event.currentTarget;
          pinnedToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
        }}
        ref={listRef}
      >
        {messages.length === 0 ? (
          <p className="text-xs text-white/35">
            {isHost ? "Questions from your students will appear here." : "Ask a question — your teacher can see it."}
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.user_id === currentUserId;
            return (
              <div key={message.id}>
                <p className="text-[10px] font-black uppercase tracking-wider text-white/35">
                  {mine ? "You" : message.author_name}
                </p>
                <p
                  className={`mt-1 inline-block rounded-xl px-3 py-2 text-xs leading-5 ${
                    mine ? "bg-indigo-500/25 text-white" : "bg-white/10 text-white/85"
                  }`}
                >
                  {message.body}
                </p>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="px-3 pb-1 text-[11px] font-bold text-rose-300">{error}</p>}

      <div className="border-t border-white/10 p-2">
        {!isHost && (
          <button
            className={`mb-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-black transition-colors ${
              myHandRaised ? "bg-amber-400 text-slate-900" : "border border-white/15 text-white/70 hover:bg-white/10"
            }`}
            onClick={() => void setHand(!myHandRaised)}
            type="button"
          >
            <Hand className="h-4 w-4" />
            {myHandRaised ? "Hand is up — lower it" : "Raise your hand"}
          </button>
        )}
        <div className="flex items-center gap-2">
          <input
            className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 text-xs font-semibold text-white outline-none placeholder:text-white/30 focus:border-white/35"
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={isHost ? "Say something to the class" : "Ask a question"}
            value={draft}
          />
          <button
            aria-label="Send"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-500 text-white disabled:opacity-40"
            disabled={sending || !draft.trim()}
            onClick={() => void send()}
            type="button"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
