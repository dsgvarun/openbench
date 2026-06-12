// LIVE RLS enforcement test (Phase 1.2) — proves row-policy denial against a real
// Supabase instance, the half PGLite can't cover. Seeds two auth users + data via the
// service role, then queries as each authenticated user with the anon key.
//
// Requires env:
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Run against a SCRATCH project (it writes + deletes test rows):
//   node --env-file=.env.local supabase/tests/rls_live_test.mjs
//
// Asserts: blocked/no-reveal company reads nothing directly; stat_snapshot denied to
// authenticated; candidates can't read each other. profile_card stays null when blocked.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error("Missing env. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
let pass = 0, fail = 0;
const check = (name, cond, detail = "") =>
  cond ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.error(`  ✗ ${name} ${detail}`));

const PW = "Test!" + Math.random().toString(36).slice(2);
const made = { users: [], companies: [], candidates: [] };

async function mkUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw error;
  made.users.push(data.user.id);
  return data.user.id;
}
async function signedClient(email) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw error;
  return c;
}

try {
  const stamp = Date.now();
  const candEmail = `cand_${stamp}@personal.test`;
  const recEmail = `rec_${stamp}@blockedco.test`; // recruiter at the candidate's (blocked) employer

  const candUser = await mkUser(candEmail);
  const recUser = await mkUser(recEmail);

  // Seed via service role (bypasses RLS).
  const { data: co } = await admin.from("company")
    .insert({ legal_name: "BlockedCo", domain: "blockedco.test", verification_status: "approved" })
    .select().single();
  made.companies.push(co.id);
  await admin.from("seat").insert({ company_id: co.id, user_id: recUser, email: recEmail });

  const { data: cand } = await admin.from("candidate")
    .insert({ user_id: candUser, email: candEmail, status: "active", reveal_employers_mode: "none" })
    .select().single();
  made.candidates.push(cand.id);
  await admin.from("preferences").insert({ candidate_id: cand.id, functions: ["pm"], cities: ["mumbai"], expected_band: "b25_40", current_band: "b15_25", seniority: "senior" });
  await admin.from("anonymized_profile").insert({ candidate_id: cand.id, published_at: new Date().toISOString() });
  // Current employer = BlockedCo (domain match → employment-history shield)
  await admin.from("candidate_employer").insert({ candidate_id: cand.id, name: "BlockedCo", domain: "blockedco.test", is_current: true, confirmed: true });

  const rec = await signedClient(recEmail);

  console.log("RLS — blocked recruiter (BlockedCo is the candidate's current employer):");
  const r1 = await rec.from("candidate").select("*").eq("id", cand.id);
  check("direct read of candidate → 0 rows", (r1.data ?? []).length === 0, JSON.stringify(r1.data));
  const r2 = await rec.from("resume").select("*").eq("candidate_id", cand.id);
  check("direct read of resume → 0 rows", (r2.data ?? []).length === 0);
  const r3 = await rec.from("candidate_employer").select("*").eq("candidate_id", cand.id);
  check("direct read of candidate_employer → 0 rows", (r3.data ?? []).length === 0);
  const r4 = await rec.from("preferences").select("*").eq("candidate_id", cand.id);
  check("direct read of preferences → 0 rows", (r4.data ?? []).length === 0);
  const r5 = await rec.rpc("profile_card", { cand: cand.id });
  check("profile_card → null (blocked)", r5.data === null, JSON.stringify(r5.data));

  console.log("RLS — stat_snapshot is deny-all for authenticated:");
  const r6 = await rec.from("stat_snapshot").select("*").limit(1);
  check("stat_snapshot → 0 rows", (r6.data ?? []).length === 0);

  console.log("RLS — candidate cannot read another candidate's private rows:");
  const candC = await signedClient(candEmail);
  const r7 = await candC.from("preferences").select("*").neq("candidate_id", cand.id);
  check("cross-candidate preferences read → 0 rows", (r7.data ?? []).length === 0);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
} catch (e) {
  fail++;
  console.error("FATAL:", e.message);
} finally {
  // Cleanup
  for (const id of made.candidates) await admin.from("candidate").delete().eq("id", id);
  for (const id of made.companies) await admin.from("company").delete().eq("id", id);
  for (const id of made.users) await admin.auth.admin.deleteUser(id);
}

process.exit(fail ? 1 : 0);
