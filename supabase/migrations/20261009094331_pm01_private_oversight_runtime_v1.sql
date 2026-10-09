begin;

create schema pm_private;
comment on schema pm_private is 'Private, non-Data-API CLADORA delivery oversight runtime.';

revoke all on schema pm_private from public, anon, authenticated, service_role;
alter default privileges in schema pm_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema pm_private revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema pm_private revoke execute on functions from public, anon, authenticated, service_role;

create type pm_private.permission_code as enum (
  'pm.package.read',
  'pm.package.manage',
  'pm.evidence.attach',
  'pm.review.read',
  'pm.review.decide',
  'pm.release.read'
);

create type pm_private.cycle_state as enum (
  'planned',
  'ready',
  'in_progress',
  'in_review',
  'accepted',
  'blocked',
  'closed',
  'superseded',
  'cancelled'
);

create type pm_private.acceptance_decision as enum ('accepted','rejected','changes_required');
create type pm_private.change_decision as enum ('pending','approved','rejected');
create type pm_private.test_status as enum ('not_registered','pending','running','passed','failed','cancelled','superseded');
create type pm_private.publish_state as enum ('pending','publishing','published','failed','dead_letter');

create table pm_private.programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_-]{2,63}$'),
  repository_provider text not null check (repository_provider in ('github')),
  repository_id text not null check (length(btrim(repository_id)) between 1 and 128),
  repository_owner text not null check (length(btrim(repository_owner)) between 1 and 100),
  repository_name text not null check (length(btrim(repository_name)) between 1 and 100),
  status text not null default 'active' check (status in ('active','suspended','archived')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (repository_provider, repository_id)
);

create table pm_private.baselines (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  version_label text not null check (length(btrim(version_label)) between 1 and 64),
  controlling_commit text not null check (controlling_commit ~ '^[0-9a-f]{40}$'),
  controlling_pr integer check (controlling_pr is null or controlling_pr > 0),
  status text not null default 'proposed' check (status in ('proposed','current','superseded','withdrawn')),
  effective_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (program_id, version_label, controlling_commit)
);

create unique index pm_baselines_one_current_idx
  on pm_private.baselines(program_id) where status = 'current';

create table pm_private.workstreams (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  code text not null check (code ~ '^[A-Z][A-Z0-9_-]{1,63}$'),
  owner_label text not null check (length(btrim(owner_label)) between 1 and 160),
  scope text not null check (length(btrim(scope)) between 1 and 1000),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  active_from timestamptz not null default statement_timestamp(),
  active_until timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (active_until is null or active_until > active_from),
  unique (program_id, code)
);

create table pm_private.work_packages (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  baseline_id uuid not null references pm_private.baselines(id) on delete restrict,
  workstream_id uuid not null references pm_private.workstreams(id) on delete restrict,
  package_key text not null check (package_key ~ '^[A-Z0-9][A-Z0-9._-]{2,95}$'),
  title text not null check (length(btrim(title)) between 3 and 240),
  bounded_scope text not null check (length(btrim(bounded_scope)) between 3 and 4000),
  status text not null default 'planned' check (status in ('planned','active','in_review','accepted','closed','blocked','cancelled')),
  current_cycle_id uuid,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references platform.platform_users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (program_id, package_key)
);

