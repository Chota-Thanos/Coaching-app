import { pool } from "../../db.js";

export async function checkAssessmentSchemaReady(): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'assessment'
          and table_name = 'questions'
      ) as exists
    `
  );
  return result.rows[0]?.exists === true;
}

