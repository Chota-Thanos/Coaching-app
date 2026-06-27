import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: "postgres://postgres:postgres@localhost:5432/coaching_app"
  });

  await client.connect();

  console.log("--- LATEST ERROR LOGS ---");
  const errRes = await client.query("select * from assessment.error_logs order by id desc limit 20;");
  console.table(errRes.rows.map(r => ({ id: r.id, user_id: r.user_id, error_message: r.error_message, stack_trace: r.stack_trace?.substring(0, 100) })));

  await client.end();
}

main().catch(console.error);