create table pm_private.execution_cycles (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  package_id uuid not null references pm_private.work_packages(id) on delete restrict,
  cycle_number integer not null check (cycle_number > 0),
  parent_cycle_id uuid references pm_private.execution_cycles(id) on delete restrict,
  state pm_private.cycle_state not null default 'planned',
  scope_delta text not null default '' check (length(scope_delta) <= 4000),
  version integer not null default 1 check (version > 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid not null references platform.platform_users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (ended_at is null or started_at is null or ended_at >= started_at),
  unique (package_id, cycle_number)
);

alter table pm_private.work_packages
  add constraint pm_work_packages_current_cycle_fk
  foreign key (current_cycle_id) references pm_private.execution_cycles(id) on delete restrict;

create unique index pm_cycles_one_open_idx on pm_private.execution_cycles(package_id)
  where state in ('planned','ready','in_progress','in_review','accepted','blocked');
create index pm_cycles_program_state_idx on pm_private.execution_cycles(program_id,state,created_at desc,id desc);

create table pm_private.assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  platform_user_id uuid not null references platform.platform_users(id) on delete restrict,
  workstream_id uuid references pm_private.workstreams(id) on delete restrict,
  package_id uuid references pm_private.work_packages(id) on delete restrict,
  permission pm_private.permission_code not null,
  effect text not null default 'allow' check (effect in ('allow','deny')),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_until timestamptz,
  granted_by uuid references platform.platform_users(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  check (valid_until is null or valid_until > valid_from),
  check (package_id is null or workstream_id is not null)
);

create index pm_assignments_authority_idx on pm_private.assignments
  (platform_user_id,program_id,permission,status,valid_from,valid_until);
create unique index pm_assignments_active_scope_idx on pm_private.assignments
  (program_id,platform_user_id,coalesce(workstream_id,'00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(package_id,'00000000-0000-0000-0000-000000000000'::uuid),permission,effect)
  where status = 'active';

create table pm_private.dependencies (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  source_package_id uuid not null references pm_private.work_packages(id) on delete restrict,
  source_cycle_id uuid references pm_private.execution_cycles(id) on delete restrict,
  target_package_id uuid references pm_private.work_packages(id) on delete restrict,
  external_reference text,
  dependency_type text not null check (dependency_type in ('package','external','runtime','review','release')),
  required_state text not null check (length(btrim(required_state)) between 1 and 64),
  blocking boolean not null default true,
  availability text not null default 'available' check (availability in ('available','external_unavailable','resolved')),
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  created_at timestamptz not null default statement_timestamp(),
  check ((target_package_id is not null)::integer + (external_reference is not null)::integer = 1)
);

create table pm_private.evidence_references (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  cycle_id uuid not null references pm_private.execution_cycles(id) on delete restrict,
  commit_sha text not null check (commit_sha ~ '^[0-9a-f]{40}$'),
  evidence_type text not null check (evidence_type in ('commit','pull_request','ci_run','artifact','document','deployment_observation','migration_observation')),
  provider text not null check (length(btrim(provider)) between 1 and 64),
  provider_reference text not null check (length(btrim(provider_reference)) between 1 and 500),
  result text not null check (result in ('not_registered','pending','passed','failed','cancelled','observed')),
  bounded_summary text check (bounded_summary is null or length(bounded_summary) <= 2000),
  collected_at timestamptz not null default statement_timestamp(),
  attached_by uuid not null references platform.platform_users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (cycle_id,evidence_type,provider,provider_reference,commit_sha)
);

create table pm_private.test_runs (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  cycle_id uuid not null references pm_private.execution_cycles(id) on delete restrict,
  evidence_id uuid references pm_private.evidence_references(id) on delete restrict,
  commit_sha text not null check (commit_sha ~ '^[0-9a-f]{40}$'),
  provider text not null check (length(btrim(provider)) between 1 and 64),
  check_name text not null check (length(btrim(check_name)) between 1 and 200),
  provider_run_id text not null check (length(btrim(provider_run_id)) between 1 and 200),
  status pm_private.test_status not null,
  bounded_summary text check (bounded_summary is null or length(bounded_summary) <= 2000),
  started_at timestamptz,
  completed_at timestamptz,
  recorded_by uuid not null references platform.platform_users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  check (completed_at is null or started_at is null or completed_at >= started_at),
  unique (provider,provider_run_id,check_name)
);

create table pm_private.acceptance_decisions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  cycle_id uuid not null references pm_private.execution_cycles(id) on delete restrict,
  reviewer_id uuid not null references platform.platform_users(id) on delete restrict,
  criteria_snapshot jsonb not null check (jsonb_typeof(criteria_snapshot) = 'object'),
  decision pm_private.acceptance_decision not null,
  reason text not null check (length(btrim(reason)) between 3 and 2000),
  decided_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp()
);

create table pm_private.blockers (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  package_id uuid not null references pm_private.work_packages(id) on delete restrict,
  cycle_id uuid references pm_private.execution_cycles(id) on delete restrict,
  code text not null check (code ~ '^[A-Z][A-Z0-9_-]{2,63}$'),
  owner_id uuid references platform.platform_users(id) on delete restrict,
  status text not null default 'open' check (status in ('open','resolved','cancelled')),
  reason text not null check (length(btrim(reason)) between 3 and 2000),
  resolution_reference text check (resolution_reference is null or length(resolution_reference) <= 500),
  opened_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz,
  unique (cycle_id,code)
);

create table pm_private.change_requests (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  package_id uuid not null references pm_private.work_packages(id) on delete restrict,
  source_cycle_id uuid not null references pm_private.execution_cycles(id) on delete restrict,
  requested_scope text not null check (length(btrim(requested_scope)) between 3 and 4000),
  impact text not null check (length(btrim(impact)) between 3 and 2000),
  priority text not null check (priority in ('low','normal','high','critical')),
  decision pm_private.change_decision not null default 'pending',
  requested_by uuid not null references platform.platform_users(id) on delete restrict,
  decided_by uuid references platform.platform_users(id) on delete restrict,
  decision_reason text check (decision_reason is null or length(btrim(decision_reason)) between 3 and 2000),
  created_cycle_id uuid references pm_private.execution_cycles(id) on delete restrict,
  requested_at timestamptz not null default statement_timestamp(),
  decided_at timestamptz
);

create table pm_private.transitions (
  id bigint generated always as identity primary key,
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  cycle_id uuid not null references pm_private.execution_cycles(id) on delete restrict,
  from_state pm_private.cycle_state,
  to_state pm_private.cycle_state not null,
  actor_id uuid not null references platform.platform_users(id) on delete restrict,
  expected_version integer not null check (expected_version >= 0),
  new_version integer not null check (new_version > expected_version),
  command_id uuid not null,
  reason text not null check (length(btrim(reason)) between 3 and 2000),
  occurred_at timestamptz not null default statement_timestamp(),
  unique (cycle_id,new_version),
  unique (command_id)
);

create table pm_private.release_references (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  cycle_id uuid not null references pm_private.execution_cycles(id) on delete restrict,
  environment_class text not null check (environment_class in ('local','isolated','preview','staging','production')),
  commit_sha text not null check (commit_sha ~ '^[0-9a-f]{40}$'),
  deployment_reference text,
  migration_reference text,
  observed_status text not null check (observed_status in ('not_registered','pending','ready','failed','rolled_back','observed')),
  observed_at timestamptz not null default statement_timestamp(),
  recorded_by uuid not null references platform.platform_users(id) on delete restrict,
  check (deployment_reference is not null or migration_reference is not null)
);

create table pm_private.command_receipts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  actor_id uuid not null references platform.platform_users(id) on delete restrict,
  namespace text not null check (namespace ~ '^[a-z][a-z0-9._-]{2,95}$'),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default (statement_timestamp() + interval '30 days'),
  unique (program_id,actor_id,namespace,idempotency_key),
  unique (program_id,actor_id,request_id),
  check (expires_at > created_at)
);

create table pm_private.outbox_events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references pm_private.programs(id) on delete restrict,
  aggregate_type text not null check (aggregate_type in ('work_package','execution_cycle','evidence','test_run','acceptance','change_request')),
  aggregate_id uuid not null,
  aggregate_version integer not null check (aggregate_version > 0),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9._-]{2,127}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 16384),
  state pm_private.publish_state not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default statement_timestamp(),
  published_at timestamptz,
  last_error text check (last_error is null or length(last_error) <= 1000),
  created_at timestamptz not null default statement_timestamp(),
  unique (program_id,aggregate_type,aggregate_id,aggregate_version,event_type)
);

create index pm_packages_cursor_idx on pm_private.work_packages(program_id,created_at desc,id desc);
create index pm_dependencies_readiness_idx on pm_private.dependencies(source_package_id,blocking,availability);
create index pm_evidence_cycle_idx on pm_private.evidence_references(cycle_id,collected_at desc,id desc);
create index pm_test_runs_cycle_idx on pm_private.test_runs(cycle_id,created_at desc,id desc);
create index pm_decisions_cycle_idx on pm_private.acceptance_decisions(cycle_id,decided_at desc,id desc);
create index pm_outbox_pending_idx on pm_private.outbox_events(available_at,id) where state in ('pending','failed');

create trigger pm_programs_updated_at before update on pm_private.programs
  for each row execute function app_private.set_updated_at();
create trigger pm_packages_updated_at before update on pm_private.work_packages
  for each row execute function app_private.set_updated_at();
create trigger pm_cycles_updated_at before update on pm_private.execution_cycles
  for each row execute function app_private.set_updated_at();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'programs','baselines','workstreams','assignments','work_packages','execution_cycles',
    'dependencies','evidence_references','test_runs','acceptance_decisions','blockers',
    'change_requests','transitions','release_references','command_receipts','outbox_events'
  ] loop
    execute format('alter table pm_private.%I enable row level security', table_name);
    execute format('alter table pm_private.%I force row level security', table_name);
  end loop;
end;
$$;

revoke all on all tables in schema pm_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema pm_private from public, anon, authenticated, service_role;

