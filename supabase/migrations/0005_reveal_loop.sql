-- OpenBench v1 — reveal loop (Phase 4)
--
-- send_interest / accept_interest / decline_interest are SECURITY DEFINER RPCs that
-- enforce the loop's invariants atomically. The reveal is the product's ONE-WAY DOOR,
-- so accept is a conditional state transition: exactly one Reveal, idempotent under
-- double-submit, and rejected if the candidate paused/deleted at the accept moment.

-- Employer sends interest, attached to one of its own open listings.
-- Rate limits: ≤1 per listing (UNIQUE constraint), ≤25 outstanding/seat,
-- ≤3 total per candidate per company then locked 90 days (anti-pestering, §8).
create or replace function send_interest(p_candidate uuid, p_listing uuid, p_note text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := current_seat_company_id();
  v_seat uuid;
  v_outstanding int;
  v_total int;
  v_last timestamptz;
  v_new uuid;
begin
  if v_company is null then return jsonb_build_object('ok', false, 'error', 'not_a_verified_seat'); end if;
  select id into v_seat from seat where user_id = auth.uid();

  -- Listing must belong to the viewer's company and be open.
  if not exists (select 1 from job_listing where id = p_listing and company_id = v_company and status = 'open') then
    return jsonb_build_object('ok', false, 'error', 'invalid_listing');
  end if;

  -- Candidate must be visible to this company (published, active, not blocking it).
  if not is_profile_visible(p_candidate) then
    return jsonb_build_object('ok', false, 'error', 'candidate_unavailable');
  end if;

  if p_note is not null and char_length(p_note) > 300 then
    return jsonb_build_object('ok', false, 'error', 'note_too_long');
  end if;

  -- ≤25 outstanding (pending) per seat.
  select count(*) into v_outstanding from interest_request where seat_id = v_seat and status = 'pending';
  if v_outstanding >= 25 then return jsonb_build_object('ok', false, 'error', 'seat_rate_limit'); end if;

  -- ≤3 per candidate per company, then locked 90 days from the latest.
  select count(*), max(created_at) into v_total, v_last
  from interest_request where company_id = v_company and candidate_id = p_candidate;
  if v_total >= 3 and v_last > now() - interval '90 days' then
    return jsonb_build_object('ok', false, 'error', 'candidate_locked');
  end if;

  begin
    insert into interest_request (company_id, seat_id, candidate_id, listing_id, note)
    values (v_company, v_seat, p_candidate, p_listing, p_note)
    returning id into v_new;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'already_requested_for_listing');
  end;

  return jsonb_build_object('ok', true, 'interest_id', v_new);
end;
$$;

-- Candidate accepts. Conditional transition → exactly one Reveal. Idempotent: a second
-- call finds the row no longer 'pending' and is a no-op. Rejects paused/deleted candidates.
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
    return jsonb_build_object('ok', false, 'error', 'candidate_not_active'); -- paused/placed/deleted
  end if;

  -- Atomic: only the first accept of a still-pending request owned by this candidate wins.
  update interest_request
    set status = 'accepted'
    where id = p_interest and candidate_id = v_cand and status = 'pending'
    returning company_id into v_company;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    -- Already accepted/declined/expired, or not this candidate's request. No-op (idempotent).
    return jsonb_build_object('ok', false, 'error', 'not_pending');
  end if;

  select coalesce(max(version), 1) into v_ver from resume where candidate_id = v_cand;

  -- One reveal per interest (unique on interest_id). on conflict = belt-and-suspenders.
  insert into reveal (interest_id, candidate_id, company_id, resume_version, intro_delivery)
  values (p_interest, v_cand, v_company, v_ver, 'pending')
  on conflict (interest_id) do nothing;

  -- intro email is queued by the app off intro_delivery='pending' (Phase 4.4).
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function decline_interest(p_interest uuid, p_reason text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cand uuid := current_candidate_id(); v_updated int;
begin
  if v_cand is null then return jsonb_build_object('ok', false, 'error', 'not_a_candidate'); end if;
  update interest_request
    set status = 'declined', decline_reason = p_reason
    where id = p_interest and candidate_id = v_cand and status = 'pending';
  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', v_updated > 0);
end;
$$;

-- System job (Phase 5): expire pending requests past their 14-day window. service_role only.
create or replace function expire_stale_interests()
  returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update interest_request set status = 'expired' where status = 'pending' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function send_interest(uuid, uuid, text) from public;
revoke all on function accept_interest(uuid) from public;
revoke all on function decline_interest(uuid, text) from public;
revoke all on function expire_stale_interests() from public;
grant execute on function send_interest(uuid, uuid, text) to authenticated;
grant execute on function accept_interest(uuid) to authenticated;
grant execute on function decline_interest(uuid, text) to authenticated;
grant execute on function expire_stale_interests() to service_role;
