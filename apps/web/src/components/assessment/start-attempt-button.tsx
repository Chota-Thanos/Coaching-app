"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, PlayCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { guestAwarePost, useAuth } from "../auth/auth-context";
import { getOrCreateGuestToken } from "../../lib/guest";

type StartAttemptButtonProps = {
  testTemplateId: number;
  createdByUserId?: number | null;
};

export function StartAttemptButton({ testTemplateId, createdByUserId }: StartAttemptButtonProps) {
  const router = useRouter();
  const { token, user } = useAuth();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function start(): Promise<void> {
    setPending(true);
    setMessage(null);
    try {
      const guestToken = token ? null : getOrCreateGuestToken();
      const attempt = await guestAwarePost<{ id: number }>(
        `/api/v1/assessment/test-templates/${testTemplateId}/attempts/start`,
        token,
        guestToken,
        {}
      );
      router.push(`/assessment/attempts/${attempt.id}`);
    } catch {
      setMessage("Could not start this test. Sign in if it needs a subscription, or try again.");
      setPending(false);
    }
  }

  const isOwner = user && createdByUserId && user.id === createdByUserId;

  return (
    <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-card space-y-3">
      <button
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-black text-white shadow-sm transition-colors hover:bg-indigo-600 active:scale-[0.98] disabled:opacity-60"
        disabled={pending}
        onClick={start}
        type="button"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
        ) : (
          <PlayCircle aria-hidden="true" className="h-5 w-5" />
        )}
        {pending ? "Starting test…" : "Start Test"}
      </button>

      {isOwner && (
        <Link
          href={`/assessment/ai-parser?test_template_id=${testTemplateId}`}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-surface px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition active:scale-[0.98]"
        >
          <Sparkles aria-hidden="true" className="h-5 w-5 text-indigo-650" />
          <span>Add Questions with AI</span>
        </Link>
      )}

      {message && (
        <p className="mt-3 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs font-semibold text-rose-600">{message}</p>
      )}
    </div>
  );
}
