// Validates the SQL migrations against an in-process Postgres (PGLite).
// Stubs Supabase's auth schema (auth.users, auth.uid()) since those are
// Supabase-managed and absent in vanilla Postgres.
//
// Run: node scripts/validate-migrations.mjs
// This is a DDL/syntax smoke test. Full RLS behavior (blocked-company-sees-nothing)
// is verified against a real Supabase instance — PGLite is single-role and can't
// exercise auth roles. See supabase/tests/.

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");

const AUTH_STUB = `
  -- Supabase-managed roles, stubbed for validation.
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  end $$;
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
  -- profile_card etc. call auth.uid(); stub returns a settable session value.
  create or replace function auth.uid() returns uuid
    language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`;

const db = new PGlite();
let failed = false;

try {
  await db.exec(AUTH_STUB);
  console.log("✓ auth stub created");

  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    try {
      await db.exec(sql);
      console.log(`✓ ${f} applied`);
    } catch (e) {
      failed = true;
      console.error(`✗ ${f} FAILED:\n  ${e.message}`);
    }
  }

  if (!failed) {
    // Smoke: the projection function exists and runs (returns null with no session/data).
    const r = await db.query(
      "select profile_card('00000000-0000-0000-0000-000000000000'::uuid) as card",
    );
    console.log("✓ profile_card() callable; returned:", r.rows[0].card);

    const tables = await db.query(
      "select count(*)::int as n from information_schema.tables where table_schema='public'",
    );
    console.log(`✓ ${tables.rows[0].n} public tables created`);
  }
} catch (e) {
  failed = true;
  console.error("FATAL:", e.message);
} finally {
  await db.close();
}

process.exit(failed ? 1 : 0);
