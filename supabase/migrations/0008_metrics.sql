-- OpenBench v1 — admin metrics (Phase 6.3 observability)
--
-- The kill/pivot + placement-grade signals from PRD §14, computed for admins. Hires and
-- revealed→contacted need an outcome field employers set post-reveal (deferred); those
-- surface as null with a note so the gap is visible rather than silently absent.

create or replace function admin_metrics()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_published int; v_active int;
  v_listings int; v_co_pending int; v_co_approved int;
  v_sent int; v_accepted int; v_declined int; v_expired int;
  v_reveals int; v_delivered int; v_bounced int;
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
         count(*) filter (where intro_delivery = 'bounced')
    into v_reveals, v_delivered, v_bounced from reveal;

  return jsonb_build_object(
    'candidates_active', v_active,
    'candidates_published', v_published,
    'listings_open', v_listings,
    'companies_pending', v_co_pending,
    'companies_approved', v_co_approved,
    'interests', jsonb_build_object('pending', v_sent, 'accepted', v_accepted, 'declined', v_declined, 'expired', v_expired),
    -- North-star + acceptance rate (PRD §14 kill signals).
    'reveals_total', v_reveals,
    'accept_rate', case when (v_accepted + v_declined) > 0
      then round(v_accepted::numeric / (v_accepted + v_declined), 3) else null end,
    'intro_delivered', v_delivered,
    'intro_bounced', v_bounced,
    -- Placement-grade signals needing a post-reveal outcome field (deferred):
    'hires', null,
    'revealed_to_contacted', null,
    '_note', 'hires + revealed→contacted need an employer-set outcome field (deferred)'
  );
end;
$$;
revoke all on function admin_metrics() from public;
grant execute on function admin_metrics() to authenticated;
