"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck, ArrowLeft } from "lucide-react";
import { browserBaseUrl } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${browserBaseUrl}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      if (!res.ok) throw new Error("Request failed");
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-md items-center px-4 py-10">
      <div className="w-full rounded-lg border border-line bg-white p-6 shadow-sm">
        {sent ? (
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-civic/10 text-civic">
              <MailCheck className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-black text-ink">Check your inbox</h1>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
              It expires in 1 hour.
            </p>
            <p className="mt-3 text-xs text-ink/50">
              Didn&apos;t get it? Check spam, or{" "}
              <button onClick={() => setSent(false)} className="font-bold text-civic underline">
                try another address
              </button>
              .
            </p>
            <Link href="/login" className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-civic">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 className="text-2xl font-black leading-tight text-ink">Forgot your password?</h1>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              Enter your email and we&apos;ll send you a link to set a new one.
            </p>

            <label className="mt-6 block text-sm font-bold text-ink" htmlFor="fp-email">
              Email
            </label>
            <input
              id="fp-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              {pending ? "Sending..." : "Send reset link"}
            </button>

            <p className="mt-4 text-center text-sm text-ink/65">
              Remembered it?{" "}
              <Link href="/login" className="font-bold text-civic">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
