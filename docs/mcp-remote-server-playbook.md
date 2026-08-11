# Playbook: hosting a remote MCP server, with real OAuth login

Everything learned building this for WayToIAS — reusable when adding the
same capability (an AI assistant can post/edit content over the internet,
not just from a local machine) to another app. Written to be portable: the
concrete examples are from `tools/posting-agent-mcp/`, but nothing here is
WayToIAS-specific in principle.

Companion docs for the actual WayToIAS deployment: [`claude-mcp-connection.md`](claude-mcp-connection.md),
[`connecting-other-ai-assistants.md`](connecting-other-ai-assistants.md).

---

## 1. The shape of the problem

A local-only MCP server (stdio transport, spawned as a child process by
Claude Desktop, Cursor, etc.) is safe by an accident of geometry: the only
thing standing between an attacker and whatever the server can do is that
they'd need to be *on the machine running it*. The moment it listens on a
public port, that protection is gone, and something explicit has to replace
it. Everything in this doc follows from that one fact.

Two separate problems, both real:

1. **Transport** — stdio doesn't work for a client that isn't running on the
   same machine. Needs Streamable HTTP instead.
2. **Auth** — some clients let you paste a bearer token into their config;
   others (Gemini's "custom connected apps," and most consumer-facing
   "connect an app" UIs) only offer a sign-in flow and require real OAuth.
   Build for **both** from the start — they're not exclusive, and which one
   a given client needs isn't something you choose.

---

## 2. Prerequisites

- `@modelcontextprotocol/sdk` **^1.30.0 or later**. Check with:
  ```bash
  node -e "console.log(require('./node_modules/@modelcontextprotocol/sdk/package.json').version)"
  ```
  This version ships the full toolkit needed for both problems —
  `StreamableHTTPServerTransport`, and a complete OAuth 2.1 authorization
  server (PKCE, dynamic client registration, discovery, token exchange).
  **Don't hand-roll OAuth.** Read the SDK's own shipped reference
  implementation first:
  `node_modules/@modelcontextprotocol/sdk/dist/esm/examples/server/demoInMemoryOAuthProvider.js`
  — it shows every interface shape without guessing, and is explicitly
  marked "demo only" for exactly the two reasons this doc exists (no real
  login, no persistence).
- An existing reverse proxy (nginx or equivalent) already terminating HTTPS
  for the app. The new process binds to `127.0.0.1` on a free local port and
  is never itself internet-facing — the proxy is.
- A process manager already running the app's other long-lived processes
  (PM2, systemd, etc.) — the new HTTP server is a **third** process
  alongside the existing API and web servers, not a replacement for either.
- The app's own login endpoint and user/role model already exist. OAuth here
  reuses them; it does not create a second one.

---

## 3. Architecture: one tool registry, two transports

Don't let two transports mean two copies of your tool definitions. Split the
server into three files:

| File | Job |
|---|---|
| `server-factory.ts` | `export function createServer(): McpServer` — every `registerTool` call lives here, once |
| `index.ts` | stdio entry point: `createServer()`, connect over `StdioServerTransport`, done |
| `http-server.ts` | HTTP entry point: auth, routing, `createServer()` **per request** (stateless), connect over `StreamableHTTPServerTransport` |

**Stateless HTTP, deliberately**: a fresh `McpServer` + transport per
request, connected, used, and closed. This is the SDK's own reference
pattern for Streamable HTTP, and has the least session-management surface to
get wrong — no session store, no resumable-stream support, no state that
can leak between unrelated callers. The per-request cost (re-registering a
few dozen tools) is negligible; there's no I/O in registration itself.

If the existing server is one large file with tool registrations at module
scope, the refactor is mechanical: wrap everything after the imports in
`export function createServer(): McpServer { ... return server; }`, change
the old top-level `const server` to a function-local one, and update the old
entry point to call `createServer()` explicitly. Verify nothing changed
behaviourally by running the old stdio path afterward and confirming the
same tool count comes back.

---

## 4. Auth, layer one: a static bearer token

The simple case, and worth building first — it's what most developer-facing
clients (Cursor, ChatGPT custom Actions, anything that lets you paste a
config block) actually use.

