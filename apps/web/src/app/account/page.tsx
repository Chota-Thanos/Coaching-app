"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, authenticatedPost } from "../../components/auth/auth-context";
import { BadgeCheck, AlertTriangle, KeyRound, Mail, CreditCard } from "lucide-react";

export default function AccountPage() {
  const router = useRouter();
  const { user, token, isInitialized } = useAuth();

  const [sendingVerify, setSendingVerify] = useState(false);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  useEffect(() => {
    if (isInitialized && !user) router.push("/login?next=/account");
  }, [isInitialized, user, router]);

  const isGoogleAccount = false; // surfaced by the API on attempt; kept simple here

  const handleSendVerification = async () => {
    if (!token) return;
    setSendingVerify(true);
    setVerifyNote(null);
    try {
      const res = await authenticatedPost<{ sent: boolean; reason: string | null }>(
        "/api/v1/auth/verify-email/send",
        token,
        {}
      );
      if (res.sent) {
        setVerifyNote("Verification email sent — check your inbox.");
      } else if (res.reason === "already_verified") {
        setVerifyNote("This address is already verified.");
      } else if (res.reason === "smtp_not_configured") {
        setVerifyNote("Email sending isn't configured on the server yet. Contact support.");
      } else {
        setVerifyNote("Couldn't send the email right now. Please try again later.");
      }
    } catch (err: any) {
      setVerifyNote(err.message ?? "Failed to send verification email.");
    } finally {
      setSendingVerify(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwOk(false);

    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords don't match.");
      return;
    }

    setChanging(true);
    try {
      await authenticatedPost("/api/v1/auth/change-password", token!, {
        current_password: currentPassword,
        new_password: newPassword
      });
      setPwOk(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwError(err.message ?? "Couldn't change your password.");
    } finally {
      setChanging(false);
    }
  };

  if (!isInitialized || !user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-ink/60">Loading account…</main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-ink">Account settings</h1>
      <p className="mt-1 text-sm text-ink/65">Manage your sign-in details and security.</p>

      {/* Profile summary */}
      <section className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-base font-black text-ink">Profile</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between border-b border-line/60 pb-2">
            <dt className="font-bold text-ink/60">Username</dt>
            <dd className="font-semibold text-ink">{user.username}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <dt className="font-bold text-ink/60">Email</dt>
            <dd className="flex items-center gap-2 font-semibold text-ink">
              {user.email}
              {user.email_verified_at ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  <BadgeCheck className="h-3 w-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> Unverified
                </span>
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-bold text-ink/60">Role</dt>
            <dd className="font-semibold capitalize text-ink">{user.role}</dd>
          </div>
        </dl>

        {!user.email_verified_at && (
          <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <Mail className="h-4 w-4" /> Confirm your email address
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Verifying your email secures your account and lets you recover it if you forget your password.
            </p>
            <button
              onClick={handleSendVerification}
              disabled={sendingVerify}
              className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {sendingVerify ? "Sending…" : "Send verification email"}
            </button>
            {verifyNote && <p className="mt-2 text-xs font-semibold text-amber-900">{verifyNote}</p>}
          </div>
        )}
      </section>

      {/* Password */}
      <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-black text-ink">
          <KeyRound className="h-4 w-4 text-civic" /> Change password
        </h2>

        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-bold text-ink" htmlFor="cur-pw">
              Current password
            </label>
            <input
              id="cur-pw"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-ink" htmlFor="new-pw">
                New password
              </label>
              <input
                id="new-pw"
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink" htmlFor="confirm-pw">
                Confirm new password
              </label>
              <input
                id="confirm-pw"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
              />
            </div>
          </div>

          {pwError && (
            <p className="rounded-md border border-berry/20 bg-berry/5 px-3 py-2 text-sm font-semibold text-berry">
              {pwError}
            </p>
          )}
          {pwOk && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              Password updated successfully.
            </p>
          )}

          <button
            type="submit"
            disabled={changing}
            className="h-11 rounded-md bg-civic px-6 text-sm font-black text-white disabled:opacity-60"
          >
            {changing ? "Updating…" : "Update password"}
          </button>
        </form>

        <p className="mt-4 text-xs text-ink/50">
          Signed in with Google? Your account has no password — keep using the Google button.
        </p>
      </section>

      {/* Billing shortcut */}
      <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-black text-ink">
          <CreditCard className="h-4 w-4 text-civic" /> Billing
        </h2>
        <p className="mt-1 text-sm text-ink/65">
          View your subscriptions, mentorship sessions and full payment history.
        </p>
        <Link
          href="/dashboard/purchases"
          className="mt-4 inline-flex h-11 items-center rounded-md border border-line bg-surface px-5 text-sm font-black text-ink hover:bg-slate-50"
        >
          Go to My Purchases
        </Link>
      </section>
    </main>
  );
}
