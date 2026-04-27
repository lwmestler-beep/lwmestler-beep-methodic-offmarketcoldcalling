-- =============================================================================
-- Methodic Off-Market Tracker — Supabase Schema
-- Paste into: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PROFILES (maps auth users → display name like "Gavin", "Logan", etc.)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Auto-assign display name from email on user creation
create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display text;
begin
  display := case
    when new.email = 'gavin@methodicventures.com' then 'Gavin'
    when new.email = 'logan@methodicventures.com' then 'Logan'
    when new.email = 'dean@methodicventures.com'  then 'Dean'
    when new.email = 'methodicpartners@gmail.com' then 'Intern'
    else split_part(new.email, '@', 1)
  end;
  insert into public.profiles (id, email, display_name)
    values (new.id, new.email, display)
    on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_create_profile on auth.users;
create trigger trg_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_user();

-- -----------------------------------------------------------------------------
-- 2. LEADS
-- -----------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),

  -- core identification
  business_name text not null,
  industry text,
  source text,

  -- contact
  business_phone text,
  business_email text,
  owner_name text,
  owner_phone text,
  owner_email text,
  website text,

  -- normalized for dedupe (set by client on upload)
  website_domain text,
  phone_digits text,
  name_normalized text,

  -- location
  address text,
  city text,
  state text,
  zip text,

  -- financials / operating data
  annual_revenue numeric,
  employees integer,
  founded_year integer,

  -- google / social
  rating numeric,
  reviews integer,
  description text,
  linkedin_url text,
  facebook_url text,
  instagram_url text,
  google_maps_url text,

  -- methodic-specific
  fit_tier text check (fit_tier in ('A','B','C')),
  vet_status text not null default 'Unvetted'
    check (vet_status in ('Vetted','Maybe-Fit','Unvetted')),
  stage text not null default 'Cold' check (stage in (
    'Cold','Attempting','Contacted','Engaged',
    'Materials Sent','CIM Received','LOI Stage',
    'Won','Dead - Not Interested','Dead - Unresponsive'
  )),

  -- workflow
  next_action text,
  next_action_date date,
  attempts_count integer not null default 0,
  last_contact_at timestamptz,
  status_notes text,

  -- audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_website_domain_idx on public.leads(website_domain) where website_domain is not null;
create index if not exists leads_phone_digits_idx on public.leads(phone_digits) where phone_digits is not null;
create index if not exists leads_name_normalized_idx on public.leads(name_normalized);
create index if not exists leads_stage_idx on public.leads(stage);
create index if not exists leads_vet_status_idx on public.leads(vet_status);
create index if not exists leads_fit_tier_idx on public.leads(fit_tier);
create index if not exists leads_industry_idx on public.leads(industry);

-- bump updated_at on every change
create or replace function public.bump_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.bump_updated_at();

-- -----------------------------------------------------------------------------
-- 3. ACTIVITIES (call log + emails + notes)
-- -----------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  caller_id uuid references public.profiles(id),
  caller_name text not null,                 -- denormalized for fast display
  caller_email text not null,
  occurred_at timestamptz not null default now(),
  channel text not null check (channel in (
    'Call','VM','Email','Text','LinkedIn','Meeting','Note'
  )),
  person_reached text check (person_reached in (
    'Owner','Gatekeeper','VM','Wrong Number','No Answer','N/A'
  )),
  outcome text not null check (outcome in (
    'No Answer','Left Voicemail','Wrong Number','Gatekeeper',
    'Spoke - Receptive','Spoke - Not Receptive','Spoke - Maybe Later',
    'Asked for Materials','Scheduled Meeting','Sent Email','Sent Text','Note Only'
  )),
  duration_min integer,
  notes text,
  stage_after text,                          -- if user advanced stage in same form
  created_at timestamptz not null default now()
);