- One long, random secret (`crypto.randomBytes(32).toString('hex')`), in an
  env var, checked on every request via `Authorization: Bearer <token>`.
- **Constant-time comparison** (`crypto.timingSafeEqual`), not `===` — a
  naive comparison leaks how many leading characters matched, via response
  timing, which matters for a secret guarding write access.
- **Fail loud at startup**, not silently insecure: refuse to start if the
  token is unset or shorter than a real secret should be (e.g. under 32
  characters). Don't let a missing env var quietly become "no auth."
- **Never let the remote caller supply their own underlying API
  credential.** One key, configured on the server, for one account. The
  bearer token (or the OAuth login, below) gates entry to using that one
  key — it is not a multi-tenant pass-through. Keeping this single-tenant
  is what keeps the rest of this simple; don't build more than the actual
  use case needs.
- Bind to `127.0.0.1`, never `0.0.0.0`, unless the process is independently
  firewalled. The reverse proxy is the only thing that should be reachable
  from outside the machine.
- Add an **unauthenticated health-check route** (`/health`, revealing only
  `{status: "ok"}`) so a deploy can be verified and uptime monitored without
  handing out the real secret to do it.

---

## 5. Auth, layer two: real OAuth 2.1

Needed the moment a client's UI only offers "Connect" or "Sign in," with no
field to paste a token into. Not optional if you want that class of client
to work at all — the alternative is nothing, not a smaller version.

### 5.1 Identity: reuse the app's own login, don't build a second one

The authorization server's `authorize()` implementation should call the
app's **real** login endpoint (`POST /api/.../auth/login` or equivalent)
with the submitted email/password, and check the returned role against
whatever role list already gates admin/editor access elsewhere in the app.
This file should trust *none* of the credential checking itself — only the
response. One password database, one place email verification and password
rules live.

### 5.2 The two bugs that will recur on every new app

These cost real debugging time here and are not obvious from the SDK's
types — write tests or checks for both, every time.

**Bug 1 — DNS-rebinding protection rejects every request behind a proxy.**
The SDK's `createMcpExpressApp()` helper includes Host-header validation
that defaults to accepting only `localhost` / `127.0.0.1`. Behind *any*
reverse proxy, the `Host:` header is the real public hostname (the proxy
forwards it as-is), so the default silently 403s every real request with
`"Invalid Host: <domain>"` — **before** it reaches your own auth check.
Local testing never surfaces this, because a direct local request
legitimately sends `Host: 127.0.0.1`.

Fix: pass `allowedHosts` explicitly, listing the real public domain(s):
```ts
createMcpExpressApp({ host, allowedHosts: ["yourdomain.com", "www.yourdomain.com", "127.0.0.1", "localhost"] })
```
**Test this by sending a request with `Host: yourdomain.com` against the
local build**, before ever deploying — that's what proves the fix, not
reading the code.

**Bug 2 — `mcpAuthRouter()`'s convenience wrapper hardcodes root paths.**
Its `/authorize`, `/token`, `/register`, `/revoke` are internally computed
as absolute paths (leading `/`), and `new URL('/x', base)` **discards
`base`'s own path component** — it doesn't append. So passing a `baseUrl`
with a path prefix (hoping to namespace these under e.g. `/mcp-oauth/`)
silently does nothing; they land at the domain root regardless.

This matters because **`/register` is very likely already a real page** —
almost every app with user accounts has a sign-up page at that exact path.
Namespacing under the convenience wrapper doesn't work; you have to mount
the four operational handlers individually, at paths you choose, and
hand-build the metadata object to match:

