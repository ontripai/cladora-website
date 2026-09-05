begin;

-- =============================================================================
-- Migration: 20260905144500_marketing_leads_management.sql
-- Description: Production-ready Marketing Leads, Atomic Deduplication,
--              and Serverless-Safe Atomic Rate Limiting
-- =============================================================================

create table if not exists public.marketing_leads (
  id uuid default gen_random_uuid() primary key,
  reference_id text not null,
  created_at timestamptz default clock_timestamp() not null,
  updated_at timestamptz default clock_timestamp() not null,
  lead_type text not null check (lead_type in ('contact', 'pilot')),
  full_name text not null check (length(trim(full_name)) between 1 and 255),
  email text not null check (length(trim(email)) between 3 and 255),
  phone text check (phone is null or length(phone) <= 50),
  role text check (role is null or role in ('admin', 'president', 'cenzor', 'owner')),
  building_type text check (building_type is null or building_type in ('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8')),
  units_count integer check (units_count is null or (units_count > 0 and units_count <= 10000)),
  current_software text check (current_software is null or length(current_software) <= 100),
  city text check (city is null or length(city) <= 100),
  county text check (county is null or length(county) <= 100),
  message text check (message is null or length(message) <= 5000),
  locale text not null check (locale in ('ro', 'en', 'fa')),
  source_page text check (source_page is null or length(source_page) <= 255),
  utm_source text check (utm_source is null or length(utm_source) <= 100),
  utm_medium text check (utm_medium is null or length(utm_medium) <= 100),
  utm_campaign text check (utm_campaign is null or length(utm_campaign) <= 100),
  utm_content text check (utm_content is null or length(utm_content) <= 100),
  utm_term text check (utm_term is null or length(utm_term) <= 100),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'rejected', 'spam')),
  consent_privacy boolean not null check (consent_privacy = true),
  consent_timestamp timestamptz not null default clock_timestamp(),
  ip_hash text check (ip_hash is null or length(ip_hash) <= 128),
  user_agent text check (user_agent is null or length(user_agent) <= 255),
  metadata jsonb not null default '{}'::jsonb,
  submission_fingerprint text check (submission_fingerprint is null or length(submission_fingerprint) <= 128),
  fingerprint_bucket bigint check (fingerprint_bucket is null or fingerprint_bucket > 0)
);

create unique index if not exists idx_marketing_leads_reference_id on public.marketing_leads (reference_id);
create unique index if not exists idx_marketing_leads_fingerprint_bucket on public.marketing_leads (submission_fingerprint, fingerprint_bucket)
  where submission_fingerprint is not null and fingerprint_bucket is not null;
create index if not exists idx_marketing_leads_created_at on public.marketing_leads (created_at desc);
create index if not exists idx_marketing_leads_status on public.marketing_leads (status);
create index if not exists idx_marketing_leads_lead_type on public.marketing_leads (lead_type);
create index if not exists idx_marketing_leads_email on public.marketing_leads (email);

-- Trigger to maintain updated_at on marketing_leads
create or replace function public.set_marketing_leads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists trg_marketing_leads_updated_at on public.marketing_leads;
create trigger trg_marketing_leads_updated_at
before update on public.marketing_leads
for each row
execute function public.set_marketing_leads_updated_at();

-- Rate limits storage for serverless-safe, atomic window-bucket rate limiting
create table if not exists public.marketing_rate_limits (
  action_key text not null check (length(trim(action_key)) between 1 and 128),
  window_bucket bigint not null check (window_bucket > 0),
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (action_key, window_bucket)
);

create index if not exists idx_marketing_rate_limits_expires on public.marketing_rate_limits (expires_at);

-- Row Level Security
alter table public.marketing_leads enable row level security;
alter table public.marketing_rate_limits enable row level security;

-- Revoke all direct anonymous / authenticated access
revoke all on table public.marketing_leads from public, anon, authenticated;
revoke all on table public.marketing_rate_limits from public, anon, authenticated;

-- Grant access strictly to service_role
grant select, insert, update on table public.marketing_leads to service_role;
grant select, insert, update, delete on table public.marketing_rate_limits to service_role;

-- Rate limit verification function (atomic window-bucket UPSERT, invoked strictly by service_role)
create or replace function public.consume_marketing_rate_limit(
  p_action_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  current_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_bucket bigint;
  v_bucket_expires timestamptz;
  v_count integer;
  v_expires_at timestamptz;
begin
  -- Validate inputs
  if p_action_key is null or length(trim(p_action_key)) = 0 or length(p_action_key) > 128 then
    raise exception 'INVALID_ACTION_KEY: action_key must be non-empty and <= 128 chars';
  end if;

  if p_max_requests is null or p_max_requests < 1 or p_max_requests > 1000 then
    raise exception 'INVALID_MAX_REQUESTS: max_requests must be between 1 and 1000';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'INVALID_WINDOW_SECONDS: window_seconds must be between 1 and 86400';
  end if;

  -- Compute discrete window bucket and bucket expiration
  v_bucket := floor(extract(epoch from v_now) / p_window_seconds);
  v_bucket_expires := to_timestamp((v_bucket + 1) * p_window_seconds);

  -- Atomic UPSERT: increments request_count or creates new window bucket row
  insert into public.marketing_rate_limits (action_key, window_bucket, request_count, expires_at)
  values (trim(p_action_key), v_bucket, 1, v_bucket_expires)
  on conflict (action_key, window_bucket)
  do update set request_count = marketing_rate_limits.request_count + 1
  returning request_count, expires_at
  into v_count, v_expires_at;

  -- Opportunistic cleanup of expired rows
  delete from public.marketing_rate_limits
  where expires_at < v_now;

  -- Evaluate rate limit verdict
  if v_count <= p_max_requests then
    return query select true, v_count, 0;
  else
    return query select
      false,
      v_count,
      greatest(1, ceil(extract(epoch from (v_expires_at - v_now)))::integer);
  end if;
end;
$$;

revoke all on function public.consume_marketing_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_marketing_rate_limit(text, integer, integer) to service_role;

commit;
