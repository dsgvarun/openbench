// Functional test of the projection layer (profile_card) — the field-level redaction
// that RLS can't express. Runs against PGLite (in-process Postgres).
//
// Scope: this proves the REDACTION logic (hidden-by-default, blocked-invisible,
// reveal-unlocks, per-employer opt-in, past_only current-employer guard, current_band
// never leaks). It does NOT prove RLS role enforcement (direct-table-read denial) —
// PGLite runs as superuser and bypasses RLS. That half is verified against a real
// Supabase instance (see README "Phase 1.2 RLS verification").
//
// Run: node supabase/tests/projection_test.mjs

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mig = (f) => readFileSync(join(__dirname, "..", "migrations", f), "utf8");

const db = new PGlite();
let pass = 0,
  fail = 0;

function check(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

// Fixed UUIDs for readability
const U_CAND = "11111111-1111-1111-1111-111111111111";
const U_EMP_A = "22222222-2222-2222-2222-222222222222"; // seat at Acme (neutral company)
const U_EMP_B = "33333333-3333-3333-3333-333333333333"; // seat at CurrentCo (candidate's employer)
const CAND = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CO_A = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CO_B = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const EMP_CURRENT = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const EMP_PAST = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

async function asUser(uid) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
}
async function card(cand) {
  const r = await db.query("select profile_card($1::uuid) as c", [cand]);
  return r.rows[0].c;
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

  // Seed
  await db.exec(`
    insert into auth.users (id) values
      ('${U_CAND}'), ('${U_EMP_A}'), ('${U_EMP_B}');

    insert into company (id, legal_name, domain, verification_status) values
      ('${CO_A}', 'Acme', 'acme.com', 'approved'),
      ('${CO_B}', 'CurrentCo', 'currentco.com', 'approved');

    insert into seat (company_id, user_id, email) values
      ('${CO_A}', '${U_EMP_A}', 'rec@acme.com'),
      ('${CO_B}', '${U_EMP_B}', 'hr@currentco.com');

    insert into candidate (id, user_id, email, phone, status, reveal_employers_mode) values
      ('${CAND}', '${U_CAND}', 'cand@personal.com', '+91999', 'active', 'none');

    insert into preferences (candidate_id, functions, cities, expected_band, current_band, seniority, availability)
      values ('${CAND}', '{pm}', '{mumbai}', 'b25_40', 'b15_25', 'senior', 'serving_notice');

    insert into resume (candidate_id, file_path, parsed_json, parse_confidence, version)
      values ('${CAND}', 'resumes/cand.pdf',
        '{"name":"Asha Rao","headline":"Senior PM, fintech","skills":["roadmaps","growth"],"years_experience":"9"}',
        0.95, 1);

    insert into anonymized_profile (candidate_id, published_at) values ('${CAND}', now());

    insert into candidate_employer (id, candidate_id, name, domain, is_current, confirmed, reveal_flag, display_order) values
      ('${EMP_CURRENT}', '${CAND}', 'CurrentCo', 'currentco.com', true,  true, false, 0),
      ('${EMP_PAST}',    '${CAND}', 'OldCorp',   'oldcorp.com',   false, true, false, 1);
  `);

  console.log("Scenario 1 — default (mode=none, no reveal), viewer = Acme:");
  await asUser(U_EMP_A);
  let c = await card(CAND);
  check("profile is visible", c !== null);
  check("name hidden", c?.name === undefined || c?.name === null);
  check("not marked revealed", c?.revealed === false);
  check("safe fields present (band/city)", c?.expected_band === "b25_40" && JSON.stringify(c?.cities) === '["mumbai"]');
  check("current_band NEVER present", !("current_band" in (c ?? {})), JSON.stringify(c));
  const names1 = (c?.employers ?? []).map((e) => e.name);
  check("all employer names hidden by default", names1.every((n) => n === null), JSON.stringify(names1));

  console.log("Scenario 2 — blocked viewer (CurrentCo = candidate's current employer):");
  await asUser(U_EMP_B);
  c = await card(CAND);
  check("blocked company sees NOTHING (null card)", c === null, JSON.stringify(c));

  console.log("Scenario 3 — opt-in: mode=all, OldCorp.reveal_flag=true, viewer = Acme:");
  await db.exec(`update candidate set reveal_employers_mode='all' where id='${CAND}';`);
  await db.exec(`update candidate_employer set reveal_flag=true where id='${EMP_PAST}';`);
  await asUser(U_EMP_A);
  c = await card(CAND);
  const byName = Object.fromEntries((c?.employers ?? []).map((e) => [e.is_current ? "current" : "past", e.name]));
  check("opted-in past employer name shows", byName.past === "OldCorp", JSON.stringify(byName));
  check("non-opted current employer still hidden", byName.current === null, JSON.stringify(byName));

  console.log("Scenario 4 — past_only guard: mode=past_only, current employer flagged true:");
  await db.exec(`update candidate set reveal_employers_mode='past_only' where id='${CAND}';`);
  await db.exec(`update candidate_employer set reveal_flag=true where id='${EMP_CURRENT}';`);
  await asUser(U_EMP_A);
  c = await card(CAND);
  const byName2 = Object.fromEntries((c?.employers ?? []).map((e) => [e.is_current ? "current" : "past", e.name]));
  check("past_only NEVER reveals current employer even if flagged", byName2.current === null, JSON.stringify(byName2));
  check("past employer shows under past_only", byName2.past === "OldCorp", JSON.stringify(byName2));

  console.log("Scenario 5 — reveal granted to Acme unlocks identity:");
  await db.exec(`update candidate set reveal_employers_mode='none' where id='${CAND}';`);
  await db.exec(`
    insert into job_listing (id, company_id, title, function, ctc_band) values
      ('ffffffff-ffff-ffff-ffff-ffffffffffff', '${CO_A}', 'Senior PM', 'pm', 'b25_40');
    insert into interest_request (id, company_id, seat_id, candidate_id, listing_id)
      select '99999999-9999-9999-9999-999999999999', '${CO_A}', s.id, '${CAND}', 'ffffffff-ffff-ffff-ffff-ffffffffffff'
      from seat s where s.user_id='${U_EMP_A}';
    insert into reveal (interest_id, candidate_id, company_id, resume_version)
      values ('99999999-9999-9999-9999-999999999999', '${CAND}', '${CO_A}', 1);
  `);
  await asUser(U_EMP_A);
  c = await card(CAND);
  check("revealed=true after reveal", c?.revealed === true);
  check("name revealed", c?.name === "Asha Rao", JSON.stringify(c?.name));
  check("contact revealed", c?.email === "cand@personal.com" && c?.phone === "+91999");
  const names5 = (c?.employers ?? []).map((e) => e.name).sort();
  check("all employer names revealed", JSON.stringify(names5) === JSON.stringify(["CurrentCo", "OldCorp"]), JSON.stringify(names5));
  check("current_band STILL never present (even revealed)", !("current_band" in (c ?? {})));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
} catch (e) {
  fail++;
  console.error("FATAL:", e.message);
} finally {
  await db.close();
}

process.exit(fail ? 1 : 0);