```ts
import { createOAuthMetadata, mcpAuthMetadataRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { authorizationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { clientRegistrationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/register.js";
import { revocationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/revoke.js";

const PREFIX = "/mcp-oauth"; // anything that isn't already a real route
const oauthMetadata = createOAuthMetadata({ provider, issuerUrl, scopesSupported });
oauthMetadata.authorization_endpoint = new URL(`${PREFIX}/authorize`, publicUrl).href;
oauthMetadata.token_endpoint         = new URL(`${PREFIX}/token`, publicUrl).href;
oauthMetadata.registration_endpoint  = new URL(`${PREFIX}/register`, publicUrl).href;
oauthMetadata.revocation_endpoint    = new URL(`${PREFIX}/revoke`, publicUrl).href;

// The two discovery endpoints genuinely must be at the domain root (RFC 8414 /
// RFC 9728) — this part of the SDK helper is used as-is, unprefixed.
app.use(mcpAuthMetadataRouter({ oauthMetadata, resourceServerUrl, scopesSupported }));

app.use(`${PREFIX}/authorize`, authorizationHandler({ provider }));
app.use(`${PREFIX}/token`, tokenHandler({ provider }));
app.use(`${PREFIX}/register`, clientRegistrationHandler({ clientsStore: provider.clientsStore }));
app.use(`${PREFIX}/revoke`, revocationHandler({ provider }));
```

**Before picking a prefix, grep the real app for collisions** — don't
assume. `/login` and `/register` are the two near-certain hits on any app
with accounts; check anyway:
```bash
grep -rn "location.*login\|location.*register" <web-app-routes-dir>
# or, for a route-per-folder framework:
find <web-app-routes-dir> -type d -iname "login" -o -iname "register"
```

### 5.3 The login-form round trip

The SDK's `provider.authorize(client, params, res)` callback receives `res`
but **not the request body** — so it can't itself process a submitted
login form. The correct shape is two pieces:

1. `authorize()` always renders an HTML login form (never issues a code
   directly). The original OAuth request parameters — `client_id`,
   `redirect_uri`, `code_challenge`, `state`, `scope` — go into the form as
   **hidden fields**. They're safe to round-trip this way; they're already
   public request parameters, not secrets.
2. A **separate, self-registered route** (e.g. `POST /mcp-oauth/login`,
   *not* going back through the SDK's own `/authorize` handler) receives the
   form submission, where `req.body` genuinely is available. It does the
   real login check, and on success calls `provider.issueAuthorizationCode()`
   and redirects to `redirect_uri?code=...&state=...` itself.

On this custom route, **re-validate `redirect_uri` against the client's
registered ones** — you're bypassing the SDK's own `/authorize` handler for
this leg, so its validation doesn't apply automatically. Reuse the SDK's own
`redirectUriMatches` (from `handlers/authorize.js`) rather than
re-implementing the RFC 8252 loopback-port relaxation by hand.

### 5.4 Storage: in-memory is a legitimate choice, not a shortcut — if you say so

For a low-traffic, single-admin tool, `Map()`s for clients / codes / access
tokens / refresh tokens are a reasonable, deliberate trade — **as long as
it's stated as one**, not left implicit. The real consequence: a process
restart (any deploy) invalidates every issued token, and a connected client
has to sign in again. That's cheap in practice for this class of tool.
Revisit only if it becomes genuinely annoying — persisting this means either
a new table on the main schema or a second local datastore, for a problem
that's usually just "log in again."

### 5.5 Security defaults worth carrying over verbatim

- Rate-limit the login route specifically, stricter than general traffic —
  it's the one place doing a real password check (in this build: 20
  attempts / 15 minutes, versus the SDK's own 100/15min default on
  `/authorize` itself).
- `/mcp` (or your actual tool-call endpoint) should accept **either**
  credential — the static bearer token or a verified OAuth access token —
  checked in that order (cheap check first). Adding OAuth is additive; the
  bearer-token path some clients already use must keep working unchanged.
  Verify this explicitly after adding OAuth, not just assume it: same
  bearer token, same request shape, before and after.
- Revocation matters even with short-lived access tokens, because refresh
  tokens are long-lived (weeks/months) by design. Implement
  `revokeToken()`; it's a few lines against the same in-memory store.
- A revoked/expired token should fail the **same way** a wrong bearer token
  does (generic `401 Unauthorized`, no detail on *why*) — don't let the
  error message tell a scanning attacker which auth method almost worked.

---

## 6. Verification checklist

Everything below is something that was actually wrong at some point during
this build and only caught by testing the real behaviour — not by reading
the code and judging it correct.

