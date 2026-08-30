"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Loader2, NotebookPen, Video } from "lucide-react";
import { useAuth, authenticatedGet } from "../auth/auth-context";

/**
 * The mentor's timetable.
 *
 * Sessions, not requests. A request is a negotiation; a session is an
 * appointment with a time attached, and this screen is about time. Grouped by
 * day and split at now, because "what is coming" and "what has happened" are
 * read for different reasons — the first to prepare, the second to see what is
 * still owed.
 */

type Session = {
  id: number;
  request_id: number;
  starts_at: string;
  ends_at: string;
  mode: string;
  status: "scheduled" | "completed" | "cancelled";
  meeting_link: string | null;
  cancelled_at: string | null;
  no_show_reported_at: string | null;
  no_show_role: string | null;
  student_name: string | null;
  payment_status: string;
  payment_amount: number;
  wrap_up_shared: boolean;
  wrap_up_started: boolean;
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(tomorrow.toISOString())) return "Tomorrow";
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(d);
}

function timeRange(startIso: string, endIso: string): string {
  const fmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${fmt.format(new Date(startIso))} – ${fmt.format(new Date(endIso))}`;
}

function SessionRow({ session }: { session: Session }) {
  const starts = new Date(session.starts_at).getTime();
  const now = Date.now();
  // The join control appears ten minutes ahead, and stays for the hour after —
  // a mentor arriving late still needs the door.
  const joinable =
    session.status === "scheduled" && starts - now < 10 * 60_000 && now - starts < 60 * 60_000;

  const cancelled = session.status === "cancelled";

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${
        cancelled ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-surface"
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className={`font-mono text-xs font-bold ${cancelled ? "text-slate-400 line-through" : "text-slate-600"}`}>
            {timeRange(session.starts_at, session.ends_at)}
          </span>
          <span className={`text-sm font-black ${cancelled ? "text-slate-400" : "text-slate-900"}`}>
            {session.student_name || "A student"}
          </span>
          {cancelled && (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
              Cancelled
            </span>
          )}
          {session.no_show_reported_at && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
              <AlertTriangle aria-hidden="true" className="h-3 w-3" />
              No-show: {session.no_show_role}
            </span>
          )}
        </div>

        {/* What is still owed on a finished session. */}
        {session.status === "completed" && !session.wrap_up_shared && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
            <NotebookPen aria-hidden="true" className="h-3.5 w-3.5" />
            {session.wrap_up_started ? "Wrap-up drafted, not shared yet" : "Wrap-up not written"}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {joinable && session.meeting_link && (
          <Link
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-indigo-700"
            href={`/mentorship/session/${session.id}`}
          >
            <Video aria-hidden="true" className="h-3.5 w-3.5" />
            Join
          </Link>
        )}
      </div>
    </div>
  );
}

export function MentorSchedulePanel() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setSessions(await authenticatedGet<Session[]>("/api/v1/mentorship/me/sessions", token));
      setError(null);
    } catch {
      setError("Could not load your schedule.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: Session[] = [];
    const old: Session[] = [];
    for (const s of sessions) {
      if (new Date(s.starts_at).getTime() >= now && s.status !== "completed") up.push(s);
      else old.push(s);
    }
    up.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    old.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    return { upcoming: up, past: old };
  }, [sessions]);

  function groupByDay(list: Session[]): [string, Session[]][] {
    const map = new Map<string, Session[]>();
    for (const s of list) {
      const key = dayKey(s.starts_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()];
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-surface p-6 text-sm font-bold text-slate-500">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading your schedule...
      </div>
    );
  }

  if (error) {
    return <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p>;
  }

  const owed = past.filter((s) => s.status === "completed" && !s.wrap_up_shared).length;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950">Coming up</h3>
          <span className="font-mono text-[11px] font-bold text-slate-400">
            {upcoming.length} {upcoming.length === 1 ? "session" : "sessions"}
          </span>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-8 text-center">
            <CalendarDays aria-hidden="true" className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-black text-slate-800">Nothing booked</p>
            <p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-5 text-slate-500">
              Students can only book times you have opened. If your Availability is empty, nobody can
              reach you.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupByDay(upcoming).map(([key, rows]) => (
              <div key={key}>
                <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {dayLabel(rows[0]!.starts_at)}
                </p>
                <div className="space-y-2">
                  {rows.map((s) => (
                    <SessionRow key={s.id} session={s} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <button
            className="mb-2.5 flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setShowPast((v) => !v)}
            type="button"
          >
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950">
              Finished
              {owed > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
                  {owed} wrap-up{owed === 1 ? "" : "s"} owed
                </span>
              )}
            </h3>
            <span className="font-mono text-[11px] font-bold text-slate-400">
              {showPast ? "Hide" : `Show ${past.length}`}
            </span>
          </button>

          {showPast && (
            <div className="space-y-4">
              {groupByDay(past).map(([key, rows]) => (
                <div key={key}>
                  <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {dayLabel(rows[0]!.starts_at)}
                  </p>
                  <div className="space-y-2">
                    {rows.map((s) => (
                      <SessionRow key={s.id} session={s} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
