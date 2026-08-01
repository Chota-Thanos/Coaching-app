import crypto from "node:crypto";
import { one, query } from "../../db.js";
import type { AuthUser } from "./schemas.js";
import { getUserById } from "./service.js";

/**
 * Long-lived machine credentials for automation that runs outside a browser
 * (the local posting agent / MCP server).
 *
 * A key authenticates *as an existing user*, so it inherits that account's role
 * and every existing guard keeps working — it is deliberately not a parallel
 * permission system. Only the SHA-256 hash of the secret is stored; the raw key
 * is returned exactly once, at creation.
 *
 * Wire format: `wtia_<prefix>_<secret>`. The prefix is a public, indexed lookup
 * handle so verification is one row read plus one constant-time compare, rather
 * than hashing against every key in the table.
 */

const KEY_NAMESPACE = "wtia";
const PREFIX_BYTES = 6; // 12 hex chars
const SECRET_BYTES = 24; // 48 hex chars

export interface ApiKeyRecord {
  id: number;
  user_id: number;
  name: string;
  key_prefix: string;
  scopes: string[] | null;
  last_used_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/** Constant-time compare that also tolerates length mismatches without throwing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isApiKey(candidate: string): boolean {
  return candidate.startsWith(`${KEY_NAMESPACE}_`);
}

export interface CreatedApiKey {
  record: ApiKeyRecord;
  /** Shown once. Never recoverable afterwards. */
  key: string;
}

export async function createApiKey(params: {
  userId: number;
  name: string;
  scopes?: string[] | null;
  expiresAt?: Date | null;
}): Promise<CreatedApiKey> {
  const prefix = crypto.randomBytes(PREFIX_BYTES).toString("hex");
  const secret = crypto.randomBytes(SECRET_BYTES).toString("hex");

  const record = await one<ApiKeyRecord>(
    `insert into app.api_keys (user_id, name, key_prefix, key_hash, scopes, expires_at)
     values ($1, $2, $3, $4, $5, $6)
     returning id, user_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at`,
    [
      params.userId,
      params.name,
      prefix,
      hashSecret(secret),
      params.scopes ?? null,
      params.expiresAt ?? null
    ]
  );
  if (!record) throw new Error("Failed to create API key.");

  return { record, key: `${KEY_NAMESPACE}_${prefix}_${secret}` };
}

export async function listApiKeys(userId?: number): Promise<ApiKeyRecord[]> {
  return query<ApiKeyRecord>(
    `select id, user_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at
       from app.api_keys
      where ($1::bigint is null or user_id = $1)
      order by created_at desc`,
    [userId ?? null]
  );
}

export async function revokeApiKey(keyPrefix: string): Promise<boolean> {
  const revoked = await query(
    `update app.api_keys set revoked_at = now()
      where key_prefix = $1 and revoked_at is null
      returning id`,
    [keyPrefix]
  );
  return revoked.length > 0;
}

/**
 * Resolves a raw key to the user it authenticates as, or null if the key is
 * malformed, unknown, revoked, expired, or belongs to a deactivated account.
 *
 * Returns null rather than throwing so callers can fall through to other auth
 * schemes and produce a single uniform 401.
 */
export async function resolveApiKey(raw: string): Promise<AuthUser | null> {
  const parts = raw.split("_");
  if (parts.length !== 3) return null;
  const [namespace, prefix, secret] = parts;
  if (namespace !== KEY_NAMESPACE || !prefix || !secret) return null;

  const record = await one<{ id: number; user_id: number; key_hash: string }>(
    `select id, user_id, key_hash
       from app.api_keys
      where key_prefix = $1
        and revoked_at is null
        and (expires_at is null or expires_at > now())`,
    [prefix]
  );
  if (!record) return null;
  if (!safeEqual(record.key_hash, hashSecret(secret))) return null;

  const user = await getUserById(record.user_id);
  if (!user || !user.is_active) return null;

  // Best-effort usage stamp — a failure here must not break the request.
  void query(`update app.api_keys set last_used_at = now() where id = $1`, [record.id]).catch(
    () => undefined
  );

  return user;
}
