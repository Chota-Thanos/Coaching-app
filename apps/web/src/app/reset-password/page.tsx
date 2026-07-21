"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { browserBaseUrl } from "../../lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch(`${browserBaseUrl}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "This reset link is invalid or has expired.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full rounded-lg border border-line bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-black text-ink">Missing reset link</h1>
        <p className="mt-2 text-sm text-ink/65">
          This page needs a valid reset link from your email.
        </p>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-bold text-civic">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full rounded-lg border border-line bg-white p-6 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-black text-ink">Password updated</h1>
        <p className="mt-2 text-sm text-ink/65">Redirecting you to sign in…</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-bold text-civic">
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full rounded-lg border border-line bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-black leading-tight text-ink">Set a new password</h1>
      <p className="mt-1 text-sm leading-6 text-ink/65">Choose a password of at least 8 characters.</p>

      <label className="mt-6 block text-sm font-bold text-ink" htmlFor="rp-password">
        New password
      </label>
      <input
        id="rp-password"
        type="password"
        required
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1 h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
      />

      <label className="mt-4 block text-sm font-bold text-ink" htmlFor="rp-confirm">
        Confirm new password
      </label>
      <input
        id="rp-confirm"
        type="password"
        required
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="mt-1 h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
      />

      {error && (
        <p className="mt-4 rounded-md border border-berry/20 bg-berry/5 px-3 py-2 text-sm font-semibold text-berry">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 h-12 w-full rounded-md bg-civic text-sm font-black text-white disabled:opacity-60"
      >
        {pending ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-md items-center px-4 py-10">
      <Suspense
        fallback={
          <div className="w-full rounded-lg border border-line bg-white p-6 text-sm text-ink/70 shadow-sm">
            Loading…
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
