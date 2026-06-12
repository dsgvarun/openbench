-- OpenBench v1 — RLS policies + projection layer (Phase 1.2 / 1.3 / 1.4)
--
-- The privacy model, in two layers:
--   1. RLS (rows): who can touch which rows. Employers get NO direct read of
--      candidate-side tables. Blocked companies and no-reveal companies are denied.
--   2. Projection (fields): the ONLY path employers read candidate data is the
--      SECURITY DEFINER function profile_card(), which redacts field-by-field
--      (name + employers hidden by default; full data only with a Reveal).
--
-- display_json is a non-authoritative cache — never the gate. A render bug can't leak
-- because the DB layer (RLS + profile_card) decides what's returned.

-- ─────────────────────────────────────────────────────────────────────────────
-- Identity + access helpers (SECURITY DEFINER so they can read across tables)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function current_candidate_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from candidate where user_id = auth.uid() and status <> 'deleted';
$$;

create or replace function current_seat_company_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select s.company_id
  from seat s
  join company c on c.id = s.company_id
  where s.user_id = auth.uid() and c.verification_status = 'approved';
$$;

-- Blocked = company is on the blocklist (by id or domain) OR matches any of the
-- candidate's employer domains. The domain match enforces employment-history
-- shielding structurally, even if a blocklist row was never materialized.
create or replace function viewer_is_blocked(cand uuid, comp uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocklist b
    left join company c on c.id = comp
    where b.candidate_id = cand
      and (
        b.company_id = comp
        or (b.company_domain is not null and c.domain is not null
            and lower(b.company_domain) = lower(c.domain))
      )
  )
  or exists (
    select 1 from candidate_employer ce
    join company c2 on c2.id = comp
    where ce.candidate_id = cand
      and ce.domain is not null and c2.domain is not null
      and lower(ce.domain) = lower(c2.domain)
  );
$$;

create or replace function company_has_reveal(cand uuid, comp uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from reveal where candidate_id = cand and company_id = comp);
$$;

-- A profile is visible to the current viewer's company if: published, active/placed,
-- and the viewer is not blocked. Used by profile_card() and search.
create or replace function is_profile_visible(cand uuid) returns boolean
  language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := current_seat_company_id();
begin
  if v_company is null then return false; end if;
  if not exists (
    select 1 from candidate c
    join anonymized_profile ap on ap.candidate_id = c.id
    where c.id = cand and c.status in ('active','placed') and ap.published_at is not null
  ) then return false; end if;
  return not viewer_is_blocked(cand, v_company);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECTION LAYER (1.3/1.4) — the single authoritative read path for employers.
