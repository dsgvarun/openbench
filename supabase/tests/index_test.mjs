// Employer index tests (Phase 3.2/3.3): per-viewer blocklist exclusion + k-anon
// suppression boundary. Runs against PGLite.
//
// Scope: aggregate logic + suppression (the bug-prone part). RLS role enforcement is
// covered by the live test. PGLite runs as superuser, but profile_card / count fns are
// SECURITY DEFINER and read the session uid we set, so the projection + filters run real.

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mig = (f) => readFileSync(join(__dirname, "..", "migrations", f), "utf8");

const db = new PGlite();
let pass = 0, fail = 0;
const check = (n, c, d = "") => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.error(`  ✗ ${n} ${d}`)));

const ACME = randomUUID();
const ACME_SEAT_USER = randomUUID();

async function asViewer() {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ACME_SEAT_USER]);
}
async function rpcJson(fn, filters) {
  const r = await db.query(`select ${fn}($1::jsonb) as v`, [JSON.stringify(filters)]);
  return r.rows[0].v;
}

// Seed one fully-published candidate. `employerDomain` non-null + matching a company's
// domain creates the employment-history block.
async function seedCandidate({ band, employerDomain = null }) {
  const uid = randomUUID();
  const cid = randomUUID();
  await db.query("insert into auth.users (id) values ($1)", [uid]);
  await db.query("insert into candidate (id, user_id, email, status, reveal_employers_mode) values ($1,$2,$3,'active','none')", [cid, uid, `c_${cid}@x.test`]);
  await db.query(
    "insert into preferences (candidate_id, functions, cities, expected_band, seniority, availability) values ($1, '{pm}', '{mumbai}', $2::ctc_band, 'senior', 'available_now')",
    [cid, band],
  );
  await db.query("insert into anonymized_profile (candidate_id, published_at) values ($1, now())", [cid]);
  await db.query(
    "insert into resume (candidate_id, file_path, parsed_json, parse_confidence) values ($1,'r.pdf','{\"name\":\"Hidden Person\"}'::jsonb, 0.9)",
    [cid],
  );
  if (employerDomain) {
    await db.query(
      "insert into candidate_employer (candidate_id, name, domain, is_current, confirmed) values ($1,'Emp',$2,true,true)",
      [cid, employerDomain],
    );
  }
  return cid;
}

try {
  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
    end $$;
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
  await db.exec(mig("0001_init_schema.sql"));
  await db.exec(mig("0002_rls_and_projection.sql"));
  await db.exec(mig("0004_employer_index.sql"));

  // Viewer company Acme + seat.
  await db.query("insert into auth.users (id) values ($1)", [ACME_SEAT_USER]);
  await db.query("insert into company (id, legal_name, domain, verification_status) values ($1,'Acme','acme.com','approved')", [ACME]);
  await db.query("insert into seat (company_id, user_id, email) values ($1,$2,'rec@acme.com')", [ACME, ACME_SEAT_USER]);

  // 6 visible in b25_40, 1 in b25_40 that BLOCKS Acme (employer=acme.com), 3 in b40_60 (sparse).
  for (let i = 0; i < 6; i++) await seedCandidate({ band: "b25_40" });
  await seedCandidate({ band: "b25_40", employerDomain: "acme.com" }); // blocked → excluded
  for (let i = 0; i < 3; i++) await seedCandidate({ band: "b40_60" });

  await asViewer();

  console.log("pool_count — per-viewer exclusion + suppression:");
  const all = await rpcJson("pool_count", { function: "pm", city: "mumbai" });
  check("PM/Mumbai total = 9 (blocked candidate excluded, not 10)", all.count === 9 && all.suppressed === false, JSON.stringify(all));

  const b2540 = await rpcJson("pool_count", { function: "pm", city: "mumbai", band: "b25_40" });
  check("b25_40 = 6 (the 7th, which blocks Acme, is excluded)", b2540.count === 6, JSON.stringify(b2540));

  console.log("band_distribution — k-anon suppresses the sparse band:");
  const dist = await db.query("select * from band_distribution($1::jsonb)", [JSON.stringify({ function: "pm", city: "mumbai" })]);
  const rows = Object.fromEntries(dist.rows.map((r) => [r.band, r]));
  check("b25_40 visible with count 6", rows.b25_40?.count === 6 && rows.b25_40?.suppressed === false, JSON.stringify(rows.b25_40));
  check("b40_60 SUPPRESSED (3 < 5), count null", rows.b40_60?.suppressed === true && rows.b40_60?.count === null, JSON.stringify(rows.b40_60));

  console.log("availability_curve — all available now:");
  const av = await rpcJson("availability_curve", { function: "pm", city: "mumbai" });
  check("within_30 = 9 (>=5, not suppressed)", av.within_30 === 9, JSON.stringify(av));

  console.log("search_profiles — drill-through returns REDACTED cards:");
  const sp = await db.query("select * from search_profiles($1::jsonb, 20, 0) as v", [JSON.stringify({ function: "pm", city: "mumbai", band: "b25_40" })]);
  const cards = sp.rows.map((r) => r.v);
  check("returns 6 cards", cards.length === 6, `got ${cards.length}`);
  check("every card has name hidden + revealed=false", cards.every((c) => (c.name === undefined || c.name === null) && c.revealed === false), JSON.stringify(cards[0]));

  console.log("no-session viewer sees nothing:");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  const none = await rpcJson("pool_count", {});
  check("pool_count with no seat → suppressed", none.suppressed === true && none.count === null, JSON.stringify(none));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
} catch (e) {
  fail++;
  console.error("FATAL:", e.message);
} finally {
  await db.close();
}

process.exit(fail ? 1 : 0);
