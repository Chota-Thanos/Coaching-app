"use client";

import { ArrowRight, CheckCircle2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-context";
import { GoogleSignInButton } from "./google-signin-button";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/assessment/dashboard";
  return value;
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, user } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nextPath = safeNextPath(searchParams.get("next"));

  if (user) {
    return (
      <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-civic" />
          <div>
            <h1 className="text-xl font-black text-ink">You are signed in</h1>
            <p className="mt-1 text-sm leading-6 text-ink/65">Continue to your assessment dashboard or browse tests.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link className="inline-flex h-12 items-center justify-center rounded-md bg-civic px-4 text-sm font-black text-white" href="/assessment/dashboard">
            Dashboard
          </Link>
          <Link className="inline-flex h-12 items-center justify-center rounded-md border border-line bg-surface px-4 text-sm font-black text-ink" href="/assessment/tests">
            Browse tests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="rounded-lg border border-line bg-surface p-5 shadow-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);

        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 3) {
          setError("Username must be at least 3 characters.");
          return;
        }
        if (trimmedUsername.length > 50) {
          setError("Username must be at most 50 characters.");
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
          setError("Username can only contain letters, numbers, and underscores.");
          return;
        }

        if (password.length < 8) {
          setError("Password must be at least 8 characters.");
          return;
        }
        if (password.length > 200) {
          setError("Password must be at most 200 characters.");
          return;
        }
        if (!/[A-Z]/.test(password)) {
          setError("Password must contain at least one uppercase letter.");
          return;
        }
        if (!/[a-z]/.test(password)) {
          setError("Password must contain at least one lowercase letter.");
          return;
        }
        if (!/[0-9]/.test(password)) {
          setError("Password must contain at least one number.");
          return;
        }
        if (!/[^A-Za-z0-9]/.test(password)) {
          setError("Password must contain at least one special character.");
          return;
        }

        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        setPending(true);
        try {
          await register({ email, username: trimmedUsername, password });
          router.push(nextPath);
        } catch (err: any) {
          setError(err instanceof Error ? err.message : "Registration failed. Try another email or username.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-civic/10 text-civic">
          <UserPlus aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-black leading-tight text-ink">Create account</h1>
          <p className="text-sm leading-6 text-ink/65">Start attempts, save progress, and review performance.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <div>
          <label className="block text-sm font-bold text-ink" htmlFor="register-email">Email</label>
          <input
            autoComplete="email"
            className="mt-1 h-12 w-full rounded-md border border-line bg-surface px-3 text-base outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
            id="register-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-ink" htmlFor="register-username">Username</label>
          <input
            autoComplete="username"
            className="mt-1 h-12 w-full rounded-md border border-line bg-surface px-3 text-base outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
            id="register-username"
            maxLength={50}
            minLength={3}
            onChange={(event) => setUsername(event.target.value)}
            pattern="[a-zA-Z0-9_]+"
            required
            type="text"
            value={username}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-ink" htmlFor="register-password">Password</label>
          <input
            autoComplete="new-password"
            className="mt-1 h-12 w-full rounded-md border border-line bg-surface px-3 text-base outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
            id="register-password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <p className="mt-1.5 text-xs text-ink/60">
            Must be 8-200 characters with at least one uppercase letter, one lowercase letter, one number, and one special character.
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold text-ink" htmlFor="register-confirm-password">Confirm password</label>
          <input
            autoComplete="new-password"
            className="mt-1 h-12 w-full rounded-md border border-line bg-surface px-3 text-base outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
            id="register-confirm-password"
            minLength={8}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </div>
      </div>

      {error && <p className="mt-4 rounded-md border border-berry/20 bg-berry/5 px-3 py-2 text-sm font-semibold text-berry">{error}</p>}

      <button
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-black text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Creating account..." : "Create account"}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-line" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-surface px-2 text-ink/50 font-semibold">Or continue with</span>
        </div>
      </div>

      <GoogleSignInButton nextPath={nextPath} />

      <p className="mt-4 text-center text-sm text-ink/65">
        Already registered?{" "}
        <Link className="font-bold text-civic" href={`/login?next=${encodeURIComponent(nextPath)}`}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
