#!/usr/bin/env node
/**
 * stdio entry point — for local clients that spawn this as a child process
 * (Claude Desktop, Claude Code). See `server-factory.ts` for the tools
 * themselves and `http-server.ts` for the remote-client entry point.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server-factory.js';

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
