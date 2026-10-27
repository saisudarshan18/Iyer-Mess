// Applies pending files in supabase/migrations (in name order) to DATABASE_URL from .env.local,
// and the seed after the first migration.  Run: npm run db:apply
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = process.env.DATABASE_URL ?? env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");

const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
client.on("notice", (n) => console.log("notice:", n.message));
await client.connect();

await client.query("create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())");
await client.query("alter table public.schema_migrations enable row level security");
// databases set up before this table existed already have the first migration
const { rows: pre } = await client.query("select to_regclass('public.orders') is not null as has_schema");
if (pre[0].has_schema) await client.query("insert into public.schema_migrations (name) values ($1) on conflict do nothing", [files[0]]);

const done = new Set((await client.query("select name from public.schema_migrations")).rows.map((r) => r.name));
for (const f of files.filter((f) => !done.has(f))) {
  await client.query("begin");
  try {
    await client.query(readFileSync(new URL(f, dir), "utf8"));
    if (f === files[0]) await client.query(readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8"));
    await client.query("insert into public.schema_migrations (name) values ($1)", [f]);
    await client.query("commit");
    console.log("applied", f);
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
console.log("up to date:", files.length, "migrations");
await client.end();
