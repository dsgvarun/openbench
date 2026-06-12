-- OpenBench v1 — employer comp/availability index + search (Phase 3.2/3.3)
--
-- All aggregates are PER-VIEWER: a company never counts candidates who have it blocked
-- (employment-history shielding holds even in the numbers). k-anonymity suppresses any
-- slice < 5 to {suppressed:true, count:null} — the raw small number is never returned.
--
-- Modeling note: candidates declare comp BANDS, not exact figures, so the index reports
-- band distributions + availability curves, not rupee percentiles.

-- k-anon threshold. Slices below this are suppressed everywhere.
create or replace function _kanon_min() returns int language sql immutable as $$ select 5 $$;

-- Internal: candidate ids visible to `viewer` under `filters`. NOT client-callable
-- (takes a spoofable viewer arg) — only the public functions below invoke it.
create or replace function _visible_candidate_ids(viewer uuid, filters jsonb)
  returns table (candidate_id uuid)
  language sql stable security definer set search_path = public as $$
  select c.id
  from candidate c
  join preferences p on p.candidate_id = c.id
  join anonymized_profile ap on ap.candidate_id = c.id
  where viewer is not null
    and c.status in ('active', 'placed')
    and ap.published_at is not null
    and not viewer_is_blocked(c.id, viewer)
    and ((filters->>'function') is null or (filters->>'function') = any(p.functions))
    and ((filters->>'city') is null
         or (filters->>'city') = any(p.cities)
         or ((filters->>'city') = 'remote' and p.remote_only))
    and ((filters->>'band') is null or p.expected_band = (filters->>'band')::ctc_band)
    and ((filters->>'seniority') is null or p.seniority = (filters->>'seniority')::seniority_level)
    and ((filters->>'work_mode') is null or p.work_mode_pref = (filters->>'work_mode')::work_mode);
$$;
revoke all on function _visible_candidate_ids(uuid, jsonb) from public;

-- Total pool for a slice (k-anon suppressed).
create or replace function pool_count(filters jsonb default '{}'::jsonb)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := current_seat_company_id(); n int;
begin
  if v is null then return jsonb_build_object('count', null, 'suppressed', true); end if;
  select count(*) into n from _visible_candidate_ids(v, filters);
  if n < _kanon_min() then return jsonb_build_object('count', null, 'suppressed', true); end if;
  return jsonb_build_object('count', n, 'suppressed', false);
end;
$$;

-- Distribution across salary bands (each cell k-anon suppressed independently).
create or replace function band_distribution(filters jsonb default '{}'::jsonb)
  returns table (band ctc_band, count int, suppressed boolean)
  language plpgsql stable security definer set search_path = public as $$
declare v uuid := current_seat_company_id();
begin
  if v is null then return; end if;
  return query
  select p.expected_band as band,
         case when count(*) < _kanon_min() then null else count(*)::int end,
         (count(*) < _kanon_min())
  from _visible_candidate_ids(v, filters) ids
  join preferences p on p.candidate_id = ids.candidate_id
  where p.expected_band is not null
  group by p.expected_band
  order by p.expected_band;
end;
$$;

-- How many can start within 30 / 60 / 90 days (each cell k-anon suppressed).
create or replace function availability_curve(filters jsonb default '{}'::jsonb)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := current_seat_company_id(); w30 int; w60 int; w90 int; k int := _kanon_min();
begin
  if v is null then return jsonb_build_object('within_30', null, 'within_60', null, 'within_90', null); end if;
  select
    count(*) filter (where p.availability = 'available_now' or (p.availability_date is not null and p.availability_date <= current_date + 30)),
    count(*) filter (where p.availability = 'available_now' or (p.availability_date is not null and p.availability_date <= current_date + 60)),
    count(*) filter (where p.availability = 'available_now' or (p.availability_date is not null and p.availability_date <= current_date + 90))
  into w30, w60, w90
  from _visible_candidate_ids(v, filters) ids
  join preferences p on p.candidate_id = ids.candidate_id;
  return jsonb_build_object(
    'within_30', case when w30 < k then null else w30 end,
    'within_60', case when w60 < k then null else w60 end,
    'within_90', case when w90 < k then null else w90 end
  );
end;
$$;

-- Drill into the candidates behind the numbers — returns redacted cards (profile_card
-- applies all field redaction). Paginated, capped at 50.
create or replace function search_profiles(filters jsonb default '{}'::jsonb, lim int default 20, off int default 0)
  returns setof jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := current_seat_company_id(); rec uuid;
begin
  if v is null then return; end if;
  for rec in
    select ids.candidate_id
    from _visible_candidate_ids(v, filters) ids
    order by ids.candidate_id
    limit greatest(1, least(lim, 50)) offset greatest(0, off)
  loop
    return next profile_card(rec);
  end loop;
end;
$$;

revoke all on function pool_count(jsonb) from public;
revoke all on function band_distribution(jsonb) from public;
revoke all on function availability_curve(jsonb) from public;
revoke all on function search_profiles(jsonb, int, int) from public;
grant execute on function pool_count(jsonb) to authenticated;
grant execute on function band_distribution(jsonb) to authenticated;
grant execute on function availability_curve(jsonb) to authenticated;
grant execute on function search_profiles(jsonb, int, int) to authenticated;
