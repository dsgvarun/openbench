// Reveal-loop tests (Phase 4): the one-way-door invariants. Runs against PGLite.
// Idempotent accept (exactly one Reveal), paused-candidate race, per-listing +
// per-candidate rate limits, blocked-candidate rejection.

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
const SEAT_USER = randomUUID();

const setUser = (uid) => db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
const j = async (sql, params = []) => (await db.query(sql, params)).rows[0]?.v;

async function seedCandidate({ status = "active", employerDomain = null } = {}) {
  const uid = randomUUID(), cid = randomUUID();
  await db.query("insert into auth.users (id) values ($1)", [uid]);
  await db.query("insert into candidate (id, user_id, email, status, reveal_employers_mode) values ($1,$2,$3,$4,'none')", [cid, uid, `c_${cid}@x.test`, status]);
  await db.query("insert into preferences (candidate_id, functions, cities, expected_band, seniority, availability) values ($1,'{pm}','{mumbai}','b25_40','senior','available_now')", [cid]);
  await db.query("insert into anonymized_profile (candidate_id, published_at) values ($1, now())", [cid]);
  await db.query("insert into resume (candidate_id, file_path, version) values ($1,'r.pdf',1)", [cid]);
  if (employerDomain)
    await db.query("insert into candidate_employer (candidate_id, name, domain, is_current, confirmed) values ($1,'E',$2,true,true)", [cid, employerDomain]);
  return { cid, uid };
}
async function newListing() {
  const id = randomUUID();
  await db.query("insert into job_listing (id, company_id, title, function, ctc_band, status) values ($1,$2,'PM','pm','b25_40','open')", [id, ACME]);
  return id;
}
const revealCount = async (cid) => (await db.query("select count(*)::int as v from reveal where candidate_id=$1", [cid])).rows[0].v;

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
  for (const f of ["0001_init_schema.sql", "0002_rls_and_projection.sql", "0004_employer_index.sql", "0005_reveal_loop.sql"]) await db.exec(mig(f));

  await db.query("insert into auth.users (id) values ($1)", [SEAT_USER]);
  await db.query("insert into company (id, legal_name, domain, verification_status) values ($1,'Acme','acme.com','approved')", [ACME]);
  await db.query("insert into seat (company_id, user_id, email) values ($1,$2,'rec@acme.com')", [ACME, SEAT_USER]);

  const cand = await seedCandidate();
  const L1 = await newListing();

  console.log("send_interest + per-listing uniqueness:");
  await setUser(SEAT_USER);
  const s1 = await j("select send_interest($1,$2,'hi') as v", [cand.cid, L1]);
  check("first send ok", s1.ok === true && !!s1.interest_id, JSON.stringify(s1));
  const s2 = await j("select send_interest($1,$2,'again') as v", [cand.cid, L1]);
  check("second send same listing rejected", s2.ok === false && s2.error === "already_requested_for_listing", JSON.stringify(s2));
  const interestId = s1.interest_id;

  console.log("accept_interest — idempotent, exactly one reveal:");
  await setUser(cand.uid);
  const a1 = await j("select accept_interest($1) as v", [interestId]);
  check("accept ok", a1.ok === true, JSON.stringify(a1));
  check("exactly one reveal", (await revealCount(cand.cid)) === 1);
  const a2 = await j("select accept_interest($1) as v", [interestId]);
  check("double-accept is a no-op (not_pending)", a2.ok === false && a2.error === "not_pending", JSON.stringify(a2));
  check("still exactly one reveal after double-accept", (await revealCount(cand.cid)) === 1);

  console.log("race — paused candidate cannot accept:");
  const cand2 = await seedCandidate({ status: "active" });
  const L2 = await newListing();
  await setUser(SEAT_USER);
  const s3 = await j("select send_interest($1,$2,null) as v", [cand2.cid, L2]);
  await db.query("update candidate set status='paused' where id=$1", [cand2.cid]);
  await setUser(cand2.uid);
  const a3 = await j("select accept_interest($1) as v", [s3.interest_id]);
  check("paused candidate accept rejected", a3.ok === false && a3.error === "candidate_not_active", JSON.stringify(a3));
  check("no reveal created for paused accept", (await revealCount(cand2.cid)) === 0);

  console.log("per-candidate lock — 3 then locked:");
  const cand3 = await seedCandidate();
  await setUser(SEAT_USER);
  let ok3 = 0;
  for (let i = 0; i < 3; i++) {
    const L = await newListing();
    const r = await j("select send_interest($1,$2,null) as v", [cand3.cid, L]);
    if (r.ok) ok3++;
  }
  check("first 3 sends to a candidate succeed", ok3 === 3);
  const L4 = await newListing();
  const locked = await j("select send_interest($1,$2,null) as v", [cand3.cid, L4]);
  check("4th send to same candidate locked", locked.ok === false && locked.error === "candidate_locked", JSON.stringify(locked));

  console.log("blocked candidate — send rejected:");
  const candBlocked = await seedCandidate({ employerDomain: "acme.com" });
  const L5 = await newListing();
  const blk = await j("select send_interest($1,$2,null) as v", [candBlocked.cid, L5]);
  check("send to candidate who blocks the company rejected", blk.ok === false && blk.error === "candidate_unavailable", JSON.stringify(blk));

  console.log("decline + expire:");
  const cand4 = await seedCandidate();
  const L6 = await newListing();
  const s6 = await j("select send_interest($1,$2,null) as v", [cand4.cid, L6]);
  await setUser(cand4.uid);
  const dec = await j("select decline_interest($1,'band too low') as v", [s6.interest_id]);
  check("decline ok", dec.ok === true, JSON.stringify(dec));
  // expire: backdate a fresh pending request, run the job
  const cand5 = await seedCandidate();
  const L7 = await newListing();
  await setUser(SEAT_USER);
  const s7 = await j("select send_interest($1,$2,null) as v", [cand5.cid, L7]);
  await db.query("update interest_request set expires_at = now() - interval '1 day' where id=$1", [s7.interest_id]);
  const expired = (await db.query("select expire_stale_interests() as v")).rows[0].v;
  check("expire job flips stale pending → expired", expired >= 1, `expired ${expired}`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
} catch (e) {
  fail++;
  console.error("FATAL:", e.message);
} finally {
  await db.close();
}

process.exit(fail ? 1 : 0);
