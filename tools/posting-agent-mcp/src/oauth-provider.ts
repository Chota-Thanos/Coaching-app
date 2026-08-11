/**
 * A minimal, real OAuth 2.1 authorization server for this connector — the
 * identity/login layer some clients (Gemini's "custom connected apps," for
 * one) require before they'll add a remote MCP server at all. The MCP SDK
 * supplies the protocol machinery (PKCE, discovery, dynamic client
 * registration, token exchange — see http-server.ts's use of
 * `mcpAuthRouter`); this file supplies WHO is allowed to log in.
 *
 * Deliberately not a second user system. "Login" here is a direct call to
 * this app's own `POST /api/v1/auth/login` — the exact endpoint the real
 * website uses — so there is exactly one password database and one place
 * password rules and email verification live. This file trusts none of that
 * itself, only the response, and then checks the returned role against the
 * same allow-list (`admin`, `moderator`, `content_editor`) the website's own
 * `requireAdminOrEditor` guard uses.
 *
 * Storage is in-memory (Maps), not a database table. A process restart (a
 * deploy) invalidates every issued code/token, so an already-connected
 * client would need to click through the login once more. That's a
 * deliberate trade for a low-traffic, single-admin tool — persisting this
 * would mean a new migration on the main app's schema, or a second local
 * datastore, for a problem that in practice means "log in again after a
 * deploy," which is rare and cheap. Worth revisiting only if that becomes
 * genuinely annoying.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type { Response } from "express";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

/** Same allow-list the website's own admin/editor routes already use. */
const ALLOWED_ROLES = new Set(["admin", "moderator", "content_editor"]);

const CODE_TTL_MS = 5 * 60 * 1000; // must be exchanged for a token quickly
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

interface PendingCode {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
  createdAt: number;
  userEmail: string;
}

interface AccessTokenRecord {
  clientId: string;
  scopes: string[];
  expiresAt: number; // seconds since epoch — matches the AuthInfo contract
  resource?: URL;
  userEmail: string;
}

interface RefreshTokenRecord {
  clientId: string;
  scopes: string[];
  expiresAt: number; // milliseconds since epoch
  resource?: URL;
  userEmail: string;
  revoked: boolean;
}

export class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private readonly clients = new Map<string, OAuthClientInformationFull>();

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return this.clients.get(clientId);
  }

  /**
   * The router (handlers/register.js) already generated client_id,
   * client_id_issued_at and client_secret before calling this — we only
   * need to remember what it hands us and return it back.
   */
  async registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
  ): Promise<OAuthClientInformationFull> {
    const full = client as OAuthClientInformationFull;
    this.clients.set(full.client_id, full);
    return full;
  }
}

