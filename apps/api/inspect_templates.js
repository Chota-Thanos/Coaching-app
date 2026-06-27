import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgres://postgres:postgres@localhost:5432/coaching_app'
});
async function run() {
  try {
    const res = await pool.query('select id, title, slug, test_type, duration_minutes from assessment.test_templates');
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
