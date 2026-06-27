import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";

export async function registerHealthRoutes(server: FastifyInstance): Promise<void> {
  server.get("/health", async () => {
    return { status: "ok" };
  });

  server.get("/health/db", async () => {
    const result = await pool.query<{ ok: number }>("select 1 as ok");
    return {
      status: result.rows[0]?.ok === 1 ? "ok" : "error"
    };
  });
}

