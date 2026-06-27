import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { closePool, pool } from "./db.js";

const migrationsDir =
  process.env.MIGRATIONS_DIR ??
  resolve(process.cwd(), "../../database/migrations");

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    create table if not exists public.schema_migrations (
      id bigserial primary key,
      filename text not null unique,
      checksum text,
      applied_at timestamptz not null default now()
    );
  `);
}

async function hasMigration(filename: string): Promise<boolean> {
  const result = await pool.query(
    "select 1 from public.schema_migrations where filename = $1 limit 1",
    [filename]
  );
  return (result.rowCount ?? 0) > 0;
}

async function applyMigration(filePath: string): Promise<void> {
  const filename = basename(filePath);
  if (await hasMigration(filename)) {
    console.log(`skip ${filename}`);
    return;
  }

  const sql = await readFile(filePath, "utf8");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      "insert into public.schema_migrations (filename) values ($1)",
      [filename]
    );
    await client.query("commit");
    console.log(`applied ${filename}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  await ensureMigrationsTable();
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    await applyMigration(resolve(migrationsDir, file));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

