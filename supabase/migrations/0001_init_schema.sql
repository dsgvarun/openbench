-- OpenBench v1 — initial schema (Phase 1.1)
-- Privacy foundation. RLS is enabled deny-all at the end; scoped policies + the
-- projection layer land in 0002. Nothing is readable until then — fail-closed by design.
--
-- Conventions: uuid pks, created_at defaults, India-region Supabase project.
-- The candidate row holds PRIVATE fields; candidate-facing reads go through the
-- projection layer (0002), never directly against these tables.

-- gen_random_uuid() is in Postgres core since PG13 (Supabase runs PG15+); no extension needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
create type candidate_status      as enum ('active', 'paused', 'placed', 'deleted');
create type reveal_employers_mode as enum ('none', 'past_only', 'all');
create type block_source          as enum ('auto_history', 'manual');
create type company_verification  as enum ('pending', 'approved', 'rejected');
create type listing_status        as enum ('open', 'filled', 'closed');
create type interest_status       as enum ('pending', 'accepted', 'declined', 'expired');
create type report_status         as enum ('open', 'upheld', 'dismissed');
create type intro_delivery        as enum ('pending', 'delivered', 'bounced', 'failed');
create type work_mode             as enum ('onsite', 'hybrid', 'remote');
create type availability_kind     as enum ('available_now', 'serving_notice', 'from_date');
create type seniority_level       as enum ('junior', 'mid', 'senior', 'lead', 'director', 'vp_plus');
-- Predefined CTC bands (₹). Stored as enum so distributions/k-anon group cleanly.
create type ctc_band as enum ('b4_8', 'b8_15', 'b15_25', 'b25_40', 'b40_60', 'b60_80', 'b80_plus');

-- ─────────────────────────────────────────────────────────────────────────────
-- Candidate core (PRIVATE — never read directly by employers)
-- ─────────────────────────────────────────────────────────────────────────────
create table candidate (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users (id) on delete cascade,
  email                 text not null,           -- private; mirrors auth, used for notifications
  phone                 text,                    -- private, optional, never shown
  status                candidate_status not null default 'active',
  reveal_employers_mode reveal_employers_mode not null default 'none', -- D3: hidden by default
  created_at            timestamptz not null default now()
);

create table resume (
  id               uuid primary key default gen_random_uuid(),
  candidate_id     uuid not null references candidate (id) on delete cascade,
  file_path        text not null,               -- Supabase Storage ref; served via signed expiring URLs only
  parsed_json      jsonb,                        -- raw parse output (audit); normalized employers live in candidate_employer
  parse_confidence numeric(4,3),                 -- 0.000–1.000; low confidence blocks publish (fail-closed, Phase 2.3)
  version          int not null default 1,
  created_at       timestamptz not null default now()
);
create index resume_candidate_idx on resume (candidate_id);

-- First-class employer rows (eng review T-E2): reveal + block flags bind to a STABLE id,
-- so editing/re-parsing the employer list never mis-binds. Never embed these in a JSON array.
create table candidate_employer (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidate (id) on delete cascade,
  name          text not null,
  domain        text,
  is_current    boolean not null default false,
  display_order int not null default 0,
  reveal_flag   boolean not null default false,  -- D3: employer hidden unless candidate opts in
  from_parse    boolean not null default true,   -- distinguishes parsed vs candidate-added (fail-closed step)
  confirmed     boolean not null default false,  -- candidate confirmed in the mandatory employer-confirmation step
  created_at    timestamptz not null default now()
);
create index candidate_employer_candidate_idx on candidate_employer (candidate_id);
create index candidate_employer_domain_idx on candidate_employer (lower(domain));

-- Blocklist: who can NEVER see this profile. Auto entries reference a candidate_employer
-- (stable id); manual entries carry free-form name/domain.
create table blocklist (
  id                   uuid primary key default gen_random_uuid(),
  candidate_id         uuid not null references candidate (id) on delete cascade,
  candidate_employer_id uuid references candidate_employer (id) on delete cascade,
  company_id           uuid,                     -- resolved match against company.id when known
  company_domain       text,
  company_name         text,
  source               block_source not null default 'auto_history',
  created_at           timestamptz not null default now()
);
create index blocklist_candidate_idx on blocklist (candidate_id);
create index blocklist_domain_idx on blocklist (lower(company_domain));
create index blocklist_company_idx on blocklist (company_id);

-- Per-tier rendered cache ONLY. Non-authoritative: the projection layer (0002) is the
-- source of truth for what a viewer sees. A bug here can never leak — the DB gate does.
create table anonymized_profile (
  candidate_id    uuid primary key references candidate (id) on delete cascade,
  schema_version  int not null default 1,
  display_json    jsonb,                          -- CACHE, not authority
  reid_check_score numeric(4,3),                  -- reserved for deferred Redacted tier
  published_at    timestamptz
);

