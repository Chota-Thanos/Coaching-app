"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { browserBaseUrl } from "../../lib/api";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState("");
  // React 18 StrictMode double-invokes effects in dev; the token is single-use,
  // so guard against firing the request twice.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("This page needs a verification link from your email.");
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;

    (async () => {
      try {
        const res = await fetch(`${browserBaseUrl}/api/v1/auth/verify-email/confirm`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ token })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState("error");
          setMessage(data?.message ?? "This verification link is invalid or has expired.");
          return;
        }
        setState("ok");
      } catch {
        setState("error");
        setMessage("Something went wrong. Please try again.");
      }
    })();
  }, [token]);

  return (
    <div className="w-full rounded-lg border border-line bg-surface p-6 text-center shadow-sm">
      {state === "pending" && (
        <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-civic" />
          <h1 className="mt-4 text-xl font-black text-ink">Verifying your email…</h1>
        </>
      )}

      {state === "ok" && (
        <>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-black text-ink">Email verified</h1>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Thanks — your address is confirmed and your account is fully secured.
          </p>
          <Link
            href="/assessment/dashboard"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-civic px-5 text-sm font-black text-white"
          >
            Go to dashboard
          </Link>
        </>
      )}

      {state === "error" && (
        <>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-berry/10 text-berry">
            <XCircle className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-black text-ink">Verification failed</h1>
          <p className="mt-2 text-sm leading-6 text-ink/65">{message}</p>
          <p className="mt-4 text-xs text-ink/50">
            Signed in? You can request a fresh link from your{" "}
            <Link href="/account" className="font-bold text-civic underline">
              account settings
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-md items-center px-4 py-10">
      <Suspense
        fallback={
          <div className="w-full rounded-lg border border-line bg-surface p-6 text-sm text-ink/70 shadow-sm">
            Loading…
          </div>
        }
      >
        <VerifyEmailInner />
      </Suspense>
    </main>
  );
}
