-- OpenBench v1 — reveal outcomes (Phase 7c)
--
-- After a reveal, the employer marks what happened. This is the placement-grade signal
-- the metrics flagged as missing (hires, in-process). Closes the loop measurement.

create type reveal_outcome as enum ('in_process', 'hired', 'passed');

alter table reveal add column outcome reveal_outcome; -- null = not yet marked

-- Employer marks the outcome of one of their own reveals.
create or replace function set_reveal_outcome(p_reveal uuid, p_outcome reveal_outcome)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_company uuid := current_seat_company_id(); v_updated int;
begin
  if v_company is null then return jsonb_build_object('ok', false, 'error', 'not_a_verified_seat'); end if;
  update reveal set outcome = p_outcome where id = p_reveal and company_id = v_company;
  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', v_updated > 0);
end;
$$;
revoke all on function set_reveal_outcome(uuid, reveal_outcome) from public;
grant execute on function set_reveal_outcome(uuid, reveal_outcome) to authenticated;

-- Fold outcomes into admin_metrics: hires + in-process are now real (were null).
create or replace function admin_metrics()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_published int; v_active int;
  v_listings int; v_co_pending int; v_co_approved int;
  v_sent int; v_accepted int; v_declined int; v_expired int;
  v_reveals int; v_delivered int; v_bounced int;
  v_hired int; v_in_process int; v_passed int;
begin
  if not is_admin() then return jsonb_build_object('error', 'forbidden'); end if;

  select count(*) into v_active from candidate where status = 'active';
  select count(*) into v_published from anonymized_profile where published_at is not null;
  select count(*) into v_listings from job_listing where status = 'open';
  select count(*) filter (where verification_status = 'pending'),
         count(*) filter (where verification_status = 'approved')
    into v_co_pending, v_co_approved from company;

  select count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'accepted'),
         count(*) filter (where status = 'declined'),
         count(*) filter (where status = 'expired')
    into v_sent, v_accepted, v_declined, v_expired from interest_request;

  select count(*),
         count(*) filter (where intro_delivery = 'delivered'),
         count(*) filter (where intro_delivery = 'bounced'),
         count(*) filter (where outcome = 'hired'),
         count(*) filter (where outcome = 'in_process'),
         count(*) filter (where outcome = 'passed')
    into v_reveals, v_delivered, v_bounced, v_hired, v_in_process, v_passed from reveal;

  return jsonb_build_object(
    'candidates_active', v_active,
    'candidates_published', v_published,
    'listings_open', v_listings,
    'companies_pending', v_co_pending,
    'companies_approved', v_co_approved,
    'interests', jsonb_build_object('pending', v_sent, 'accepted', v_accepted, 'declined', v_declined, 'expired', v_expired),
    'reveals_total', v_reveals,
    'accept_rate', case when (v_accepted + v_declined) > 0
      then round(v_accepted::numeric / (v_accepted + v_declined), 3) else null end,
    'intro_delivered', v_delivered,
    'intro_bounced', v_bounced,
    -- Placement-grade (now real):
    'hires', v_hired,
    'in_process', v_in_process,
    'passed', v_passed
  );
end;
$$;
revoke all on function admin_metrics() from public;
grant execute on function admin_metrics() to authenticated;
