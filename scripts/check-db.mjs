import pg from 'pg';

const url =
  process.env.DATABASE_URL ||
  'postgresql://postgres:A2wBQj7oVhSdOcL2M8EzRIbtxno1ry3v@127.0.0.1:5432/postgres';

const client = new pg.Client({ connectionString: url });

await client.connect();
const { rows } = await client.query(`
  SELECT
    current_database() AS db,
    current_user AS usr,
    EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'branches'
    ) AS has_branches,
    (
      SELECT count(*)::int
      FROM information_schema.tables
      WHERE table_schema = 'public'
    ) AS public_tables
`);
console.log(JSON.stringify(rows[0], null, 2));

const tables = await client.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`);
console.log('tables:', tables.rows.map((r) => r.table_name));
await client.end();
