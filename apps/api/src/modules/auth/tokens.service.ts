import crypto from "node:crypto";
import { one, query } from "../../db.js";

/**
 * Single-use tokens for email verification and password reset.
 *
 * Only the SHA-256 hash is persisted — the raw token exists solely in the email
 * we send. A leaked database dump therefore can't be replayed to take over
 * accounts, which matters more here than usual since these tokens bypass the
 * password entirely.
 */

export type TokenPurpose = "email_verification" | "password_reset";

const TTL_MS: Record<TokenPurpose, number> = {
  email_verification: 24 * 60 * 60 * 1000, // 24 hours
  password_reset: 60 * 60 * 1000 // 1 hour
};

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue a token, invalidating any outstanding ones for the same purpose so an
 * older link in a previous email can't still be used.
 */
export async function issueToken(userId: number, purpose: TokenPurpose): Promise<string> {
  await query(
    `update app.auth_tokens set consumed_at = now()
     where user_id = $1 and purpose = $2 and consumed_at is null`,
    [userId, purpose]
  );

  const raw = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS[purpose]);

  await one(
    `insert into app.auth_tokens (user_id, purpose, token_hash, expires_at)
     values ($1, $2, $3, $4)
     returning id`,
    [userId, purpose, hashToken(raw), expiresAt]
  );

  return raw;
}

/**
 * Atomically consume a token. Returns the owning user id, or null when the
 * token is unknown, already used, or expired. The update-with-guard means a
 * concurrent double-submit can only succeed once.
 */
export async function consumeToken(raw: string, purpose: TokenPurpose): Promise<number | null> {
  const row = await one<{ user_id: string }>(
    `update app.auth_tokens
     set consumed_at = now()
     where token_hash = $1
       and purpose = $2
       and consumed_at is null
       and expires_at > now()
     returning user_id`,
    [hashToken(raw), purpose]
  );
  return row ? Number(row.user_id) : null;
}

/** Housekeeping: drop tokens that expired more than a week ago. */
export async function purgeExpiredTokens(): Promise<void> {
  await query(`delete from app.auth_tokens where expires_at < now() - interval '7 days'`);
}
