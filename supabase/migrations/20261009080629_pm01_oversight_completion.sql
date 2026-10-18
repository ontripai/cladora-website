-- PM-01C: authenticated oversight gateway and internal monitoring.
-- Forward-only; does not alter work credentials or existing report history.

create table pm_control.alerts (
  id bigint generated always as identity primary key,
  project_code text not null references pm_control.projects(code),
  package_code text,
  kind text not null check (kind in ('stale_report','blocked','review_wait','credential_expiry')),
  severity text not null check (severity in ('info','warning','critical')),
  fingerprint text not null,
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  first_seen_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  unique (project_code, fingerprint),
  foreign key (project_code, package_code) references pm_control.packages(project_code, code)
);

alter table pm_control.alerts enable row level security;
revoke all on pm_control.alerts from public, anon, authenticated, service_role;

create or replace function pm_control.current_oversight_actor_v1()
returns table(platform_user_id uuid, auth_user_id uuid, employee_ref text, platform_role text)
language sql
security definer
set search_path = pg_catalog
as $$
  select u.id, u.auth_user_id, u.employee_ref, a.role::text
  from platform.platform_users u
  join platform.platform_role_assignments a on a.platform_user_id = u.id
  where u.auth_user_id = auth.uid()
    and u.status::text = 'ACTIVE'
    and u.deactivated_at is null
    and a.status = 'ACTIVE'
    and a.revoked_at is null
    and a.valid_from <= clock_timestamp()
    and (a.valid_until is null or a.valid_until > clock_timestamp())
    and a.role::text in ('PLATFORM_AUDITOR','PLATFORM_SUPER_ADMIN')
  order by case a.role::text when 'PLATFORM_SUPER_ADMIN' then 0 else 1 end
  limit 1;
$$;
revoke all on function pm_control.current_oversight_actor_v1() from public, anon, authenticated, service_role;

create or replace function pm_control.refresh_alerts_v1()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pm_control
as $$
declare n integer := 0;
begin
  if current_user not in ('postgres','supabase_admin') then
    raise exception 'pm_operator_access_required' using errcode='42501';
  end if;

  with candidates as (
    select s.project_code, s.code package_code, 'blocked'::text kind, 'warning'::text severity,
      'blocked/'||s.code fingerprint,
      jsonb_build_object('stage',s.recorded_stage,'blocker',s.blocker,'version',s.version) details
    from pm_control.package_status_v1 s where s.blocker is not null
    union all
    select s.project_code, s.code, 'review_wait', 'warning', 'review_wait/'||s.code,
      jsonb_build_object('stage',s.recorded_stage,'candidate_commit',s.candidate_commit,'reported_at',s.reported_at)
    from pm_control.package_status_v1 s
    where s.recorded_stage='in_review' and coalesce(s.reported_at,s.started_at,'epoch'::timestamptz) < clock_timestamp()-interval '24 hours'
    union all
    select s.project_code, s.code, 'stale_report', 'warning', 'stale_report/'||s.code,
      jsonb_build_object('stage',s.recorded_stage,'reported_at',s.reported_at)
    from pm_control.package_status_v1 s
    where s.recorded_stage not in ('closed','cancelled') and coalesce(s.reported_at,s.started_at,'epoch'::timestamptz) < clock_timestamp()-interval '48 hours'
    union all
    select c.project_code, null, 'credential_expiry',
      case when c.valid_until < clock_timestamp()+interval '24 hours' then 'critical' else 'warning' end,
      'credential_expiry/'||c.work_code,
      jsonb_build_object('work',c.work_code,'valid_until',c.valid_until)
    from pm_control.work_credentials c
    where c.revoked_at is null and c.valid_until < clock_timestamp()+interval '7 days'
  ), upserted as (
    insert into pm_control.alerts(project_code,package_code,kind,severity,fingerprint,details)
    select project_code,package_code,kind,severity,fingerprint,details from candidates
    on conflict(project_code,fingerprint) do update set
      package_code=excluded.package_code, kind=excluded.kind, severity=excluded.severity,
      details=excluded.details, last_seen_at=clock_timestamp(), resolved_at=null
    returning 1
  ) select count(*) into n from upserted;

  update pm_control.alerts a set resolved_at=clock_timestamp(),last_seen_at=clock_timestamp()
  where resolved_at is null and not exists (
    select 1 from (
      select s.project_code,'blocked/'||s.code fingerprint from pm_control.package_status_v1 s where s.blocker is not null
      union all select s.project_code,'review_wait/'||s.code from pm_control.package_status_v1 s where s.recorded_stage='in_review' and coalesce(s.reported_at,s.started_at,'epoch'::timestamptz)<clock_timestamp()-interval '24 hours'
      union all select s.project_code,'stale_report/'||s.code from pm_control.package_status_v1 s where s.recorded_stage not in ('closed','cancelled') and coalesce(s.reported_at,s.started_at,'epoch'::timestamptz)<clock_timestamp()-interval '48 hours'
      union all select c.project_code,'credential_expiry/'||c.work_code from pm_control.work_credentials c where c.revoked_at is null and c.valid_until<clock_timestamp()+interval '7 days'
    ) x where x.project_code=a.project_code and x.fingerprint=a.fingerprint
  );
  return jsonb_build_object('contract','pm-monitor.v1','active_candidates',n,'refreshed_at',clock_timestamp());
