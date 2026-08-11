#!/usr/bin/env node
/**
 * Remote entry point — exposes the same tools as `index.ts`, over Streamable
 * HTTP instead of stdio, so an AI product that can't spawn a local process
 * (it isn't running on this machine) can still reach them.
 *
 * Read this before deploying it anywhere:
 *
 * The local, stdio-only design was never "just" a limitation — it was doing
 * real security work. The only thing standing between an attacker and the
 * admin-level posting/editing key this server holds was: they'd need to be
 * on your machine. Listening on a public port removes that protection, so
 * something else has to replace it. Two things do, both checked before a
 * request is allowed anywhere near an MCP tool or the underlying API key:
 *
 *   1. The bearer-token check below — a single shared secret, for clients
 *      that let you paste in a header directly.
 *   2. Real OAuth 2.1 login (see oauth-provider.ts) — for clients (Gemini's
 *      "custom connected apps," for one) that only support signing in, not
 *      pasting a token. This still checks a real password, against this
 *      app's own login endpoint — it does not weaken anything the bearer
 *      token already protects, it's a second door into the same room.
 *
 * This deliberately does NOT let a remote caller supply their own
 * COACHING_API_KEY. One key is configured here, for one account (yours),
 * exactly like the stdio version; both auth methods above gate entry to
 * that single identity, not a multi-tenant credential pass-through.
 *
 * Stateless by design: a fresh McpServer + transport per request, connected,
 * used, and closed — the pattern the SDK itself ships for Streamable HTTP,
 * and the one with the least session-management surface to get wrong. There
 * is deliberately no session store and no resumable-stream support.
 */
import { timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createOAuthMetadata, mcpAuthMetadataRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { authorizationHandler, redirectUriMatches } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { clientRegistrationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/register.js";
import { revocationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/revoke.js";
import { createServer } from "./server-factory.js";
import { WebsiteOAuthProvider } from "./oauth-provider.js";

const PORT = Number(process.env.MCP_HTTP_PORT ?? 4100);
// 127.0.0.1 by default: only a reverse proxy on the same machine can reach
// this port directly. Set MCP_HTTP_HOST=0.0.0.0 only if you know the process
// will be firewalled or is otherwise not directly internet-reachable.
const HOST = process.env.MCP_HTTP_HOST ?? "127.0.0.1";
const BEARER_TOKEN = process.env.MCP_HTTP_BEARER_TOKEN ?? "";
// The externally-visible base URL of this deployment — used to build the
// OAuth issuer, discovery and redirect URLs, and to reach the website's own
// login endpoint. Defaults match this project's real deployment; overridable
// so this file stays generic rather than hardcoded to one domain.
const PUBLIC_URL = process.env.MCP_PUBLIC_URL ?? "https://waytoias.com";
const API_URL = process.env.COACHING_API_URL ?? "http://localhost:4000";

/**
 * The MCP SDK's Express helper includes DNS-rebinding protection: it checks
 * the incoming `Host:` header against an allowlist, and defaults that list to
 * localhost-only. Behind a reverse proxy, the `Host:` header is the PUBLIC
 * hostname (nginx forwards it as-is — `proxy_set_header Host $host;`), not
 * 127.0.0.1, so the default silently rejected every real request behind
 * nginx with "Invalid Host: waytoias.com", before it ever reached the bearer
 * -token check below. Caught by testing the deployed endpoint directly, not
 * by local testing (loopback requests legitimately do send Host: 127.0.0.1).
 * Configurable because this file is generic to whatever domain it's proxied
 * behind, not hardcoded to one deployment.
 */
const ALLOWED_HOSTS = (process.env.MCP_ALLOWED_HOSTS ?? "waytoias.com,www.waytoias.com,127.0.0.1,localhost")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

if (!BEARER_TOKEN || BEARER_TOKEN.length < 32) {
  throw new Error(
    "MCP_HTTP_BEARER_TOKEN is not set (or is too short to be a real secret, minimum 32 characters). " +
      "Generate one with:\n  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
      "then set it in the environment this process runs under, and give the SAME value to whatever " +
      "remote client you configure — as an Authorization: Bearer <token> header.",
  );
}

/** Constant-time comparison — a plain === leaks how many leading characters
 *  matched via response timing, which matters for a secret guarding
 *  admin-level write access. */
function safeTokenEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const oauthProvider = new WebsiteOAuthProvider(API_URL);

/**
 * Accepts EITHER credential on /mcp: the static bearer token (checked first
 * — cheap, no lookup) or a real OAuth access token issued after a login
 * (checked second). One client can use whichever it supports; neither path
 * is weaker than the other, both end up trusting the same single account.
 */
async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (presented && safeTokenEquals(presented, BEARER_TOKEN)) {
    next();
    return;
  }

  if (presented) {
    try {
      await oauthProvider.verifyAccessToken(presented);
      next();
      return;
    } catch {
      // Falls through to the shared 401 below — same message either way, so
      // a scanning attacker can't tell which auth method almost worked.
    }
  }

  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message: "Unauthorized." },
    id: null,
  });
}

const app = createMcpExpressApp({ host: HOST, allowedHosts: ALLOWED_HOSTS });

// Unauthenticated on purpose: lets a deploy be verified (and an uptime
// monitor configured) without handing out any credential to do it. Reveals
// only that the process is up — no tool names, no account info.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "coaching-posting-agent-mcp" });
});

