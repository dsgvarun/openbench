// Phase 6 tests: consent logging, scoped purge, admin_metrics gate. PGLite.

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
const setUser = (uid) => db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
const j = async (sql, p = []) => (await db.query(sql, p)).rows[0]?.v;
const count = async (sql, p = []) => (await db.query(sql, p)).rows[0].n;

const CO = randomUUID(), SEAT_USER = randomUUID(), CAND_USER = randomUUID(), CAND = randomUUID(), ADMIN_USER = randomUUID();

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
  for (const f of ["0001_init_schema.sql","0002_rls_and_projection.sql","0004_employer_index.sql","0005_reveal_loop.sql","0006_admin.sql","0007_consent_purge.sql","0008_metrics.sql"]) await db.exec(mig(f));

  // Seed
  await db.query("insert into auth.users (id) values ($1),($2),($3)", [SEAT_USER, CAND_USER, ADMIN_USER]);
  await db.query("insert into company (id, legal_name, domain, verification_status) values ($1,'Acme','acme.com','approved')", [CO]);
  await db.query("insert into seat (company_id, user_id, email) values ($1,$2,'rec@acme.com')", [CO, SEAT_USER]);
  await db.query("insert into candidate (id, user_id, email, status, reveal_employers_mode) values ($1,$2,'c@x.test','active','none')", [CAND, CAND_USER]);
  await db.query("insert into preferences (candidate_id, functions, cities, expected_band, seniority, availability) values ($1,'{pm}','{mumbai}','b25_40','senior','available_now')", [CAND]);
  await db.query("insert into anonymized_profile (candidate_id, published_at) values ($1, now())", [CAND]);
  await db.query("insert into resume (candidate_id, file_path, version) values ($1,'r.pdf',1)", [CAND]);
  await db.query("insert into candidate_employer (candidate_id, name, domain, is_current, confirmed) values ($1,'OldCo','oldco.com',false,true)", [CAND]);
  const L = randomUUID();
  await db.query("insert into job_listing (id, company_id, title, function, ctc_band) values ($1,$2,'PM','pm','b25_40')", [L, CO]);

  // accept → reveal + consent('reveal')
  await setUser(SEAT_USER);
  const s = await j("select send_interest($1,$2,null) as v", [CAND, L]);
  await setUser(CAND_USER);
  const a = await j("select accept_interest($1) as v", [s.interest_id]);
  check("accept ok", a.ok === true, JSON.stringify(a));
  check("consent_log has a 'reveal' entry", (await count("select count(*)::int n from consent_log where candidate_id=$1 and kind='reveal'", [CAND])) === 1);

  // scoped purge
  const p = await j("select purge_candidate() as v");
  check("purge ok", p.ok === true, JSON.stringify(p));
  check("resume wiped", (await count("select count(*)::int n from resume where candidate_id=$1", [CAND])) === 0);
  check("preferences wiped", (await count("select count(*)::int n from preferences where candidate_id=$1", [CAND])) === 0);
  check("employers wiped", (await count("select count(*)::int n from candidate_employer where candidate_id=$1", [CAND])) === 0);
  check("anonymized_profile wiped", (await count("select count(*)::int n from anonymized_profile where candidate_id=$1", [CAND])) === 0);
  const candRow = (await db.query("select status, email, phone from candidate where id=$1", [CAND])).rows[0];
  check("candidate marked deleted + scrubbed", candRow.status === "deleted" && candRow.email === "[deleted]" && candRow.phone === null, JSON.stringify(candRow));
  check("consent_log has a 'deletion' entry", (await count("select count(*)::int n from consent_log where candidate_id=$1 and kind='deletion'", [CAND])) === 1);

  // purged candidate is invisible to a viewer
  await setUser(SEAT_USER);
  const card = await j("select profile_card($1) as v", [CAND]);
  check("purged candidate → profile_card null", card === null, JSON.stringify(card));

  // admin_metrics gate
  await setUser(SEAT_USER);
  const forbidden = await j("select admin_metrics() as v");
  check("non-admin → forbidden", forbidden.error === "forbidden", JSON.stringify(forbidden));
  await db.query("insert into app_admin (user_id) values ($1)", [ADMIN_USER]);
  await setUser(ADMIN_USER);
  const metrics = await j("select admin_metrics() as v");
  check("admin → metrics object", metrics && typeof metrics.candidates_active === "number" && "accept_rate" in metrics, JSON.stringify(metrics).slice(0, 120));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
} catch (e) {
  fail++;
  console.error("FATAL:", e.message);
} finally {
  await db.close();
}
process.exit(fail ? 1 : 0);
