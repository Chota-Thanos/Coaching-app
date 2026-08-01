/**
 * Mint, list and revoke machine API keys.
 *
 * Deliberately a CLI rather than an admin UI: the only consumer today is the
 * local posting agent, and a key that never renders in a browser is a key that
 * cannot leak through one.
 *
 *   npm run api:key -- create <user-email> "<label>" [--days 365]
 *   npm run api:key -- list [user-email]
 *   npm run api:key -- revoke <key-prefix>
 *
 * The secret is printed exactly once, at creation.
 */
import "dotenv/config";
import { one, pool } from "../db.js";
import { createApiKey, listApiKeys, revokeApiKey } from "../modules/auth/api-keys.service.js";

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function findUser(email: string): Promise<{ id: number; email: string; role: string }> {
  const user = await one<{ id: number; email: string; role: string }>(
    `select id, email, role from app.users where lower(email) = lower($1)`,
    [email]
  );
  if (!user) fail(`No user with email "${email}".`);
  return user;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "create": {
      const [email, label] = args;
      if (!email || !label) fail(`Usage: api:key -- create <user-email> "<label>" [--days 365]`);

      const daysFlag = args.indexOf("--days");
      const days = daysFlag >= 0 ? Number(args[daysFlag + 1]) : null;
      if (daysFlag >= 0 && (!Number.isFinite(days) || (days as number) <= 0)) {
        fail("--days must be a positive number.");
      }

      const user = await findUser(email);
      if (!["admin", "moderator", "content_editor"].includes(user.role)) {
        console.warn(
          `\n  Warning: ${user.email} has role "${user.role}". The key will inherit exactly ` +
            `that role, so admin-only endpoints will still return 403.`
        );
      }

      const expiresAt = days ? new Date(Date.now() + days * 86_400_000) : null;
      const { record, key } = await createApiKey({
        userId: user.id,
        name: label,
        expiresAt
      });

      console.log(`
  API key created — copy it now, it is not recoverable.

    key      ${key}
    label    ${record.name}
    user     ${user.email} (role: ${user.role})
    prefix   ${record.key_prefix}
    expires  ${expiresAt ? expiresAt.toISOString() : "never"}

  Use it as either header:
    X-Api-Key: ${key}
    Authorization: Bearer ${key}
`);
      break;
    }

    case "list": {
      const email = args[0];
      const user = email ? await findUser(email) : null;
      const keys = await listApiKeys(user?.id);
      if (keys.length === 0) {
        console.log("\n  No API keys.\n");
        break;
      }
      console.log("");
      for (const k of keys) {
        const state = k.revoked_at
          ? "REVOKED"
          : k.expires_at && k.expires_at < new Date()
            ? "EXPIRED"
            : "active";
        console.log(
          `  ${k.key_prefix}  ${state.padEnd(8)}  user:${k.user_id}  ` +
            `last used: ${k.last_used_at ? k.last_used_at.toISOString() : "never"}  ${k.name}`
        );
      }
      console.log("");
      break;
    }

    case "revoke": {
      const prefix = args[0];
      if (!prefix) fail("Usage: api:key -- revoke <key-prefix>");
      const revoked = await revokeApiKey(prefix);
      console.log(revoked ? `\n  Revoked ${prefix}.\n` : `\n  No active key with prefix ${prefix}.\n`);
      break;
    }

    default:
      fail(`Unknown command "${command ?? ""}". Expected: create | list | revoke`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