// ─── OAuth authorization server ─────────────────────────────────────────────
//
// Namespaced under /mcp-oauth deliberately, not at the domain root: /login
// and /register already exist as real pages on the main website (its sign-in
// and sign-up screens) — confirmed by checking the web app's actual routes
// before picking this prefix, not assumed.
//
// The SDK's own `mcpAuthRouter()` convenience wrapper can't be used for this:
// it hardcodes `/authorize`, `/token`, `/register` and `/revoke` as ROOT
// paths internally (leading slash, so `new URL(path, baseUrl)` discards
// baseUrl's own path component entirely — a real URL-resolution surprise,
// not a guess, confirmed by testing it locally before writing this). Mounted
// that way, `/register` would have collided with the site's real sign-up
// page the moment this shared a domain with it. So the four operational
// endpoints are mounted individually, at paths this file actually chooses;
// only the two discovery endpoints (which genuinely must live at the domain
// root, per RFC 8414 / RFC 9728) go through the SDK's own root-mounting
// helper.
const OAUTH_PREFIX = "/mcp-oauth";
const issuerUrl = new URL(PUBLIC_URL);
const resourceServerUrl = new URL("/mcp", PUBLIC_URL);

const oauthMetadata = createOAuthMetadata({
  provider: oauthProvider,
  issuerUrl,
  scopesSupported: ["mcp:tools"],
});
// Overwrite the SDK's root-path defaults with where these endpoints are
// actually mounted below.
oauthMetadata.authorization_endpoint = new URL(`${OAUTH_PREFIX}/authorize`, PUBLIC_URL).href;
oauthMetadata.token_endpoint = new URL(`${OAUTH_PREFIX}/token`, PUBLIC_URL).href;
oauthMetadata.registration_endpoint = new URL(`${OAUTH_PREFIX}/register`, PUBLIC_URL).href;
oauthMetadata.revocation_endpoint = new URL(`${OAUTH_PREFIX}/revoke`, PUBLIC_URL).href;

app.use(
  mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl,
    scopesSupported: ["mcp:tools"],
  }),
);

app.use(`${OAUTH_PREFIX}/authorize`, authorizationHandler({ provider: oauthProvider }));
app.use(`${OAUTH_PREFIX}/token`, tokenHandler({ provider: oauthProvider }));
app.use(`${OAUTH_PREFIX}/register`, clientRegistrationHandler({ clientsStore: oauthProvider.clientsStore }));
app.use(`${OAUTH_PREFIX}/revoke`, revocationHandler({ provider: oauthProvider }));

// The one route this file owns directly rather than handing to the SDK
// router: the actual login form submission. `oauth-provider.ts`'s
// `authorize()` callback only receives `res`, not a parsed request body, so
// the real credential check has to happen here instead, where `req.body` is
// available. See that file's header comment for the full reasoning.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter than the SDK's own /authorize limit — this one checks a real password
  standardHeaders: true,
  legacyHeaders: false,
  message: { jsonrpc: "2.0", error: { code: -32000, message: "Too many login attempts. Try again later." }, id: null },
});

app.post(
  "/mcp-oauth/login",
  loginRateLimit,
  express.urlencoded({ extended: false }), // HTML forms post as x-www-form-urlencoded, not JSON
  async (req, res) => {
    const { client_id, redirect_uri, code_challenge, state, scope, resource, email, password } = req.body as Record<
      string,
      string | undefined
    >;

    if (!client_id || !redirect_uri || !code_challenge || !email || !password) {
      res.status(400).send("Malformed login submission. Go back and try again from the connecting app.");
      return;
    }

    const client = await oauthProvider.clientsStore.getClient(client_id);
    if (!client) {
      res.status(400).send("Unknown client. The connecting app may need to reconnect from scratch.");
      return;
    }
    if (!client.redirect_uris.some((registered) => redirectUriMatches(redirect_uri, registered))) {
      res.status(400).send("This redirect address isn't registered for this app. Refusing to continue.");
      return;
    }

    const params = {
      state: state || undefined,
      scopes: scope ? scope.split(" ").filter(Boolean) : [],
      codeChallenge: code_challenge,
      redirectUri: redirect_uri,
      resource: resource ? new URL(resource) : undefined,
    };

    const login = await oauthProvider.checkLogin(email, password);
    if (!login.ok) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(401).send(oauthProvider.renderLoginPage(client, params, login.reason));
      return;
    }

    const code = oauthProvider.issueAuthorizationCode(client, params, login.email);
    const target = new URL(redirect_uri);
    target.searchParams.set("code", code);
    if (params.state) target.searchParams.set("state", params.state);
    res.redirect(302, target.href);
  },
);

// ─── The actual MCP endpoint ─────────────────────────────────────────────────

app.post("/mcp", requireAuth, async (req, res) => {
  const server = createServer();
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Stateless mode supports neither a resumable GET stream nor session
// termination via DELETE — matches the SDK's own reference implementation.
for (const method of ["get", "delete"] as const) {
  app[method]("/mcp", requireAuth, (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. This server is stateless: POST only." },
      id: null,
    });
  });
}

app.listen(PORT, HOST, () => {
  console.log(`coaching-posting-agent-mcp (HTTP) listening on http://${HOST}:${PORT}/mcp`);
  console.log(`OAuth discovery: http://${HOST}:${PORT}/.well-known/oauth-authorization-server`);
  console.log(`Health check (no auth required): http://${HOST}:${PORT}/health`);
});
