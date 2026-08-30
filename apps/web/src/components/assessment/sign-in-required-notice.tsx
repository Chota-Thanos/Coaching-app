"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogIn, Sparkles } from "lucide-react";
import { useAuth } from "../auth/auth-context";

/**
 * Tells a signed-out learner what they are missing, and takes them to sign in.
 *
 * The assessment area let guests build and attempt tests, which is deliberate —
 * but it said so in exactly one place, the create-test wizard, and everywhere
 * else a guest hit a smaller cap or a saved-work feature with no explanation.
 * Worse, the few notices that did exist were dead ends: they told the reader to
 * sign in without giving them anywhere to do it.
 *
 * Every instance links to `/login` carrying the current URL, so signing in
 * returns the learner to the exact screen they were on rather than dumping
 * them on a dashboard.
 */
export function SignInRequiredNotice({
  /** What signing in unlocks here. One short clause, no full stop. */
  benefit,
  /** `notice` explains a limit in place; `blocker` replaces content that
   *  cannot work at all while signed out. */
  variant = "notice",
  className = ""
}: {
  benefit: string;
  variant?: "notice" | "blocker";
  className?: string;
}) {
  const { token } = useAuth();
  const pathname = usePathname() || "/";
  const search = useSearchParams()?.toString();

  // Signed in: there is nothing to say.
  if (token) return null;

  const next = encodeURIComponent(search ? `${pathname}?${search}` : pathname);
  const loginHref = `/login?next=${next}`;

  if (variant === "blocker") {
    return (
      <div
        className={`rounded-2xl border border-dashed border-slate-200 bg-surface p-6 text-center ${className}`}
      >
        <p className="text-sm font-bold text-slate-700">{benefit}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700"
            href={loginHref}
          >
            <LogIn aria-hidden="true" className="h-4 w-4" />
            Sign in
          </Link>
          <Link
            className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-surface px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            href={`/register?next=${next}`}
          >
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm font-semibold text-amber-800 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className="flex items-start gap-2">
        <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>You&apos;re not signed in — {benefit}.</span>
      </p>
      <Link
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-amber-800"
        href={loginHref}
      >
        <LogIn aria-hidden="true" className="h-3.5 w-3.5" />
        Sign in
      </Link>
    </div>
  );
}