create function pm_private.redact_json_v1(p_value jsonb, p_depth integer default 0)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare result jsonb; item record;
begin
  if p_value is null then return null; end if;
  if p_depth >= 8 then return '"[DEPTH_LIMIT]"'::jsonb; end if;
  case jsonb_typeof(p_value)
    when 'object' then
      result := '{}'::jsonb;
      for item in select key,value from jsonb_each(p_value) loop
        if item.key ~* '(secret|token|password|authorization|cookie|credential|api[_-]?key|private[_-]?url)' then
          result := result || jsonb_build_object(item.key,'[REDACTED]');
        else
          result := result || jsonb_build_object(item.key,pm_private.redact_json_v1(item.value,p_depth+1));
        end if;
      end loop;
      return result;
    when 'array' then
      select coalesce(jsonb_agg(pm_private.redact_json_v1(value,p_depth+1)),'[]'::jsonb)
        into result from jsonb_array_elements(p_value);
      return result;
    when 'string' then
      return to_jsonb(left(regexp_replace(trim(both '"' from p_value::text),
        '(?i)(bearer[[:space:]]+[A-Za-z0-9._~+/-]+|(token|secret|password|api[_-]?key)[=:][^&[:space:]]+)',
        '[REDACTED]','g'),1024));
    else return p_value;
  end case;
end;
$$;

create function pm_private.current_actor_v1()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare actor uuid;
begin
  if auth.uid() is null then raise exception 'pm_authentication_required' using errcode='42501'; end if;
  select pu.id into actor
  from platform.platform_users pu
  where pu.auth_user_id = auth.uid() and pu.status = 'active' and pu.deactivated_at is null;
  if actor is null then raise exception 'pm_platform_actor_required' using errcode='42501'; end if;
  if not exists (
    select 1 from platform.platform_role_assignments pra
    where pra.platform_user_id=actor and pra.status='active'
      and pra.valid_from<=statement_timestamp()
      and (pra.valid_until is null or pra.valid_until>statement_timestamp())
  ) then raise exception 'pm_platform_eligibility_required' using errcode='42501'; end if;
  return actor;
end;
$$;

create function pm_private.has_permission_v1(
  p_actor uuid,
  p_program_id uuid,
  p_permission pm_private.permission_code,
  p_workstream_id uuid default null,
  p_package_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    not exists (
      select 1 from pm_private.assignments a
      where a.platform_user_id=p_actor and a.program_id=p_program_id and a.permission=p_permission
        and a.effect='deny' and a.status='active' and a.valid_from<=statement_timestamp()
        and (a.valid_until is null or a.valid_until>statement_timestamp())
        and (a.workstream_id is null or (p_workstream_id is not null and a.workstream_id=p_workstream_id))
        and (a.package_id is null or (p_package_id is not null and a.package_id=p_package_id))
    )
    and exists (
      select 1 from pm_private.assignments a
      where a.platform_user_id=p_actor and a.program_id=p_program_id and a.permission=p_permission
        and a.effect='allow' and a.status='active' and a.valid_from<=statement_timestamp()
        and (a.valid_until is null or a.valid_until>statement_timestamp())
        and (a.workstream_id is null or (p_workstream_id is not null and a.workstream_id=p_workstream_id))
        and (a.package_id is null or (p_package_id is not null and a.package_id=p_package_id))
    );
$$;

create function pm_private.require_permission_v1(
  p_program_id uuid,
  p_permission pm_private.permission_code,
  p_workstream_id uuid default null,
  p_package_id uuid default null,
  p_require_aal2 boolean default true
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare actor uuid;
begin
  actor := pm_private.current_actor_v1();
  if p_require_aal2 and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'pm_mfa_required' using errcode='42501';
  end if;
  if not pm_private.has_permission_v1(actor,p_program_id,p_permission,p_workstream_id,p_package_id) then
    raise exception 'pm_access_denied' using errcode='42501';
  end if;
  return actor;
end;
$$;

create function pm_private.command_hash_v1(p_command jsonb)
returns text
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'command',p_command)::text,'UTF8')),'hex');
$$;

create function pm_private.valid_transition_v1(p_from pm_private.cycle_state,p_to pm_private.cycle_state)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select (p_from,p_to) in (
    ('planned','ready'),('planned','cancelled'),('ready','in_progress'),('ready','blocked'),
    ('ready','cancelled'),('in_progress','in_review'),('in_progress','blocked'),
    ('in_progress','cancelled'),('blocked','ready'),('blocked','in_progress'),
    ('blocked','cancelled'),('in_review','in_progress'),('in_review','accepted'),
    ('in_review','blocked'),('accepted','closed'),('accepted','in_progress')
  );
$$;

create function pm_private.list_packages_internal_v1(
  p_program_id uuid,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare rows_json jsonb; next_created timestamptz; next_id uuid;
begin
  perform pm_private.require_permission_v1(p_program_id,'pm.package.read',null,null,false);
  if p_limit < 1 or p_limit > 50 or jsonb_typeof(coalesce(p_filters,'{}'::jsonb)) <> 'object' then
    raise exception 'pm_invalid_list_parameters' using errcode='22023';
  end if;
  with page as (
    select wp.id,wp.package_key,wp.title,wp.status,wp.version,wp.workstream_id,wp.current_cycle_id,
      ec.cycle_number,ec.state as cycle_state,ec.version as cycle_version,wp.created_at
    from pm_private.work_packages wp
    left join pm_private.execution_cycles ec on ec.id=wp.current_cycle_id
    where wp.program_id=p_program_id
      and (p_filters->>'status' is null or wp.status=p_filters->>'status')
      and (p_filters->>'workstream_id' is null or wp.workstream_id=(p_filters->>'workstream_id')::uuid)
      and (p_cursor_created_at is null or (wp.created_at,wp.id)<(p_cursor_created_at,p_cursor_id))
    order by wp.created_at desc,wp.id desc limit p_limit+1
  ), visible as (select * from page limit p_limit)
  select coalesce(jsonb_agg(to_jsonb(visible) order by created_at desc,id desc),'[]'::jsonb),
    (select created_at from visible order by created_at,id limit 1),
    (select id from visible order by created_at,id limit 1)
  into rows_json,next_created,next_id from visible;
  return jsonb_build_object('items',rows_json,'next_cursor',case when jsonb_array_length(rows_json)=p_limit
    then jsonb_build_object('created_at',next_created,'id',next_id) else null end);
end;
$$;

create function pm_private.get_package_internal_v1(p_program_id uuid,p_package_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare actor uuid; package_row record; can_review boolean; result jsonb;
begin
  select wp.*,ec.state as cycle_state,ec.cycle_number,ec.version as cycle_version,ec.started_at,ec.ended_at
    into package_row from pm_private.work_packages wp
    left join pm_private.execution_cycles ec on ec.id=wp.current_cycle_id
    where wp.id=p_package_id and wp.program_id=p_program_id;
  if package_row.id is null then raise exception 'pm_package_not_found' using errcode='P0002'; end if;
  actor := pm_private.require_permission_v1(p_program_id,'pm.package.read',package_row.workstream_id,p_package_id,false);
  can_review := pm_private.has_permission_v1(actor,p_program_id,'pm.review.read',package_row.workstream_id,p_package_id);
  result := jsonb_build_object(
    'package',jsonb_build_object('id',package_row.id,'package_key',package_row.package_key,'title',package_row.title,
      'bounded_scope',package_row.bounded_scope,'status',package_row.status,'version',package_row.version,
      'workstream_id',package_row.workstream_id,'baseline_id',package_row.baseline_id),
    'cycle',jsonb_build_object('id',package_row.current_cycle_id,'number',package_row.cycle_number,
      'state',package_row.cycle_state,'version',package_row.cycle_version,
      'started_at',package_row.started_at,'ended_at',package_row.ended_at),
    'evidence',case when can_review then (
      select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'commit_sha',e.commit_sha,'type',e.evidence_type,
        'provider',e.provider,'reference',e.provider_reference,'result',e.result,'summary',e.bounded_summary,
        'collected_at',e.collected_at) order by e.collected_at desc,e.id desc),'[]'::jsonb)
      from pm_private.evidence_references e where e.cycle_id=package_row.current_cycle_id
    ) else '[]'::jsonb end
  );
  return result;