**Local, before any deploy:**
- [ ] `whoami`/equivalent tool call over stdio still returns the full tool
      list — proves the `createServer()` refactor didn't change behaviour.
- [ ] A request with `Host: <realdomain.com>` (not `127.0.0.1`) against the
      local build succeeds — proves the DNS-rebinding fix, which local-only
      testing cannot otherwise surface.
- [ ] Full OAuth round trip against a **throwaway test account**, not a real
      one: dynamic client registration → build real PKCE (`code_verifier` /
      S256 `code_challenge`) → `GET /authorize` returns the login page with
      correct hidden fields → `POST` the login route with **wrong**
      password (expect a clean rejection, form re-shown) → correct password
      (expect `302` with a real `code`) → exchange at `/token` (expect the
      SDK's own PKCE check to reject a **deliberately wrong**
      `code_verifier` — this proves PKCE is genuinely wired, not decorative)
      → the issued access token succeeds against the protected endpoint.
- [ ] A real, correctly-authenticated account with the **wrong role**
      (student/free-tier/whatever the low-privilege role is) gets refused
      by the login route, even with the correct password. This is the
      check that actually matters — everything else in the flow is
      standard OAuth machinery; this is the one business rule.
- [ ] Refresh-token grant issues a working new access token.
- [ ] Revoking one token doesn't invalidate a different valid one.
- [ ] The pre-existing bearer-token path still works, unchanged.
- [ ] Delete every test artifact afterward: the throwaway account, any
      test API keys minted, temp files. Don't leave test debris in the
      database.

**After deploying:**
- [ ] `curl https://yourdomain.com/.well-known/oauth-authorization-server`
      returns real JSON (not an HTML error page — that means it never
      reached your app, usually a reverse-proxy routing miss) with
      endpoint URLs pointing at the paths you actually chose.
- [ ] `curl https://yourdomain.com/.well-known/oauth-protected-resource/<path>`
      likewise.
- [ ] The real client (Gemini, or whichever product prompted this) actually
      completes a real connection — don't declare success from the
      discovery check alone.

---

## 7. Operational gotchas (not code, but cost real time)

- **Windows JSON configs: forward slashes only.** `\t` in a path is a tab
  character, not two characters — `E:\tools\...` silently becomes garbage.
  Always `E:/tools/...`.
- **PowerShell's `curl` is aliased to `Invoke-WebRequest`**, which doesn't
  understand `-H`/`-d` the way real curl does. Use `curl.exe` explicitly, or
  give `Invoke-WebRequest`/`Invoke-RestMethod` syntax instead.
- **Editing a remote config file by hand over SSH (`nano` + paste) is
  fragile** — bracketed-paste quirks, frozen sessions, and manual
  brace-matching mistakes when inserting into an existing file are all real
  failure modes hit during this build. Prefer writing the **whole file** via
  a heredoc in one shot:
  ```bash
  cat > /path/to/config <<'EOF'
  ...entire file contents...
  EOF
  ```
  This sidesteps the interactive editor entirely — no paste-into-a-TUI step
  to go wrong, no partial edits to a live file.
- **A reverse proxy's SSL termination might not be nginx's job at all** —
  check response headers (`Server:`, `CF-RAY:`, etc.) before assuming where
  HTTPS terminates. If a CDN/proxy (Cloudflare or similar) sits in front,
  nginx on the origin server may only need to speak plain HTTP on port 80;
  don't assume a certificate needs configuring locally without checking
  first.

---

## 8. What ships once this is done

- One connector, two transports (stdio for local clients, HTTP for remote).
- One set of tools and guardrails, identical regardless of which transport
  or auth method a given client uses — auth decides *who's allowed in*, not
  what they're allowed to do once they are.
- Any MCP-compliant client can connect, using whichever auth style it
  supports — this is the actual OAuth 2.1 + PKCE + dynamic-client-
  registration standard, not something built to satisfy one specific
  product. A future client needing OAuth works without further server
  changes.
- Still separate, still needed per client regardless of auth: the
  content/editorial rules (skills, system prompts, whatever the app calls
  them) — connecting a client only gets it the tools, not the judgement.
