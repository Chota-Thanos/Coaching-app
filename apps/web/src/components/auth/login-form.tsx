"use client";

import { ArrowRight, CheckCircle2, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-context";
import { GoogleSignInButton } from "./google-signin-button";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/assessment/dashboard";
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nextPath = safeNextPath(searchParams.get("next"));

  if (user) {
    return (
      <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-civic" />
          <div>
            <h1 className="text-xl font-black text-ink">You are signed in</h1>
            <p className="mt-1 text-sm leading-6 text-ink/65">Continue to your dashboard or browse tests.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link className="inline-flex h-12 items-center justify-center rounded-md bg-civic px-4 text-sm font-black text-white" href="/assessment/dashboard">
            Dashboard
          </Link>
          <Link className="inline-flex h-12 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink" href="/assessment/tests">
            Browse tests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="rounded-lg border border-line bg-white p-5 shadow-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setPending(true);
        try {
          await login(email, password);
          router.push(nextPath);
        } catch {
          setError("Invalid email or password.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-civic/10 text-civic">
          <LogIn aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-black leading-tight text-ink">Sign in</h1>
          <p className="text-sm leading-6 text-ink/65">Continue attempts, review results, and manage your Notes Space.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <div>
          <label className="block text-sm font-bold text-ink" htmlFor="login-email">Email</label>
          <input
            autoComplete="email"
            className="mt-1 h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
            id="login-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-ink" htmlFor="login-password">Password</label>
          <input
            autoComplete="current-password"
            className="mt-1 h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
            id="login-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
      </div>

      {error && <p className="mt-4 rounded-md border border-berry/20 bg-berry/5 px-3 py-2 text-sm font-semibold text-berry">{error}</p>}

      <button
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-black text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in..." : "Sign in"}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-line" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-ink/50 font-semibold">Or continue with</span>
        </div>
      </div>

      <GoogleSignInButton nextPath={nextPath} />

      <p className="mt-4 text-center text-sm text-ink/65">
        New student?{" "}
        <Link className="font-bold text-civic" href={`/register?next=${encodeURIComponent(nextPath)}`}>
          Create account
        </Link>
      </p>
    </form>
  );
}
