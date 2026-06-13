-- OpenBench v1 — consent log + scoped purge (Phase 6.2, DPDP mechanics)
--
-- Every consent-bearing event is logged (parse, publish, reveal, deletion). Scoped
-- purge removes the candidate's data from OpenBench and revokes future access; data
-- already disclosed via an accepted reveal is held by that company under their policy
-- (off-platform) — the candidate is told this at accept and deletion time.

create type consent_kind as enum ('parse', 'publish', 'reveal', 'deletion');

create table consent_log (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidate (id) on delete cascade,
  kind         consent_kind not null,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index consent_log_candidate_idx on consent_log (candidate_id, kind);
alter table consent_log enable row level security;
create policy consent_self_read on consent_log for select using (candidate_id = current_candidate_id());

-- Log a consent event for the current candidate (called by definer RPCs and the app).
create or replace function log_consent(p_kind consent_kind, p_detail jsonb default '{}'::jsonb)
  returns void language plpgsql security definer set search_path = public as $$
declare v_cand uuid := current_candidate_id();
begin
  if v_cand is null then return; end if;
  insert into consent_log (candidate_id, kind, detail) values (v_cand, p_kind, p_detail);
end;
$$;
grant execute on function log_consent(consent_kind, jsonb) to authenticated;

-- Scoped purge: wipe candidate-side data, unpublish, mark deleted. Reveal rows are kept
-- as a minimal off-platform audit; the projection already hides any non-active candidate,
-- so a purged candidate disappears from search, counts, and direct lookups immediately.
-- Storage objects (resume files) are deleted app-side after this returns.
create or replace function purge_candidate()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cand uuid := current_candidate_id();
begin
  if v_cand is null then return jsonb_build_object('ok', false, 'error', 'not_a_candidate'); end if;

  delete from resume where candidate_id = v_cand;
  delete from candidate_employer where candidate_id = v_cand;
  delete from preferences where candidate_id = v_cand;
  delete from blocklist where candidate_id = v_cand;
  delete from anonymized_profile where candidate_id = v_cand;
  -- Cancel any still-pending interest so no new reveal can fire post-deletion.
  update interest_request set status = 'expired' where candidate_id = v_cand and status = 'pending';

  insert into consent_log (candidate_id, kind, detail) values (v_cand, 'deletion', jsonb_build_object('at', now()));
  update candidate set status = 'deleted', email = '[deleted]', phone = null where id = v_cand;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function purge_candidate() to authenticated;

-- Amend accept_interest to log the reveal consent (supersedes the 0005 definition).
create or replace function accept_interest(p_interest uuid)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cand uuid := current_candidate_id();
  v_status candidate_status;
  v_company uuid;
  v_ver int;
  v_updated int;
begin
  if v_cand is null then return jsonb_build_object('ok', false, 'error', 'not_a_candidate'); end if;

  select status into v_status from candidate where id = v_cand;
  if v_status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'candidate_not_active');
  end if;

  update interest_request
    set status = 'accepted'
    where id = p_interest and candidate_id = v_cand and status = 'pending'
    returning company_id into v_company;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'not_pending');
  end if;

  select coalesce(max(version), 1) into v_ver from resume where candidate_id = v_cand;

  insert into reveal (interest_id, candidate_id, company_id, resume_version, intro_delivery)
  values (p_interest, v_cand, v_company, v_ver, 'pending')
  on conflict (interest_id) do nothing;

  -- Per-reveal consent record (DPDP).
  insert into consent_log (candidate_id, kind, detail)
  values (v_cand, 'reveal', jsonb_build_object('company_id', v_company, 'interest_id', p_interest));

  return jsonb_build_object('ok', true);
end;
$$;
