// Applies one migration file to Supabase over a direct Postgres connection
// (SUPABASE_DB_URL in .env.local — the "Session pooler" connection string
// from the Supabase dashboard's Connect button). Runs inside a transaction,
// so a failing migration leaves nothing half-applied.
//
//   npm run migrate -- 0019_email_campaigns.sql
//
// Only use this for migrations that are safe to apply — most here use
// "if not exists", but not all (0001's create type, 0010's create policy,
// and 0008's constraint swap would fail or regress if re-run).
import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { Client } from "pg";

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run migrate -- <migration file name>");
    process.exit(1);
  }
  if (!process.env.SUPABASE_DB_URL) {
    console.error("Missing SUPABASE_DB_URL in .env.local");
    process.exit(1);
  }

  const sql = fs.readFileSync(path.join("supabase/migrations", path.basename(file)), "utf8");
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    // Tell Supabase's REST layer to pick up new tables/columns immediately.
    await client.query("notify pgrst, 'reload schema'");
    console.log(`✅ Applied ${path.basename(file)}`);
  } catch (error) {
    await client.query("rollback");
    console.error(`❌ ${path.basename(file)} failed, nothing was applied:`, error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
