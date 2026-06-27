import pg from 'pg';

const client = new pg.Client({
  connectionString: "postgres://postgres:postgres@localhost:5432/coaching_app"
});

async function main() {
  await client.connect();
  const res = await client.query(`
    select id, name, slug, parent_id, node_type, content_family
    from current_affairs.category_nodes
    where is_active = true
    order by display_order, name
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