end;
$$;

create function pm_private.register_package_internal_v1(p_command jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
#variable_conflict use_variable
declare
  program_id uuid; baseline_id uuid; workstream_id uuid; request_id uuid;
  actor uuid; request_hash text; idempotency_key text; package_key text; title text; bounded_scope text;
  existing pm_private.command_receipts%rowtype;
  package_row pm_private.work_packages%rowtype; cycle_row pm_private.execution_cycles%rowtype; response jsonb;
begin
  if jsonb_typeof(p_command) <> 'object' then raise exception 'pm_invalid_command' using errcode='22023'; end if;
  program_id := nullif(p_command->>'program_id','')::uuid;
  baseline_id := nullif(p_command->>'baseline_id','')::uuid;
  workstream_id := nullif(p_command->>'workstream_id','')::uuid;
  request_id := nullif(p_command->>'request_id','')::uuid;
  idempotency_key := p_command->>'idempotency_key';
  package_key := upper(btrim(p_command->>'package_key'));
  title := btrim(p_command->>'title');
  bounded_scope := btrim(p_command->>'bounded_scope');
  if program_id is null or baseline_id is null or workstream_id is null or request_id is null
    or coalesce((p_command->>'expected_version')::integer,-1) <> 0
    or idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    or package_key !~ '^[A-Z0-9][A-Z0-9._-]{2,95}$'
    or length(title) not between 3 and 240 or length(bounded_scope) not between 3 and 4000 then
    raise exception 'pm_invalid_command' using errcode='22023';
  end if;
  actor := pm_private.require_permission_v1(program_id,'pm.package.manage',workstream_id,null,true);
  request_hash := pm_private.command_hash_v1(p_command);
  perform pg_advisory_xact_lock(hashtextextended(program_id::text||':'||actor::text||':pm.package.register:'||idempotency_key,0));
  select * into existing from pm_private.command_receipts
    where command_receipts.program_id=(p_command->>'program_id')::uuid
      and actor_id=actor and namespace='pm.package.register' and command_receipts.idempotency_key=p_command->>'idempotency_key';
  if found then
    if existing.request_hash <> request_hash then raise exception 'pm_idempotency_conflict' using errcode='23505'; end if;
    return existing.response || jsonb_build_object('idempotent',true);
  end if;
  if not exists (select 1 from pm_private.programs p where p.id=program_id and p.status='active')
    or not exists (select 1 from pm_private.baselines b where b.id=baseline_id and b.program_id=program_id)
    or not exists (select 1 from pm_private.workstreams w where w.id=workstream_id and w.program_id=program_id and w.status='active') then
    raise exception 'pm_subject_mismatch' using errcode='22023';
  end if;
  insert into pm_private.work_packages(program_id,baseline_id,workstream_id,package_key,title,bounded_scope,created_by)
    values(program_id,baseline_id,workstream_id,package_key,title,bounded_scope,actor) returning * into package_row;
  insert into pm_private.execution_cycles(program_id,package_id,cycle_number,state,scope_delta,created_by)
    values(program_id,package_row.id,1,'planned','',actor) returning * into cycle_row;
  update pm_private.work_packages set current_cycle_id=cycle_row.id where id=package_row.id;
  insert into pm_private.transitions(program_id,cycle_id,from_state,to_state,actor_id,expected_version,new_version,command_id,reason)
    values(program_id,cycle_row.id,null,'planned',actor,0,1,request_id,'Initial package cycle registered');
  response := jsonb_build_object('package_id',package_row.id,'cycle_id',cycle_row.id,'package_key',package_row.package_key,
    'package_version',package_row.version,'cycle_version',cycle_row.version,'state',cycle_row.state,'idempotent',false);
  insert into pm_private.outbox_events(program_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
    values(program_id,'work_package',package_row.id,package_row.version,'pm.package.registered',
      pm_private.redact_json_v1(response||jsonb_build_object('request_id',request_id)));
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,request_id,after_snapshot,reason)
    values(null,auth.uid(),'PM_INTERNAL','PM_PACKAGE_REGISTERED','pm_private.work_package',package_row.id,request_id,
      pm_private.redact_json_v1(response),'Authorized private PM package registration');
  insert into pm_private.command_receipts(program_id,actor_id,namespace,idempotency_key,request_id,request_hash,response)
    values(program_id,actor,'pm.package.register',idempotency_key,request_id,request_hash,response);
  return response;
end;
$$;

create function pm_private.transition_cycle_internal_v1(p_command jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
#variable_conflict use_variable
declare
  program_id uuid; cycle_id uuid; request_id uuid; actor uuid; request_hash text; idempotency_key text;
  expected_version integer; target_state pm_private.cycle_state; prior_state pm_private.cycle_state; reason text;
  existing pm_private.command_receipts%rowtype; cycle_row record; response jsonb; new_package_status text;
begin
  if jsonb_typeof(p_command) <> 'object' then raise exception 'pm_invalid_command' using errcode='22023'; end if;
  program_id := nullif(p_command->>'program_id','')::uuid;
  cycle_id := nullif(p_command->>'cycle_id','')::uuid;
  request_id := nullif(p_command->>'request_id','')::uuid;
  expected_version := (p_command->>'expected_version')::integer;
  target_state := (p_command->>'target_state')::pm_private.cycle_state;
  idempotency_key := p_command->>'idempotency_key';
  reason := btrim(p_command->>'reason');
  if program_id is null or cycle_id is null or request_id is null or expected_version < 1
    or idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' or length(reason) not between 3 and 2000 then
    raise exception 'pm_invalid_command' using errcode='22023';
  end if;
  select ec.*,wp.workstream_id,wp.created_by as package_created_by into cycle_row
    from pm_private.execution_cycles ec join pm_private.work_packages wp on wp.id=ec.package_id
    where ec.id=cycle_id and ec.program_id=program_id;
  if cycle_row.id is null then raise exception 'pm_cycle_not_found' using errcode='P0002'; end if;
  actor := pm_private.require_permission_v1(program_id,'pm.package.manage',cycle_row.workstream_id,cycle_row.package_id,true);
  request_hash := pm_private.command_hash_v1(p_command);
  perform pg_advisory_xact_lock(hashtextextended(program_id::text||':'||actor::text||':pm.cycle.transition:'||idempotency_key,0));
  select * into existing from pm_private.command_receipts
    where command_receipts.program_id=(p_command->>'program_id')::uuid and actor_id=actor
      and namespace='pm.cycle.transition' and command_receipts.idempotency_key=p_command->>'idempotency_key';
  if found then
    if existing.request_hash <> request_hash then raise exception 'pm_idempotency_conflict' using errcode='23505'; end if;
    return existing.response || jsonb_build_object('idempotent',true);
  end if;
  select ec.*,wp.workstream_id into cycle_row
    from pm_private.execution_cycles ec join pm_private.work_packages wp on wp.id=ec.package_id
    where ec.id=cycle_id and ec.program_id=program_id for update of ec;
  if cycle_row.version <> expected_version then raise exception 'pm_concurrency_conflict' using errcode='40001'; end if;
  if not pm_private.valid_transition_v1(cycle_row.state,target_state) then
    raise exception 'pm_illegal_transition' using errcode='22023';
  end if;
  prior_state := cycle_row.state;
  update pm_private.execution_cycles set state=target_state,version=version+1,
    started_at=case when target_state='in_progress' and started_at is null then statement_timestamp() else started_at end,
    ended_at=case when target_state in ('closed','superseded','cancelled') then statement_timestamp() else null end
    where id=cycle_id returning * into cycle_row;
  new_package_status := case target_state
    when 'in_review' then 'in_review' when 'accepted' then 'accepted' when 'closed' then 'closed'
    when 'blocked' then 'blocked' when 'cancelled' then 'cancelled' else 'active' end;
  update pm_private.work_packages set status=new_package_status,version=version+1 where id=cycle_row.package_id;
  insert into pm_private.transitions(program_id,cycle_id,from_state,to_state,actor_id,expected_version,new_version,command_id,reason)
    values(program_id,cycle_id,prior_state,target_state,
      actor,expected_version,cycle_row.version,request_id,reason);
  response := jsonb_build_object('package_id',cycle_row.package_id,'cycle_id',cycle_id,'state',target_state,
    'cycle_version',cycle_row.version,'idempotent',false);
  insert into pm_private.outbox_events(program_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
    values(program_id,'execution_cycle',cycle_id,cycle_row.version,'pm.cycle.transitioned',
      pm_private.redact_json_v1(response||jsonb_build_object('request_id',request_id,'reason',reason)));
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,request_id,after_snapshot,reason)
    values(null,auth.uid(),'PM_INTERNAL','PM_CYCLE_TRANSITIONED','pm_private.execution_cycle',cycle_id,request_id,
      pm_private.redact_json_v1(response),reason);
  insert into pm_private.command_receipts(program_id,actor_id,namespace,idempotency_key,request_id,request_hash,response)
    values(program_id,actor,'pm.cycle.transition',idempotency_key,request_id,request_hash,response);
  return response;
end;
$$;

create function pm_private.attach_evidence_internal_v1(p_command jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
#variable_conflict use_variable
declare
  program_id uuid; cycle_id uuid; request_id uuid; actor uuid; request_hash text; idempotency_key text;
  commit_sha text; evidence_type text; provider text; provider_reference text; result_status text; summary text;
  existing pm_private.command_receipts%rowtype; subject record; evidence_row pm_private.evidence_references%rowtype; response jsonb;
begin
  if jsonb_typeof(p_command) <> 'object' then raise exception 'pm_invalid_command' using errcode='22023'; end if;
  program_id := nullif(p_command->>'program_id','')::uuid;
  cycle_id := nullif(p_command->>'cycle_id','')::uuid;
  request_id := nullif(p_command->>'request_id','')::uuid;
  idempotency_key := p_command->>'idempotency_key';
  commit_sha := lower(p_command->>'commit_sha');
  evidence_type := p_command->>'evidence_type';
  provider := btrim(p_command->>'provider');
  provider_reference := btrim(p_command->>'provider_reference');
  result_status := p_command->>'result';
  summary := nullif(btrim(p_command->>'bounded_summary'),'');
  if program_id is null or cycle_id is null or request_id is null
    or coalesce((p_command->>'expected_version')::integer,-1) < 1
    or idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    or commit_sha !~ '^[0-9a-f]{40}$'
    or evidence_type not in ('commit','pull_request','ci_run','artifact','document','deployment_observation','migration_observation')
    or length(provider) not between 1 and 64 or length(provider_reference) not between 1 and 500
    or provider_reference ~* '^https?://' or provider_reference ~* '(token|secret|password|credential)'
    or result_status not in ('not_registered','pending','passed','failed','cancelled','observed')
    or length(coalesce(summary,'')) > 2000 then raise exception 'pm_invalid_command' using errcode='22023';
  end if;
  select ec.package_id,ec.version,wp.workstream_id into subject
    from pm_private.execution_cycles ec join pm_private.work_packages wp on wp.id=ec.package_id
    where ec.id=cycle_id and ec.program_id=program_id;
  if subject.package_id is null then raise exception 'pm_cycle_not_found' using errcode='P0002'; end if;
  if subject.version <> (p_command->>'expected_version')::integer then
    raise exception 'pm_concurrency_conflict' using errcode='40001';
  end if;
  actor := pm_private.require_permission_v1(program_id,'pm.evidence.attach',subject.workstream_id,subject.package_id,true);
  request_hash := pm_private.command_hash_v1(p_command);
  perform pg_advisory_xact_lock(hashtextextended(program_id::text||':'||actor::text||':pm.evidence.attach:'||idempotency_key,0));
  select * into existing from pm_private.command_receipts
    where command_receipts.program_id=(p_command->>'program_id')::uuid and actor_id=actor
      and namespace='pm.evidence.attach' and command_receipts.idempotency_key=p_command->>'idempotency_key';
  if found then
    if existing.request_hash <> request_hash then raise exception 'pm_idempotency_conflict' using errcode='23505'; end if;
    return existing.response || jsonb_build_object('idempotent',true);
  end if;
  insert into pm_private.evidence_references(program_id,cycle_id,commit_sha,evidence_type,provider,
    provider_reference,result,bounded_summary,attached_by)
    values(program_id,cycle_id,commit_sha,evidence_type,provider,provider_reference,result_status,
      case when summary is null then null else pm_private.redact_json_v1(to_jsonb(summary))#>>'{}' end,actor)
    returning * into evidence_row;
  response := jsonb_build_object('evidence_id',evidence_row.id,'cycle_id',cycle_id,'commit_sha',commit_sha,
    'result',result_status,'idempotent',false);
  insert into pm_private.outbox_events(program_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
    values(program_id,'evidence',evidence_row.id,1,'pm.evidence.attached',
      pm_private.redact_json_v1(response||jsonb_build_object('request_id',request_id)));
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,request_id,after_snapshot,reason)
    values(null,auth.uid(),'PM_INTERNAL','PM_EVIDENCE_ATTACHED','pm_private.evidence_reference',evidence_row.id,
      request_id,pm_private.redact_json_v1(response),'Metadata-only PM evidence attached');
  insert into pm_private.command_receipts(program_id,actor_id,namespace,idempotency_key,request_id,request_hash,response)
    values(program_id,actor,'pm.evidence.attach',idempotency_key,request_id,request_hash,response);
  return response;
end;
$$;

create function pm_private.record_test_result_internal_v1(p_command jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
#variable_conflict use_variable
declare
  program_id uuid; cycle_id uuid; evidence_id uuid; request_id uuid; actor uuid; request_hash text; idempotency_key text;
  commit_sha text; provider text; check_name text; provider_run_id text; run_status pm_private.test_status; summary text;
  started_at timestamptz; completed_at timestamptz;
  existing pm_private.command_receipts%rowtype; subject record; test_row pm_private.test_runs%rowtype; response jsonb;
begin
  if jsonb_typeof(p_command) <> 'object' then raise exception 'pm_invalid_command' using errcode='22023'; end if;
  program_id := nullif(p_command->>'program_id','')::uuid;
  cycle_id := nullif(p_command->>'cycle_id','')::uuid;
  evidence_id := nullif(p_command->>'evidence_id','')::uuid;
  request_id := nullif(p_command->>'request_id','')::uuid;
  idempotency_key := p_command->>'idempotency_key';
  commit_sha := lower(p_command->>'commit_sha');
  provider := btrim(p_command->>'provider');
  check_name := btrim(p_command->>'check_name');
  provider_run_id := btrim(p_command->>'provider_run_id');
  run_status := (p_command->>'status')::pm_private.test_status;
  summary := nullif(btrim(p_command->>'bounded_summary'),'');
  started_at := nullif(p_command->>'started_at','')::timestamptz;
  completed_at := nullif(p_command->>'completed_at','')::timestamptz;
  if program_id is null or cycle_id is null or request_id is null
    or coalesce((p_command->>'expected_version')::integer,-1) < 1
    or idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' or commit_sha !~ '^[0-9a-f]{40}$'
    or length(provider) not between 1 and 64 or length(check_name) not between 1 and 200
    or length(provider_run_id) not between 1 and 200 or provider_run_id ~* '^https?://'
    or length(coalesce(summary,'')) > 2000 or (completed_at is not null and started_at is not null and completed_at<started_at) then
    raise exception 'pm_invalid_command' using errcode='22023';
  end if;
  select ec.package_id,ec.version,wp.workstream_id into subject
    from pm_private.execution_cycles ec join pm_private.work_packages wp on wp.id=ec.package_id
    where ec.id=cycle_id and ec.program_id=program_id;
  if subject.package_id is null then raise exception 'pm_cycle_not_found' using errcode='P0002'; end if;
  if subject.version <> (p_command->>'expected_version')::integer then raise exception 'pm_concurrency_conflict' using errcode='40001'; end if;
  if evidence_id is not null and not exists (
    select 1 from pm_private.evidence_references e where e.id=evidence_id and e.cycle_id=cycle_id and e.commit_sha=commit_sha
  ) then raise exception 'pm_evidence_mismatch' using errcode='22023'; end if;
  actor := pm_private.require_permission_v1(program_id,'pm.evidence.attach',subject.workstream_id,subject.package_id,true);
  request_hash := pm_private.command_hash_v1(p_command);
  perform pg_advisory_xact_lock(hashtextextended(program_id::text||':'||actor::text||':pm.test.record:'||idempotency_key,0));
  select * into existing from pm_private.command_receipts
    where command_receipts.program_id=(p_command->>'program_id')::uuid and actor_id=actor
      and namespace='pm.test.record' and command_receipts.idempotency_key=p_command->>'idempotency_key';
  if found then
    if existing.request_hash <> request_hash then raise exception 'pm_idempotency_conflict' using errcode='23505'; end if;
    return existing.response || jsonb_build_object('idempotent',true);
  end if;
  insert into pm_private.test_runs(program_id,cycle_id,evidence_id,commit_sha,provider,check_name,provider_run_id,status,
    bounded_summary,started_at,completed_at,recorded_by)
    values(program_id,cycle_id,evidence_id,commit_sha,provider,check_name,provider_run_id,run_status,
      case when summary is null then null else pm_private.redact_json_v1(to_jsonb(summary))#>>'{}' end,
      started_at,completed_at,actor) returning * into test_row;
  response := jsonb_build_object('test_run_id',test_row.id,'cycle_id',cycle_id,'commit_sha',commit_sha,
    'check_name',check_name,'status',run_status,'idempotent',false);
  insert into pm_private.outbox_events(program_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
    values(program_id,'test_run',test_row.id,1,'pm.test.recorded',
      pm_private.redact_json_v1(response||jsonb_build_object('request_id',request_id)));
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,request_id,after_snapshot,reason)
    values(null,auth.uid(),'PM_INTERNAL','PM_TEST_RESULT_RECORDED','pm_private.test_run',test_row.id,request_id,
      pm_private.redact_json_v1(response),'Exact-commit PM test observation recorded; no acceptance side effect');
  insert into pm_private.command_receipts(program_id,actor_id,namespace,idempotency_key,request_id,request_hash,response)
    values(program_id,actor,'pm.test.record',idempotency_key,request_id,request_hash,response);
  return response;
end;
$$;

create function pm_private.record_acceptance_internal_v1(p_command jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
#variable_conflict use_variable
declare
  program_id uuid; cycle_id uuid; request_id uuid; actor uuid; request_hash text; idempotency_key text;
  expected_version integer; decision_value pm_private.acceptance_decision; criteria jsonb; reason text;
  existing pm_private.command_receipts%rowtype; subject record; decision_row pm_private.acceptance_decisions%rowtype; response jsonb;
begin
  if jsonb_typeof(p_command) <> 'object' then raise exception 'pm_invalid_command' using errcode='22023'; end if;
  program_id := nullif(p_command->>'program_id','')::uuid;
  cycle_id := nullif(p_command->>'cycle_id','')::uuid;
  request_id := nullif(p_command->>'request_id','')::uuid;
  expected_version := (p_command->>'expected_version')::integer;
  idempotency_key := p_command->>'idempotency_key';
  decision_value := (p_command->>'decision')::pm_private.acceptance_decision;
  criteria := p_command->'criteria_snapshot';
  reason := btrim(p_command->>'reason');
  if program_id is null or cycle_id is null or request_id is null or expected_version < 1
    or idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    or jsonb_typeof(criteria) <> 'object' or pg_column_size(criteria) > 16384
    or length(reason) not between 3 and 2000 then raise exception 'pm_invalid_command' using errcode='22023';
  end if;
  select ec.package_id,ec.version,ec.state,wp.workstream_id,wp.created_by into subject
    from pm_private.execution_cycles ec join pm_private.work_packages wp on wp.id=ec.package_id
    where ec.id=cycle_id and ec.program_id=program_id;
  if subject.package_id is null then raise exception 'pm_cycle_not_found' using errcode='P0002'; end if;
  if subject.version <> expected_version then raise exception 'pm_concurrency_conflict' using errcode='40001'; end if;
  if subject.state <> 'in_review' then raise exception 'pm_review_state_required' using errcode='22023'; end if;
  actor := pm_private.require_permission_v1(program_id,'pm.review.decide',subject.workstream_id,subject.package_id,true);
  if subject.created_by=actor then raise exception 'pm_self_acceptance_denied' using errcode='42501'; end if;
  if decision_value='accepted' and not exists (
    select 1 from pm_private.test_runs tr where tr.cycle_id=cycle_id and tr.status='passed'
  ) then raise exception 'pm_acceptance_evidence_required' using errcode='22023'; end if;
  request_hash := pm_private.command_hash_v1(p_command);
  perform pg_advisory_xact_lock(hashtextextended(program_id::text||':'||actor::text||':pm.acceptance.record:'||idempotency_key,0));
  select * into existing from pm_private.command_receipts
    where command_receipts.program_id=(p_command->>'program_id')::uuid and actor_id=actor
      and namespace='pm.acceptance.record' and command_receipts.idempotency_key=p_command->>'idempotency_key';
  if found then
    if existing.request_hash <> request_hash then raise exception 'pm_idempotency_conflict' using errcode='23505'; end if;
    return existing.response || jsonb_build_object('idempotent',true);
  end if;
  insert into pm_private.acceptance_decisions(program_id,cycle_id,reviewer_id,criteria_snapshot,decision,reason)
    values(program_id,cycle_id,actor,pm_private.redact_json_v1(criteria),decision_value,
      pm_private.redact_json_v1(to_jsonb(reason))#>>'{}') returning * into decision_row;
  response := jsonb_build_object('decision_id',decision_row.id,'cycle_id',cycle_id,'decision',decision_value,
    'cycle_version',expected_version,'idempotent',false);
  insert into pm_private.outbox_events(program_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
    values(program_id,'acceptance',decision_row.id,1,'pm.acceptance.recorded',
      pm_private.redact_json_v1(response||jsonb_build_object('request_id',request_id)));
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,request_id,after_snapshot,reason)
    values(null,auth.uid(),'PM_INTERNAL','PM_ACCEPTANCE_RECORDED','pm_private.acceptance_decision',decision_row.id,
      request_id,pm_private.redact_json_v1(response),pm_private.redact_json_v1(to_jsonb(reason))#>>'{}');
  insert into pm_private.command_receipts(program_id,actor_id,namespace,idempotency_key,request_id,request_hash,response)
    values(program_id,actor,'pm.acceptance.record',idempotency_key,request_id,request_hash,response);
  return response;
end;
$$;

create function pm_private.request_change_internal_v1(p_command jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
#variable_conflict use_variable
declare
  action_name text; program_id uuid; package_id uuid; source_cycle_id uuid; change_request_id uuid; request_id uuid;
  actor uuid; request_hash text; idempotency_key text; namespace_value text; expected_version integer;
  requested_scope text; impact text; priority_value text; decision_value pm_private.change_decision; decision_reason text;
  existing pm_private.command_receipts%rowtype; subject record; change_row pm_private.change_requests%rowtype;
  source_cycle pm_private.execution_cycles%rowtype; new_cycle pm_private.execution_cycles%rowtype; response jsonb;
  prior_state pm_private.cycle_state; next_cycle integer;
begin
  if jsonb_typeof(p_command) <> 'object' then raise exception 'pm_invalid_command' using errcode='22023'; end if;
  action_name := p_command->>'action';
  program_id := nullif(p_command->>'program_id','')::uuid;
  request_id := nullif(p_command->>'request_id','')::uuid;
  expected_version := (p_command->>'expected_version')::integer;
  idempotency_key := p_command->>'idempotency_key';
  if action_name not in ('request','decide') or program_id is null or request_id is null or expected_version < 1
    or idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'pm_invalid_command' using errcode='22023';
  end if;
  if action_name='request' then
    package_id := nullif(p_command->>'package_id','')::uuid;
    source_cycle_id := nullif(p_command->>'source_cycle_id','')::uuid;
    requested_scope := btrim(p_command->>'requested_scope');
    impact := btrim(p_command->>'impact');
    priority_value := p_command->>'priority';
    if package_id is null or source_cycle_id is null or length(requested_scope) not between 3 and 4000
      or length(impact) not between 3 and 2000 or priority_value not in ('low','normal','high','critical') then
      raise exception 'pm_invalid_command' using errcode='22023';
    end if;
    select ec.version,wp.workstream_id into subject
      from pm_private.execution_cycles ec join pm_private.work_packages wp on wp.id=ec.package_id
      where ec.id=source_cycle_id and ec.package_id=package_id and ec.program_id=program_id;
    if subject.workstream_id is null then raise exception 'pm_cycle_not_found' using errcode='P0002'; end if;
    if subject.version<>expected_version then raise exception 'pm_concurrency_conflict' using errcode='40001'; end if;
    actor := pm_private.require_permission_v1(program_id,'pm.package.manage',subject.workstream_id,package_id,true);
    namespace_value := 'pm.change.request';
  else
    change_request_id := nullif(p_command->>'change_request_id','')::uuid;
    decision_value := (p_command->>'decision')::pm_private.change_decision;
    decision_reason := btrim(p_command->>'decision_reason');
    if change_request_id is null or decision_value not in ('approved','rejected')
      or length(decision_reason) not between 3 and 2000 then raise exception 'pm_invalid_command' using errcode='22023'; end if;
    select cr.package_id,cr.source_cycle_id,cr.requested_by,cr.decision,ec.version,wp.workstream_id
      into subject from pm_private.change_requests cr
      join pm_private.execution_cycles ec on ec.id=cr.source_cycle_id
      join pm_private.work_packages wp on wp.id=cr.package_id
      where cr.id=change_request_id and cr.program_id=program_id;
    if subject.package_id is null then raise exception 'pm_change_request_not_found' using errcode='P0002'; end if;
    if subject.version<>expected_version then raise exception 'pm_concurrency_conflict' using errcode='40001'; end if;
    actor := pm_private.require_permission_v1(program_id,'pm.review.decide',subject.workstream_id,subject.package_id,true);
    if subject.requested_by=actor then raise exception 'pm_self_change_decision_denied' using errcode='42501'; end if;
    package_id := subject.package_id;
    source_cycle_id := subject.source_cycle_id;
    namespace_value := 'pm.change.decide';
  end if;
  request_hash := pm_private.command_hash_v1(p_command);
  perform pg_advisory_xact_lock(hashtextextended(program_id::text||':'||actor::text||':'||namespace_value||':'||idempotency_key,0));
  select * into existing from pm_private.command_receipts
    where command_receipts.program_id=(p_command->>'program_id')::uuid and actor_id=actor
      and namespace=namespace_value and command_receipts.idempotency_key=p_command->>'idempotency_key';
  if found then
    if existing.request_hash<>request_hash then raise exception 'pm_idempotency_conflict' using errcode='23505'; end if;
    return existing.response||jsonb_build_object('idempotent',true);
  end if;
  if action_name='request' then
    insert into pm_private.change_requests(program_id,package_id,source_cycle_id,requested_scope,impact,priority,requested_by)
      values(program_id,package_id,source_cycle_id,
        pm_private.redact_json_v1(to_jsonb(requested_scope))#>>'{}',
        pm_private.redact_json_v1(to_jsonb(impact))#>>'{}',priority_value,actor) returning * into change_row;
    response := jsonb_build_object('change_request_id',change_row.id,'package_id',package_id,'source_cycle_id',source_cycle_id,
      'decision','pending','idempotent',false);
    insert into pm_private.outbox_events(program_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
      values(program_id,'change_request',change_row.id,1,'pm.change.requested',
        pm_private.redact_json_v1(response||jsonb_build_object('request_id',request_id)));
    insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,request_id,after_snapshot,reason)
      values(null,auth.uid(),'PM_INTERNAL','PM_CHANGE_REQUESTED','pm_private.change_request',change_row.id,request_id,
        pm_private.redact_json_v1(response),'PM scope change requested; no automatic approval');
  else
    select * into change_row from pm_private.change_requests where id=change_request_id for update;
    if change_row.decision<>'pending' then raise exception 'pm_change_already_decided' using errcode='22023'; end if;
    select * into source_cycle from pm_private.execution_cycles where id=source_cycle_id for update;
    if source_cycle.version<>expected_version then raise exception 'pm_concurrency_conflict' using errcode='40001'; end if;
    update pm_private.change_requests set decision=decision_value,decided_by=actor,
      decision_reason=pm_private.redact_json_v1(to_jsonb(decision_reason))#>>'{}',decided_at=statement_timestamp()
      where id=change_request_id returning * into change_row;
    if decision_value='approved' then
      if source_cycle.state not in ('in_review','accepted','closed') then
        raise exception 'pm_change_source_state_invalid' using errcode='22023';
      end if;
      prior_state := source_cycle.state;
      update pm_private.execution_cycles set state='superseded',version=version+1,ended_at=statement_timestamp()
        where id=source_cycle_id returning * into source_cycle;
      insert into pm_private.transitions(program_id,cycle_id,from_state,to_state,actor_id,expected_version,new_version,command_id,reason)
        values(program_id,source_cycle_id,prior_state,
          'superseded',actor,expected_version,source_cycle.version,request_id,decision_reason);
      select coalesce(max(ec.cycle_number),0)+1 into next_cycle
        from pm_private.execution_cycles ec where ec.package_id=change_row.package_id;
      insert into pm_private.execution_cycles(program_id,package_id,cycle_number,parent_cycle_id,state,scope_delta,created_by)
        values(program_id,change_row.package_id,next_cycle,source_cycle_id,'planned',change_row.requested_scope,actor) returning * into new_cycle;
      insert into pm_private.transitions(program_id,cycle_id,from_state,to_state,actor_id,expected_version,new_version,command_id,reason)
        values(program_id,new_cycle.id,null,'planned',actor,0,1,change_request_id,'Approved change created linked cycle');
      update pm_private.work_packages set current_cycle_id=new_cycle.id,status='planned',version=version+1 where id=change_row.package_id;
      update pm_private.change_requests set created_cycle_id=new_cycle.id where id=change_request_id returning * into change_row;
    end if;
    response := jsonb_build_object('change_request_id',change_request_id,'package_id',package_id,'decision',decision_value,
      'created_cycle_id',change_row.created_cycle_id,'idempotent',false);
    insert into pm_private.outbox_events(program_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
      values(program_id,'change_request',change_request_id,2,'pm.change.decided',
        pm_private.redact_json_v1(response||jsonb_build_object('request_id',request_id)));
    insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,request_id,after_snapshot,reason)
      values(null,auth.uid(),'PM_INTERNAL','PM_CHANGE_DECIDED','pm_private.change_request',change_request_id,request_id,
        pm_private.redact_json_v1(response),pm_private.redact_json_v1(to_jsonb(decision_reason))#>>'{}');
  end if;
  insert into pm_private.command_receipts(program_id,actor_id,namespace,idempotency_key,request_id,request_hash,response)
    values(program_id,actor,namespace_value,idempotency_key,request_id,request_hash,response);
  return response;
end;
$$;

create function pm_private.prevent_history_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'pm_history_is_append_only' using errcode='42501';
end;
$$;

create trigger pm_transitions_immutable before update or delete on pm_private.transitions
  for each row execute function pm_private.prevent_history_mutation_v1();
create trigger pm_acceptance_immutable before update or delete on pm_private.acceptance_decisions
  for each row execute function pm_private.prevent_history_mutation_v1();
create trigger pm_receipts_immutable before update or delete on pm_private.command_receipts
  for each row execute function pm_private.prevent_history_mutation_v1();

revoke all on all functions in schema pm_private from public, anon, authenticated, service_role;
revoke all on schema pm_private from public, anon, authenticated, service_role;

comment on function pm_private.list_packages_internal_v1(uuid,jsonb,integer,timestamptz,uuid)
  is 'Private exact-version package projection; never exposed through PostgREST.';
comment on function pm_private.register_package_internal_v1(jsonb)
  is 'Private atomic command with actor-bound replay receipt, audit event and outbox event.';

commit;
