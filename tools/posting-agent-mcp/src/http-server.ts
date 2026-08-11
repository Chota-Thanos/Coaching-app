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
 * something else has to replace it. That is the bearer-token check below —
 * every request, no exceptions, checked before the request is allowed
 * anywhere near an MCP tool or the underlying API key.
 *
 * This deliberately does NOT let a remote caller supply their own
 * COACHING_API_KEY. One key is configured here, for one account (yours),
 * exactly like the stdio version; the bearer token is a separate secret that
 * gates entry to that single identity, not a multi-tenant credential pass-
 * through. Anyone with the bearer token acts as that one account.
 *
 * Stateless by design: a fresh McpServer + transport per request, connected,
 * used, and closed — the pattern the SDK itself ships for Streamable HTTP,
 * and the one with the least session-management surface to get wrong. There
 * is deliberately no session store and no resumable-stream support.
 */
import { timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server-factory.js";

const PORT = Number(process.env.MCP_HTTP_PORT ?? 4100);
// 127.0.0.1 by default: only a reverse proxy on the same machine can reach
// this port directly. Set MCP_HTTP_HOST=0.0.0.0 only if you know the process
// will be firewalled or is otherwise not directly internet-reachable.
const HOST = process.env.MCP_HTTP_HOST ?? "127.0.0.1";
const BEARER_TOKEN = process.env.MCP_HTTP_BEARER_TOKEN ?? "";

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

function requireBearerToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (!presented || !safeTokenEquals(presented, BEARER_TOKEN)) {
    // A 401 body deliberately says nothing about *why* — not "token too
    // short", not "malformed header" — so a scanning attacker learns
    // nothing beyond "this endpoint exists and requires auth".
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized." },
      id: null,
    });
    return;
  }
  next();
}

const app = createMcpExpressApp({ host: HOST });

// Unauthenticated on purpose: lets a deploy be verified (and an uptime
// monitor configured) without handing out the bearer token to do it.
// Reveals only that the process is up — no tool names, no account info.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "coaching-posting-agent-mcp" });
});

app.post("/mcp", requireBearerToken, async (req, res) => {
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
  app[method]("/mcp", requireBearerToken, (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. This server is stateless: POST only." },
      id: null,
    });
  });
}

app.listen(PORT, HOST, () => {
  console.log(`coaching-posting-agent-mcp (HTTP) listening on http://${HOST}:${PORT}/mcp`);
  console.log(`Health check (no auth required): http://${HOST}:${PORT}/health`);
});
