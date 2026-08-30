"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, UserX, X } from "lucide-react";
import { useAuth, authenticatedPost } from "../auth/auth-context";

/**
 * Calling off a session, and saying the other side never turned up.
 *
 * Both were missing entirely: every status change was mentor-driven, so a
 * student who needed to pull out had no way to say so, and a student who paid
 * for a session the mentor never joined had nowhere to report it. Both are
 * destructive and both ask before acting — a mis-click here costs someone a
 * booked appointment.
 */

function ConfirmBox({
  title,
  body,
  confirmLabel,
  tone,
  placeholder,
  reasonRequired,
  busy,
  onCancel,
  onConfirm
}: {
  title: string;
  body: string;
  confirmLabel: string;
  tone: "rose" | "amber";
  placeholder: string;
  reasonRequired?: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const palette =
    tone === "rose"
      ? { border: "border-rose-200", bg: "bg-rose-50/60", button: "bg-rose-600 hover:bg-rose-700" }
      : { border: "border-amber-200", bg: "bg-amber-50/60", button: "bg-amber-600 hover:bg-amber-700" };

  return (
    <div className={`rounded-2xl border p-4 ${palette.border} ${palette.bg}`}>
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{body}</p>
      <textarea
        className="mt-2.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
        onChange={(event) => setReason(event.target.value)}
        placeholder={placeholder}
        rows={2}
        value={reason}
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 ${palette.button}`}
          disabled={busy || (reasonRequired === true && reason.trim().length === 0)}
          onClick={() => onConfirm(reason.trim())}
          type="button"
        >
          {busy && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />}
          {confirmLabel}
        </button>
        <button
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700"
          disabled={busy}
          onClick={onCancel}
          type="button"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}

export function CancelRequestControl({
  requestId,
  viewer,
  isPaid,
  isBooked,
  onDone
}: {
  requestId: number;
  viewer: "student" | "mentor";
  isPaid: boolean;
  isBooked: boolean;
  onDone: () => Promise<void> | void;
}) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(reason: string): Promise<void> {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await authenticatedPost(`/api/v1/mentorship/requests/${requestId}/cancel`, token, {
        reason: reason || null
      });
      setOpen(false);
      await onDone();
    } catch {
      setError("Could not cancel. Please try again, or message the other person.");
    } finally {
      setBusy(false);
    }
  }

  // The two sides are told different things because the consequence differs:
  // a mentor pulling out refunds the student automatically, a student pulling
  // out does not get their money back without asking.
  const body =
    viewer === "mentor"
      ? isPaid
        ? "The student is refunded in full and the time goes back on your calendar."
        : "The request is closed and the student is told. Nothing was charged."
      : isPaid
        ? "Your slot is released. Payment is not refunded automatically once a mentor has held the time — message them first if you need a refund."
        : "The request is withdrawn and the mentor is told. Nothing was charged.";

  if (!open) {
    return (
      <div>
        <button
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600"
          onClick={() => setOpen(true)}
          type="button"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          {isBooked ? "Cancel this session" : viewer === "mentor" ? "Decline and close" : "Withdraw this request"}
        </button>
        {error && <p className="mt-1 text-xs font-bold text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <ConfirmBox
      body={body}
      busy={busy}
      confirmLabel={isBooked ? "Cancel the session" : "Close the request"}
      onCancel={() => setOpen(false)}
      onConfirm={confirm}
      placeholder="Tell them why (optional)"
      title={isBooked ? "Cancel this session?" : "Close this request?"}
      tone="rose"
    />
  );
}

export function ReportNoShowControl({
  sessionId,
  viewer,
  alreadyReported,
  onDone
}: {
  sessionId: number;
  viewer: "student" | "mentor";
  alreadyReported: boolean;
  onDone: () => Promise<void> | void;
}) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(note: string): Promise<void> {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await authenticatedPost(`/api/v1/mentorship/sessions/${sessionId}/no-show`, token, {
        note: note || null
      });
      setOpen(false);
      await onDone();
    } catch {
      setError("Could not report this. A session can only be reported once it was due to start.");
    } finally {
      setBusy(false);
    }
  }

  if (alreadyReported) {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
        A no-show has been reported. Our team will look into it.
      </p>
    );
  }

  if (!open) {
    return (
      <div>
        <button
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-amber-700"
          onClick={() => setOpen(true)}
          type="button"
        >
          <UserX aria-hidden="true" className="h-3.5 w-3.5" />
          {viewer === "student" ? "My mentor did not join" : "The student did not join"}
        </button>
        {error && <p className="mt-1 text-xs font-bold text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <ConfirmBox
      body={
        viewer === "student"
          ? "Our team will check the session record and decide on a refund. Only report this if you waited and they never joined."
          : "This is recorded against the student's account. Our team reviews it before anything follows."
      }
      busy={busy}
      confirmLabel="Report the no-show"
      onCancel={() => setOpen(false)}
      onConfirm={confirm}
      placeholder="What happened? (optional)"
      reasonRequired={false}
      title={viewer === "student" ? "Report that your mentor did not join?" : "Report that the student did not join?"}
      tone="amber"
    />
  );
}
