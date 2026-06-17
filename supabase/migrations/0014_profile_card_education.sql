-- OpenBench v1 — surface education + employer titles in the projection (Phase 7 polish)
-- Education is a shown field (PRD §6.3). Employer titles ride alongside the name and obey
-- the same reveal/opt-in gating as the employer name.

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

  -- Employer name + title shown together, on the same gate (hidden by default).
  select jsonb_agg(
    jsonb_build_object(
      'is_current', ce.is_current,
      'title', ce.title,
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
    'education', coalesce(v_resume.parsed_json->'education', '[]'::jsonb),
    'years_experience', v_resume.parsed_json->>'years_experience',
    'employers', coalesce(employers, '[]'::jsonb),
    'revealed', v_has_reveal
  );

  if v_has_reveal then
    card := card || jsonb_build_object(
      'name', v_resume.parsed_json->>'name',
      'email', v_cand.email,
      'phone', v_cand.phone,
      'resume_version', v_resume.version
    );
  end if;

  return card;
end;
$$;
