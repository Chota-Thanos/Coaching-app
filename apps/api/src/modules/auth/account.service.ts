import { config } from "../../config.js";
import { one, query } from "../../db.js";
import { passwordResetEmail, sendMail, verificationEmail } from "../../common/mailer.js";
import { hashPassword, verifyPassword } from "./password.js";
import { consumeToken, issueToken } from "./tokens.service.js";

/**
 * Email verification, password reset and password change.
 *
 * Design notes:
 *  - Nothing here reveals whether an email exists (no user enumeration): the
 *    "forgot password" endpoint always reports success.
 *  - A failed email send never fails the caller's operation. Email delivery is
 *    best-effort infrastructure; an unverified address is recoverable, a 500 on
 *    registration is not.
 */

type UserRow = {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  email_verified_at: string | null;
};

function webUrl(path: string): string {
  return `${config.PUBLIC_WEB_URL.replace(/\/+$/, "")}${path}`;
}

/** Issue a verification token and email it. Safe to call repeatedly. */
export async function sendVerificationEmail(
  userId: number
): Promise<{ sent: boolean; reason?: string }> {
  const user = await one<UserRow>(
    `select id, email, username, password_hash, email_verified_at from app.users where id = $1`,
    [userId]
  );
  if (!user) return { sent: false, reason: "user_not_found" };
  if (user.email_verified_at) return { sent: false, reason: "already_verified" };

  const token = await issueToken(userId, "email_verification");
  const url = webUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const mail = verificationEmail(user.username, url);
  const result = await sendMail({ to: user.email, subject: mail.subject, html: mail.html });
  return { sent: result.delivered, reason: result.reason };
}

/** Consume a verification token and mark the address verified. */
export async function confirmEmailVerification(
  token: string
): Promise<{ ok: boolean; reason?: string }> {
  const userId = await consumeToken(token, "email_verification");
  if (!userId) return { ok: false, reason: "invalid_or_expired" };

  await query(
    `update app.users set email_verified_at = now(), updated_at = now() where id = $1`,
    [userId]
  );
  return { ok: true };
}

/**
 * Start a password reset. Always resolves successfully, regardless of whether
 * the address exists, so this endpoint can't be used to enumerate accounts.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await one<UserRow>(
    `select id, email, username, password_hash, email_verified_at
     from app.users where lower(email) = lower($1) and is_active = true`,
    [email]
  );
  if (!user) return;

  // Google-only accounts have no usable password; sending a reset would be
  // confusing. They should keep signing in with Google.
  if (user.password_hash === "google-oauth") return;

  const token = await issueToken(Number(user.id), "password_reset");
  const url = webUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const mail = passwordResetEmail(user.username, url);
  await sendMail({ to: user.email, subject: mail.subject, html: mail.html });
}

/** Consume a reset token and set the new password. */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ ok: boolean; reason?: string }> {
  const userId = await consumeToken(token, "password_reset");
  if (!userId) return { ok: false, reason: "invalid_or_expired" };

  const passwordHash = await hashPassword(newPassword);
  await query(
    `update app.users set password_hash = $1, updated_at = now() where id = $2`,
    [passwordHash, userId]
  );
  return { ok: true };
}

/** Change password for an already-authenticated user. */
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; reason?: string }> {
  const user = await one<UserRow>(
    `select id, email, username, password_hash, email_verified_at from app.users where id = $1`,
    [userId]
  );
  if (!user) return { ok: false, reason: "user_not_found" };

  if (user.password_hash === "google-oauth") {
    return { ok: false, reason: "google_account" };
  }
  if (!(await verifyPassword(currentPassword, user.password_hash))) {
    return { ok: false, reason: "wrong_password" };
  }

  const passwordHash = await hashPassword(newPassword);
  await query(
    `update app.users set password_hash = $1, updated_at = now() where id = $2`,
    [passwordHash, userId]
  );
  return { ok: true };
}