/** Calls this app's own login endpoint — the one real password check that exists. */
async function verifyWebsiteLogin(
  apiUrl: string,
  email: string,
  password: string,
): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  let res: globalThis.Response;
  try {
    res = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, reason: "Could not reach the website to check your login. Try again in a moment." };
  }

  if (!res.ok) {
    return { ok: false, reason: "Incorrect email or password." };
  }

  const body = (await res.json()) as { user?: { email: string; role: string } };
  if (!body.user || !ALLOWED_ROLES.has(body.user.role)) {
    return { ok: false, reason: "That account doesn't have permission to post or edit content." };
  }

  return { ok: true, email: body.user.email };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders the login form itself. All the original OAuth request parameters
 * travel as hidden fields — they are public request parameters to begin
 * with (this is exactly what a browser's own query string already carried),
 * not secrets, so round-tripping them through the form is safe. This is
 * what lets `/mcp-oauth/login` (a plain Express route with real access to
 * `req.body`, unlike this file's `authorize()` callback) reconstruct the
 * original request after the user submits their credentials.
 */
function renderLoginPage(options: {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
  error?: string;
}): string {
  const { client, params, error } = options;
  const appName = client.client_name?.trim() || client.client_id;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in — WayToIAS</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #f8f7f4; margin: 0;
         display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  .card { background: #fff; border: 1px solid #e5e2da; border-radius: 12px; padding: 2rem;
          width: 100%; max-width: 380px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
  p.sub { color: #6b6558; font-size: 0.875rem; margin: 0 0 1.5rem; }
  label { display: block; font-size: 0.8rem; font-weight: 600; margin: 1rem 0 0.25rem; }
  input[type=email], input[type=password] {
    width: 100%; box-sizing: border-box; padding: 0.6rem 0.75rem; border: 1px solid #d8d4c8;
    border-radius: 8px; font-size: 0.95rem;
  }
  button { margin-top: 1.5rem; width: 100%; padding: 0.7rem; background: #1f2937; color: #fff;
           border: none; border-radius: 8px; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
  button:hover { background: #111827; }
  .error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.6rem 0.75rem;
           border-radius: 8px; font-size: 0.85rem; margin-bottom: 1rem; }
</style>
</head>
<body>
  <div class="card">
    <h1>Sign in to WayToIAS</h1>
    <p class="sub">${escapeHtml(appName)} is asking to connect on your behalf. Use your admin/editor account.</p>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <form method="POST" action="/mcp-oauth/login">
      <input type="hidden" name="client_id" value="${escapeHtml(client.client_id)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}">
      <input type="hidden" name="state" value="${escapeHtml(params.state ?? "")}">
      <input type="hidden" name="scope" value="${escapeHtml((params.scopes ?? []).join(" "))}">
      <input type="hidden" name="resource" value="${escapeHtml(params.resource?.href ?? "")}">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autofocus>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required>
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`;
}

export class WebsiteOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new InMemoryClientsStore();

  private readonly codes = new Map<string, PendingCode>();
  private readonly accessTokens = new Map<string, AccessTokenRecord>();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();

  constructor(private readonly apiUrl: string) {}

  /**
   * Called by the SDK's /authorize handler once client_id, redirect_uri and
   * the PKCE parameters are already validated. This always renders the
   * login form rather than ever issuing a code directly — the real
   * credential check happens in the separate `/mcp-oauth/login` POST route
   * registered in http-server.ts, because THIS callback's signature only
   * receives `res`, not the request body a submitted login form needs.
   */
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderLoginPage({ client, params }));
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const pending = this.codes.get(authorizationCode);
    if (!pending || pending.client.client_id !== client.client_id) {
      throw new Error("Invalid or expired authorization code.");
    }
    return pending.params.codeChallenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens> {
    const pending = this.codes.get(authorizationCode);
    if (!pending) throw new Error("Invalid or expired authorization code.");
    if (pending.client.client_id !== client.client_id) {
      throw new Error("This authorization code was not issued to this client.");
    }
    // Single-use, and only ever valid briefly — matches the login form's
    // hidden fields having no purpose beyond that one round trip.
    this.codes.delete(authorizationCode);
    if (Date.now() - pending.createdAt > CODE_TTL_MS) {
      throw new Error("Authorization code expired — please sign in again.");
    }

    return this.issueTokens(client.client_id, pending.params.scopes ?? [], pending.params.resource, pending.userEmail);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const record = this.refreshTokens.get(refreshToken);
    if (!record || record.revoked) throw new Error("Invalid or revoked refresh token.");
    if (record.clientId !== client.client_id) {
      throw new Error("This refresh token was not issued to this client.");
    }
    if (record.expiresAt < Date.now()) {
      this.refreshTokens.delete(refreshToken);
      throw new Error("Refresh token expired — please sign in again.");
    }

    // Reused rather than rotated, for simplicity — a real theft-detection
    // scheme would rotate and burn the old one; not worth the complexity for
    // a single-admin tool where the token never leaves the client + server.
    return this.issueTokens(
      client.client_id,
      scopes ?? record.scopes,
      resource ?? record.resource,
      record.userEmail,
      refreshToken,
    );
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = this.accessTokens.get(token);
    if (!record) throw new Error("Invalid access token.");
    if (record.expiresAt < Date.now() / 1000) {
      this.accessTokens.delete(token);
      throw new Error("Access token expired.");
    }
    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
      resource: record.resource,
    };
  }

  /** RFC 7009: revoking an unknown or already-revoked token is still success. */
  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    const access = this.accessTokens.get(request.token);
    if (access && access.clientId === client.client_id) this.accessTokens.delete(request.token);

    const refresh = this.refreshTokens.get(request.token);
    if (refresh && refresh.clientId === client.client_id) refresh.revoked = true;
  }

  // ── Used only by the /mcp-oauth/login route in http-server.ts ──────────

  /** The one real credential check in this whole file. */
  async checkLogin(email: string, password: string) {
    return verifyWebsiteLogin(this.apiUrl, email, password);
  }

  renderLoginPage(client: OAuthClientInformationFull, params: AuthorizationParams, error?: string): string {
    return renderLoginPage({ client, params, error });
  }

  issueAuthorizationCode(client: OAuthClientInformationFull, params: AuthorizationParams, userEmail: string): string {
    const code = randomUUID();
    this.codes.set(code, { client, params, createdAt: Date.now(), userEmail });
    return code;
  }

  private issueTokens(
    clientId: string,
    scopes: string[],
    resource: URL | undefined,
    userEmail: string,
    reuseRefreshToken?: string,
  ): OAuthTokens {
    const accessToken = randomBytes(32).toString("hex");
    const expiresAtSeconds = Math.floor((Date.now() + ACCESS_TOKEN_TTL_MS) / 1000);
    this.accessTokens.set(accessToken, { clientId, scopes, expiresAt: expiresAtSeconds, resource, userEmail });

    const refreshToken = reuseRefreshToken ?? randomBytes(32).toString("hex");
    if (!reuseRefreshToken) {
      this.refreshTokens.set(refreshToken, {
        clientId,
        scopes,
        expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
        resource,
        userEmail,
        revoked: false,
      });
    }

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    };
  }
}
