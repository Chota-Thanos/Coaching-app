module.exports = {
  apps: [
    {
      name: "coaching-api",
      script: "npm",
      args: "run api:start",
      env: {
        NODE_ENV: "production",
        PORT: 4000
      }
    },
    {
      name: "coaching-web",
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 0.0.0.0 --port 3000",
      cwd: "./apps/web",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      // Remote MCP endpoint for AI clients that can't spawn a local process
      // (the stdio server in tools/posting-agent-mcp/src/index.ts still
      // exists unchanged, for Claude Desktop / Claude Code). See
      // docs/claude-mcp-connection.md §11 before touching this.
      //
      // Secrets (COACHING_API_KEY, MCP_HTTP_BEARER_TOKEN) are NOT set here —
      // this file is committed. They live in
      // tools/posting-agent-mcp/.env on the server (gitignored, never
      // pushed), loaded via Node's --env-file. Binds to 127.0.0.1 by
      // default (see MCP_HTTP_HOST in http-server.ts) — a reverse-proxy
      // entry still needs to be added on the server to expose it over
      // HTTPS at a public URL; that step is outside this repo.
      name: "coaching-mcp",
      script: "node",
      args: "--env-file=.env dist/http-server.js",
      cwd: "./tools/posting-agent-mcp",
      env: {
        NODE_ENV: "production",
        COACHING_API_URL: "https://waytoias.com"
      }
    }
  ]
};
