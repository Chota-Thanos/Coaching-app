"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight, NotebookPen, Video } from "lucide-react";
import { useAuth, authenticatedGet } from "../auth/auth-context";

/**
 * The mentor's shift briefing.
 *
 * What was here counted things — pending requests, bookings, defined slots, and
 * the mentor's own years of experience, which is their CV and not something
 * they can act on. None of it answered the two questions someone actually opens
 * this page with: what needs a decision from me, and who am I seeing next.
 *
 * Every number below implies an action. A count with no consequence is left
 * out.
 */

type RequestLike = {
  id: number;
  status: string;
  note: string | null;
  created_at: string;
  learner_name?: string | null;
  payment_amount?: number | null;
  session_starts_at?: string | null;
  session_id?: number | null;
};

type SlotLike = { starts_at: string; booked_count: number; max_bookings: number };

type Session = {
  id: number;
  starts_at: string;
  status: string;
  student_name: string | null;
  wrap_up_shared: boolean;
};

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function untilLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < 0) return "now";
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "in an hour" : `in ${hours} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

export function MentorDashboardPanel({
  mentorName,
  requests,
  slots,
  onOpenBookings,
  onOpenSchedules,
  onOpenAvailability
}: {
  mentorName: string;
  requests: RequestLike[];
  slots: SlotLike[];
  onOpenBookings: () => void;
  onOpenSchedules: () => void;
  onOpenAvailability: () => void;
}) {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setSessions(await authenticatedGet<Session[]>("/api/v1/mentorship/me/sessions", token));
    } catch {
      // The briefing degrades to what the requests already tell us rather than
      // failing the whole screen.
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const awaiting = useMemo(() => requests.filter((r) => r.status === "requested"), [requests]);

  const nextSession = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((s) => s.status === "scheduled" && new Date(s.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
  }, [sessions]);

  const openThisWeek = useMemo(() => {
    const now = Date.now();
    const weekOut = now + 7 * 24 * 3600 * 1000;
    return slots.filter((s) => {
      const t = new Date(s.starts_at).getTime();
      return t >= now && t <= weekOut && s.booked_count < s.max_bookings;
    }).length;
  }, [slots]);

  const thisMonth = useMemo(() => {
    const now = new Date();
    return sessions.filter((s) => {
      const d = new Date(s.starts_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && s.status === "completed";
    }).length;
  }, [sessions]);

  const wrapUpsOwed = useMemo(
    () => sessions.filter((s) => s.status === "completed" && !s.wrap_up_shared),
    [sessions]
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">
          {greeting}, {mentorName.split(" ")[0]}
        </h2>
        <span className="font-mono text-[11px] font-bold text-slate-400">
          {new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(new Date())}
        </span>
      </div>

      {/* The one imminent thing. */}
      {nextSession ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
              Next session · {untilLabel(nextSession.starts_at)}
            </p>
            <p className="mt-1 text-lg font-black leading-tight text-slate-900">
              {nextSession.student_name || "A student"}
            </p>
            <p className="text-sm font-semibold text-slate-600">{whenLabel(nextSession.starts_at)}</p>
          </div>
          <Link
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-700"
            href={`/mentorship/session/${nextSession.id}`}
          >
            <Video aria-hidden="true" className="h-4 w-4" />
            Open session
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-5 text-center">
          <CalendarClock aria-hidden="true" className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-black text-slate-800">No session booked</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            Students can only book times you have opened.
          </p>
          <button
            className="mt-3 rounded-xl border border-slate-300 bg-surface px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            onClick={onOpenAvailability}
            type="button"
          >
            Open some times
          </button>
        </div>
      )}

      {/* What is waiting on the mentor, with the ask in the student's words. */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-amber-50/70 px-4 py-2.5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-800">Needs your decision</h3>
          <span className="font-mono text-[11px] font-bold text-amber-800">{awaiting.length}</span>
        </div>

        {awaiting.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs font-semibold text-slate-500">
            Nothing waiting on you. New requests appear here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {awaiting.slice(0, 4).map((r) => (
              <li key={r.id}>
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                  onClick={onOpenBookings}
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-900">
                      {r.learner_name || "A student"}
                    </span>
                    {r.note && (
                      <span className="block truncate text-xs text-slate-500">&ldquo;{r.note}&rdquo;</span>
                    )}
                    <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                      asked {timeAgo(r.created_at)}
                      {r.payment_amount ? ` · ₹${Number(r.payment_amount).toLocaleString("en-IN")}` : ""}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Three numbers, each with something to do about it. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          className="rounded-2xl border border-slate-200 bg-surface p-4 text-left shadow-sm transition hover:border-slate-300"
          onClick={onOpenAvailability}
          type="button"
        >
          <p className="font-mono text-2xl font-black leading-none tabular-nums text-slate-900">{openThisWeek}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Open times this week</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {openThisWeek === 0 ? "Nobody can book you" : "Students can book these"}
          </p>
        </button>

        <button
          className="rounded-2xl border border-slate-200 bg-surface p-4 text-left shadow-sm transition hover:border-slate-300"
          onClick={onOpenSchedules}
          type="button"
        >
          <p className="font-mono text-2xl font-black leading-none tabular-nums text-slate-900">{thisMonth}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Sessions this month</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Finished and paid</p>
        </button>

        <button
          className={`rounded-2xl border p-4 text-left shadow-sm transition ${
            wrapUpsOwed.length > 0
              ? "border-amber-200 bg-amber-50/60 hover:border-amber-300"
              : "border-slate-200 bg-surface hover:border-slate-300"
          }`}
          onClick={onOpenSchedules}
          type="button"
        >
          <p
            className={`font-mono text-2xl font-black leading-none tabular-nums ${
              wrapUpsOwed.length > 0 ? "text-amber-800" : "text-slate-900"
            }`}
          >
            {wrapUpsOwed.length}
          </p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Wrap-ups owed</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
            {wrapUpsOwed.length > 0 && <NotebookPen aria-hidden="true" className="h-3 w-3" />}
            {wrapUpsOwed.length > 0
              ? `${wrapUpsOwed[0]?.student_name || "A student"} and others`
              : "Nothing outstanding"}
          </p>
        </button>
      </div>
    </div>
  );
}