end $$;
revoke all on function pm_control.refresh_alerts_v1() from public, anon, authenticated, service_role;

create or replace function pm_control.oversight_gateway_v1(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pm_control
as $$
declare actor record; operation text:=p_request->>'operation'; pkg text:=p_request->>'package'; rows jsonb; receipt jsonb;
begin
  select * into actor from pm_control.current_oversight_actor_v1();
  if not found then raise exception 'pm_oversight_access_denied' using errcode='42501'; end if;
  if jsonb_typeof(p_request) is distinct from 'object' or octet_length(p_request::text)>49152 then raise exception 'pm_invalid_request' using errcode='22023'; end if;

  if operation='overview' then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.owner_work,s.code),'[]'::jsonb) into rows
    from pm_control.package_status_v1 s where s.project_code=coalesce(p_request->>'project','CLADORA');
    return jsonb_build_object('contract','pm-oversight.v1','actor',actor.employee_ref,'role',actor.platform_role,'packages',rows);
  elsif operation='alerts' then
    select coalesce(jsonb_agg(to_jsonb(a) order by a.severity desc,a.last_seen_at desc),'[]'::jsonb) into rows
    from pm_control.alerts a where a.project_code=coalesce(p_request->>'project','CLADORA') and a.resolved_at is null;
    return jsonb_build_object('contract','pm-oversight.v1','alerts',rows);
  elsif operation='detail' then
    select jsonb_build_object('status',to_jsonb(s),
      'reports',coalesce((select jsonb_agg(to_jsonb(r) order by r.id desc) from pm_control.reports r join pm_control.cycles c on c.id=r.cycle_id where c.project_code=s.project_code and c.package_code=s.code),'[]'::jsonb),
      'evidence',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from pm_control.evidence e join pm_control.cycles c on c.id=e.cycle_id where c.project_code=s.project_code and c.package_code=s.code),'[]'::jsonb),
      'decisions',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from pm_control.decisions d join pm_control.cycles c on c.id=d.cycle_id where c.project_code=s.project_code and c.package_code=s.code),'[]'::jsonb)) into rows
    from pm_control.package_status_v1 s where s.project_code=coalesce(p_request->>'project','CLADORA') and s.code=pkg;
    if rows is null then raise exception 'pm_package_not_found'; end if;
    return jsonb_build_object('contract','pm-oversight.v1','package',rows);
  elsif operation='command' then
    if actor.platform_role<>'PLATFORM_SUPER_ADMIN' then raise exception 'pm_operator_access_required' using errcode='42501'; end if;
    if coalesce(p_request->>'request_key','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,239}$' or jsonb_typeof(p_request->'body') is distinct from 'object' then raise exception 'pm_invalid_request' using errcode='22023'; end if;
    if p_request->'body'->>'action'='accept' and p_request->'body'->>'reviewer_ref'<>actor.employee_ref then raise exception 'pm_reviewer_identity_mismatch' using errcode='42501'; end if;
    receipt:=pm_control.command_v1(coalesce(p_request->>'project','CLADORA'),p_request->>'request_key',(p_request->>'expected_version')::integer,p_request->'body');
    insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
    values(null,actor.auth_user_id,actor.platform_role,'PM01_OVERSIGHT_COMMAND','pm_control.cycle',(receipt->>'cycle_id')::uuid,receipt,'Authenticated PM oversight gateway');
    return receipt||jsonb_build_object('oversight_actor',actor.employee_ref,'oversight_role',actor.platform_role);
  else raise exception 'pm_operation_denied' using errcode='42501'; end if;
end $$;

create or replace function public.pm_oversight_gateway_v1(p_request jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog
as $$ select pm_control.oversight_gateway_v1(p_request); $$;
revoke all on function public.pm_oversight_gateway_v1(jsonb) from public,anon,service_role;
grant execute on function public.pm_oversight_gateway_v1(jsonb) to authenticated;
grant execute on function pm_control.oversight_gateway_v1(jsonb) to authenticated;

select pm_control.refresh_alerts_v1();

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname='pm01-refresh-alerts-v1';
  perform cron.schedule('pm01-refresh-alerts-v1','*/15 * * * *','select pm_control.refresh_alerts_v1();');
exception when undefined_table or undefined_function then
  raise notice 'pg_cron unavailable; PM monitor must be scheduled externally';
end $$;