create index if not exists activities_lead_id_idx on public.activities(lead_id);
create index if not exists activities_caller_email_idx on public.activities(caller_email);
create index if not exists activities_occurred_at_idx on public.activities(occurred_at desc);
create index if not exists activities_outcome_idx on public.activities(outcome);

-- After every activity insert: update lead's attempts_count, last_contact_at,
-- and (optionally) stage if user passed stage_after
create or replace function public.update_lead_on_activity()
returns trigger language plpgsql as $$
begin
  update public.leads
  set
    attempts_count = (
      select count(*) from public.activities
      where lead_id = new.lead_id and channel = 'Call'
    ),
    last_contact_at = (
      select max(occurred_at) from public.activities where lead_id = new.lead_id
    ),
    stage = coalesce(new.stage_after, stage),
    updated_at = now()
  where id = new.lead_id;
  return new;
end $$;

drop trigger if exists trg_update_lead_on_activity on public.activities;
create trigger trg_update_lead_on_activity
  after insert on public.activities
  for each row execute function public.update_lead_on_activity();

-- -----------------------------------------------------------------------------
-- 4. DUPLICATES (rows from upload that matched existing leads)
-- -----------------------------------------------------------------------------
create table if not exists public.duplicates (
  id uuid primary key default gen_random_uuid(),

  -- snapshot of incoming row
  business_name text not null,
  industry text,
  source text,
  business_phone text,
  business_email text,
  owner_name text,
  owner_phone text,
  owner_email text,
  website text,
  website_domain text,
  phone_digits text,
  name_normalized text,
  address text,
  city text,
  state text,
  zip text,
  annual_revenue numeric,
  employees integer,
  founded_year integer,
  description text,
  fit_tier text,
  vet_status text,

  -- dedupe metadata
  matched_lead_id uuid references public.leads(id) on delete set null,
  match_reason text not null check (match_reason in (
    'website_domain','phone_digits','name_normalized','within_batch'
  )),
  uploaded_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolution text       -- 'deleted' | 'merged' | 'promoted'
);

create index if not exists duplicates_matched_lead_idx on public.duplicates(matched_lead_id);
create index if not exists duplicates_unresolved_idx on public.duplicates(resolved) where resolved = false;

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY — any authenticated user has full access
-- -----------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.leads      enable row level security;
alter table public.activities enable row level security;
alter table public.duplicates enable row level security;

drop policy if exists "authed read profiles" on public.profiles;
create policy "authed read profiles" on public.profiles
  for select to authenticated using (true);

drop policy if exists "authed full leads" on public.leads;
create policy "authed full leads" on public.leads
  for all to authenticated using (true) with check (true);

drop policy if exists "authed full activities" on public.activities;
create policy "authed full activities" on public.activities
  for all to authenticated using (true) with check (true);

drop policy if exists "authed full duplicates" on public.duplicates;
create policy "authed full duplicates" on public.duplicates
  for all to authenticated using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 6. HELPER VIEWS for dashboard
-- -----------------------------------------------------------------------------
create or replace view public.v_pipeline_counts as
  select stage, count(*)::int as count from public.leads group by stage;

create or replace view public.v_recent_activity as
  select a.*, l.business_name, l.stage as lead_stage, l.industry
  from public.activities a
  join public.leads l on l.id = a.lead_id
  order by a.occurred_at desc;

create or replace view public.v_caller_stats_7d as
  select
    caller_name,
    count(*) filter (where channel = 'Call')                                   as calls,
    count(*) filter (where outcome like 'Spoke%' or outcome = 'Asked for Materials' or outcome = 'Scheduled Meeting') as conversations,
    count(*) filter (where outcome in ('Spoke - Receptive','Asked for Materials','Scheduled Meeting'))                  as positive
  from public.activities
  where occurred_at > now() - interval '7 days'
  group by caller_name;

-- =============================================================================
-- DONE. Next: create the 4 auth users in Authentication → Users → Add user
-- =============================================================================
