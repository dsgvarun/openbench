-- OpenBench v1 — admin + employer verification (Phase 3.1)
--
-- Platform admins approve/reject companies. Admin membership is an explicit allowlist
-- table seeded via the service role (never self-serve). is_admin() gates the policies.

create table app_admin (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table app_admin enable row level security;
-- An admin can see their own admin row; the table is otherwise opaque (seeded by service role).
create policy admin_self_read on app_admin for select using (user_id = auth.uid());

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admin where user_id = auth.uid());
$$;
grant execute on function is_admin() to authenticated;

-- Admins can read every company + seat (the verification queue) and flip verification.
create policy company_admin_read on company for select using (is_admin());
create policy company_admin_update on company for update using (is_admin());
create policy seat_admin_read on seat for select using (is_admin());

-- Admins can read/act on abuse reports too (Phase 9 abuse handling).
create policy report_admin_read on report for select using (is_admin());
create policy report_admin_update on report for update using (is_admin());
