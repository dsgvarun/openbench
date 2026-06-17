-- OpenBench v1 — company registration RPC (fix RLS-insert failure)
--
-- Direct INSERT into company tripped the signup RLS policy. This SECURITY DEFINER RPC
-- creates the company (pending) + the caller's seat atomically, enforcing one-seat-per-user
-- and unique-domain. Validation of work-email/domain stays in the server action.

create or replace function register_company(
  p_legal_name text,
  p_domain text,
  p_work_email text,
  p_role text default null
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;

  if exists (select 1 from seat where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'already_registered');
  end if;

  if exists (select 1 from company where domain = lower(p_domain)) then
    return jsonb_build_object('ok', false, 'error', 'domain_exists');
  end if;

  insert into company (legal_name, domain, verification_status)
  values (trim(p_legal_name), lower(p_domain), 'pending')
  returning id into v_company;

  insert into seat (company_id, user_id, email, role)
  values (v_company, v_uid, lower(p_work_email), nullif(trim(coalesce(p_role, '')), ''));

  return jsonb_build_object('ok', true, 'company_id', v_company);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'domain_exists');
end;
$$;

revoke all on function register_company(text, text, text, text) from public;
grant execute on function register_company(text, text, text, text) to authenticated;