create table preferences (
  candidate_id      uuid primary key references candidate (id) on delete cascade,
  functions         text[] not null default '{}', -- ≤3 (enforced in app)
  industries        text[] not null default '{}', -- ≤5
  cities            text[] not null default '{}',
  remote_only       boolean not null default false,
  work_mode_pref    work_mode,
  expected_band     ctc_band,
  current_band      ctc_band,                      -- PRIVATE: never exposed via projection
  availability      availability_kind,
  availability_date date,
  seniority         seniority_level
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Employer side
-- ─────────────────────────────────────────────────────────────────────────────
create table company (
  id                  uuid primary key default gen_random_uuid(),
  legal_name          text not null,
  domain              text not null unique,
  website             text,
  linkedin            text,
  headcount_band      text,
  verification_status company_verification not null default 'pending',
  created_at          timestamptz not null default now()
);

create table seat (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company (id) on delete cascade,
  user_id         uuid not null unique references auth.users (id) on delete cascade,
  email           text not null,                  -- work email; domain must match company.domain
  role            text,
  rate_limit_state jsonb not null default '{}',   -- outstanding-request accounting (≤25/seat)
  created_at      timestamptz not null default now()
);
create index seat_company_idx on seat (company_id);

create table job_listing (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company (id) on delete cascade,
  title       text not null,
  function    text not null,
  city        text,
  remote      boolean not null default false,
  work_mode   work_mode,
  ctc_band    ctc_band not null,
  seniority   seniority_level,
  jd_url      text,
  jd_text     text,
  status      listing_status not null default 'open',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '60 days')
);
create index job_listing_company_idx on job_listing (company_id);
create index job_listing_status_idx on job_listing (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Reveal loop
-- ─────────────────────────────────────────────────────────────────────────────
create table interest_request (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references company (id) on delete cascade,
  seat_id       uuid not null references seat (id) on delete set null,
  candidate_id  uuid not null references candidate (id) on delete cascade,
  listing_id    uuid not null references job_listing (id) on delete cascade,
  note          text,                              -- ≤300 chars, contact-info screened (app)
  status        interest_status not null default 'pending',
  decline_reason text,                             -- private; aggregated across ≥5
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '14 days'),
  -- Idempotency (eng review T-E3): one request per company per candidate per listing.
  constraint interest_unique unique (company_id, candidate_id, listing_id)
);
create index interest_candidate_idx on interest_request (candidate_id, status);
create index interest_company_idx on interest_request (company_id, status);

create table reveal (
  id             uuid primary key default gen_random_uuid(),
  interest_id    uuid not null unique references interest_request (id) on delete cascade,
  candidate_id   uuid not null references candidate (id) on delete cascade,
  company_id     uuid not null references company (id) on delete cascade,
  revealed_at    timestamptz not null default now(),
  resume_version int not null,
  intro_delivery intro_delivery not null default 'pending',
  access_log     jsonb not null default '[]'      -- append-only view/download audit
);
create index reveal_company_candidate_idx on reveal (company_id, candidate_id);

create table report (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidate (id) on delete cascade,
  company_id   uuid not null references company (id) on delete cascade,
  interest_id  uuid references interest_request (id) on delete set null,
  reason       text,
  status       report_status not null default 'open',
  created_at   timestamptz not null default now()
);

-- Aggregate counts. Stores UNSUPPRESSED raw counts (sensitive) — suppression (<5) and
-- per-viewer blocklist adjustment happen at render (Phase 5.2). Never expose to clients.
create table stat_snapshot (
  id          uuid primary key default gen_random_uuid(),
  dimension   text not null,                       -- e.g. 'function|city|band'
  slice       text not null,                       -- e.g. 'pm|mumbai|b25_40'
  count       int not null,
  computed_at timestamptz not null default now()
);
create index stat_snapshot_dim_idx on stat_snapshot (dimension, slice);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fail-closed default: enable RLS everywhere with NO policies yet (deny-all).
-- Scoped policies + the projection layer are added in 0002. Until then, nothing
-- is readable through the anon/auth roles — which is the safe state to be in.
-- ─────────────────────────────────────────────────────────────────────────────
alter table candidate           enable row level security;
alter table resume              enable row level security;
alter table candidate_employer  enable row level security;
alter table blocklist           enable row level security;
alter table anonymized_profile  enable row level security;
alter table preferences         enable row level security;
alter table company             enable row level security;
alter table seat                enable row level security;
alter table job_listing         enable row level security;
alter table interest_request    enable row level security;
alter table reveal              enable row level security;
alter table report              enable row level security;
alter table stat_snapshot       enable row level security;
