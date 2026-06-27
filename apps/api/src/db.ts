import pg from "pg";
import { config } from "./config.js";

// Parse PostgreSQL BIGINT (OID 20) as JavaScript numbers instead of strings
pg.types.setTypeParser(20, function(val) {
  return parseInt(val, 10);
});

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  application_name: "coaching-app-api",
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

export type DbClient = pg.Pool | pg.PoolClient;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client: DbClient = pool
): Promise<T[]> {
  const result = await client.query<T>(text, params);
  return result.rows;
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client: DbClient = pool
): Promise<T | null> {
  const rows = await query<T>(text, params, client);
  return rows[0] ?? null;
}

export async function transaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