-- Returns a redacted card; null if not visible. Field redaction lives HERE.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function profile_card(cand uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := current_seat_company_id();
  v_cand    candidate%rowtype;
  v_pref    preferences%rowtype;
  v_resume  resume%rowtype;
  v_has_reveal boolean;
  v_mode    reveal_employers_mode;
  employers jsonb;
  card      jsonb;
begin
  if not is_profile_visible(cand) then return null; end if;

  select * into v_cand   from candidate where id = cand;
  select * into v_pref   from preferences where candidate_id = cand;
  select * into v_resume from resume where candidate_id = cand order by version desc limit 1;

  v_has_reveal := company_has_reveal(cand, v_company);
  v_mode := v_cand.reveal_employers_mode;

  -- Employer names: hidden by default (D3). Shown if revealed, or if the candidate
  -- opted in (mode + per-employer flag). past_only never reveals the current employer.
  select jsonb_agg(
    jsonb_build_object(
      'is_current', ce.is_current,
      'name', case
        when v_has_reveal then ce.name
        when v_mode = 'all' and ce.reveal_flag then ce.name
        when v_mode = 'past_only' and ce.reveal_flag and not ce.is_current then ce.name
        else null
      end
    ) order by ce.display_order
  ) into employers
  from candidate_employer ce
  where ce.candidate_id = cand and ce.confirmed;

  -- Safe-by-default fields. NOTE: current_band is PRIVATE and never included.
  card := jsonb_build_object(
    'candidate_id', cand,
    'seniority', v_pref.seniority,
    'functions', to_jsonb(coalesce(v_pref.functions, '{}')),
    'cities', to_jsonb(coalesce(v_pref.cities, '{}')),
    'remote_only', v_pref.remote_only,
    'work_mode', v_pref.work_mode_pref,
    'expected_band', v_pref.expected_band,
    'availability', v_pref.availability,
    'availability_date', v_pref.availability_date,
    'headline', v_resume.parsed_json->>'headline',
    'skills', coalesce(v_resume.parsed_json->'skills', '[]'::jsonb),
    'years_experience', v_resume.parsed_json->>'years_experience',
    'employers', coalesce(employers, '[]'::jsonb),
    'revealed', v_has_reveal
  );

  -- Reveal-gated identity. Name comes from the private resume parse, surfaced ONLY here.
  if v_has_reveal then
    card := card || jsonb_build_object(
      'name', v_resume.parsed_json->>'name',
      'email', v_cand.email,
      'phone', v_cand.phone,
      'resume_version', v_resume.version
      -- resume file itself: app issues a signed expiring URL after re-checking the reveal
    );
  end if;

  return card;
end;
$$;

revoke all on function profile_card(uuid) from public;
grant execute on function profile_card(uuid) to authenticated;
grant execute on function is_profile_visible(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- candidate: only the owner. Employers NEVER read this table directly.
create policy candidate_self_select on candidate for select using (user_id = auth.uid());
create policy candidate_self_insert on candidate for insert with check (user_id = auth.uid());
create policy candidate_self_update on candidate for update using (user_id = auth.uid());

-- resume: owner full; a seat whose company holds a reveal may read (for signed-URL issuance).
create policy resume_self on resume for all
  using (candidate_id = current_candidate_id())
  with check (candidate_id = current_candidate_id());
create policy resume_revealed_read on resume for select
  using (company_has_reveal(candidate_id, current_seat_company_id()));

-- candidate_employer / preferences / blocklist / anonymized_profile: owner only.
-- Employers reach these solely through profile_card() (SECURITY DEFINER).
create policy ce_self on candidate_employer for all
  using (candidate_id = current_candidate_id())
  with check (candidate_id = current_candidate_id());
create policy pref_self on preferences for all
  using (candidate_id = current_candidate_id())
  with check (candidate_id = current_candidate_id());
create policy block_self on blocklist for all
  using (candidate_id = current_candidate_id())
  with check (candidate_id = current_candidate_id());
create policy ap_self on anonymized_profile for all
  using (candidate_id = current_candidate_id())
  with check (candidate_id = current_candidate_id());

-- company: approved companies are publicly readable (names/logos); a seat reads its own.
create policy company_public_read on company for select
  using (verification_status = 'approved' or id = current_seat_company_id());
create policy company_signup_insert on company for insert
  with check (verification_status = 'pending');

-- seat: a user reads its own seat and its company peers; can create its own seat at signup.
create policy seat_self_read on seat for select
  using (user_id = auth.uid() or company_id = current_seat_company_id());
create policy seat_self_insert on seat for insert with check (user_id = auth.uid());

-- job_listing: public read (they feed candidate-facing stats); company writes its own.
create policy listing_public_read on job_listing for select using (true);
create policy listing_company_write on job_listing for all
  using (company_id = current_seat_company_id())
  with check (company_id = current_seat_company_id());

-- interest_request: candidate reads requests to them; company reads its own; seat creates own.
-- Accept/decline transitions go through the accept RPC (Phase 4) — candidate update allowed
-- for decline/ignore but reveal creation is RPC-only.
create policy interest_candidate_read on interest_request for select
  using (candidate_id = current_candidate_id());
create policy interest_company_read on interest_request for select
  using (company_id = current_seat_company_id());
create policy interest_company_insert on interest_request for insert
  with check (company_id = current_seat_company_id());
create policy interest_candidate_update on interest_request for update
  using (candidate_id = current_candidate_id());

-- reveal: both sides read their own; NO direct insert (created only via accept RPC / service role).
create policy reveal_candidate_read on reveal for select
  using (candidate_id = current_candidate_id());
create policy reveal_company_read on reveal for select
  using (company_id = current_seat_company_id());

-- report: candidate files and reads its own.
create policy report_self on report for all
  using (candidate_id = current_candidate_id())
  with check (candidate_id = current_candidate_id());

-- stat_snapshot: NO policy on purpose. RLS is on, so anon/auth are denied. Raw
-- unsuppressed counts are reached only via SECURITY DEFINER count fns (Phase 5)
-- or the service role.
