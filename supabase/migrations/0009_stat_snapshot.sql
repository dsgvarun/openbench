-- OpenBench v1 — stat snapshot refresh (Phase 5.1)
--
-- Recomputes the global (unsuppressed) per-slice counts. This is the precompute layer;
-- the live index functions (Phase 3) still do the per-viewer blocklist adjustment +
-- k-anon suppression at query time. A candidate matching multiple functions/cities is
-- counted in each slice (so "PMs in Mumbai" is correct). service_role only — these are
-- raw counts and must never be exposed to clients (RLS keeps the table deny-all).

create or replace function refresh_stat_snapshot()
  returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from stat_snapshot;
  insert into stat_snapshot (dimension, slice, count)
  select
    'function|city|band',
    coalesce(fn, '*') || '|' || coalesce(city, '*') || '|' || coalesce(p.expected_band::text, '*'),
    count(*)
  from candidate c
  join anonymized_profile ap on ap.candidate_id = c.id and ap.published_at is not null
  join preferences p on p.candidate_id = c.id
  left join lateral unnest(
    case when array_length(p.functions, 1) is null then array[null::text] else p.functions end
  ) as fn on true
  left join lateral unnest(
    case when array_length(p.cities, 1) is null then array[null::text] else p.cities end
  ) as city on true
  where c.status in ('active', 'placed')
  group by 1, 2;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function refresh_stat_snapshot() from public;
grant execute on function refresh_stat_snapshot() to service_role;
