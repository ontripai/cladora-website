begin;

-- CLADORA-P2-EXPORT-SCANNER-001A
-- Durable, provider-neutral scan orchestration. This migration does not install,
-- call or configure a malware provider and does not expose queue data to clients.

create table finance.export_artifact_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  artifact_id uuid not null references finance.export_artifacts(id) on delete restrict,
  provider text not null default 'mock' check (length(trim(provider)) between 2 and 80),
  state text not null default 'pending'
    check (state in ('pending','leased','retry','completed','dead_letter')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 25),
  max_attempts integer not null default 5 check (max_attempts between 1 and 25),
  next_attempt_at timestamptz not null default statement_timestamp(),
  lease_token uuid,
  lease_owner text,
  lease_until timestamptz,
  last_error_code text,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (artifact_id),
  check (
    (state = 'leased' and lease_token is not null and lease_owner is not null and lease_until is not null)
    or (state <> 'leased' and lease_token is null and lease_owner is null and lease_until is null)
  ),
  check ((state = 'completed' and completed_at is not null) or (state <> 'completed' and completed_at is null)),
  check (lease_owner is null or length(trim(lease_owner)) between 3 and 120),
  check (last_error_code is null or last_error_code ~ '^[A-Z0-9_]{3,80}$')
);

create index export_artifact_scan_jobs_ready_idx
  on finance.export_artifact_scan_jobs(next_attempt_at,created_at)
  where state in ('pending','retry','leased');
create index export_artifact_scan_jobs_tenant_idx
  on finance.export_artifact_scan_jobs(tenant_id,created_at desc);

alter table finance.export_artifact_scan_jobs enable row level security;
revoke all on finance.export_artifact_scan_jobs from public,anon,authenticated,service_role;

create policy export_artifact_scan_jobs_direct_deny
  on finance.export_artifact_scan_jobs for all to anon,authenticated
  using (false) with check (false);

create or replace function app_private.enqueue_export_artifact_scan_job_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog,finance
as $$
begin
  if new.scan_status = 'scanning_pending'
     and (old.scan_status is distinct from new.scan_status or old.content_sha256 is distinct from new.content_sha256) then
    insert into finance.export_artifact_scan_jobs(tenant_id,artifact_id,provider)
    values(new.tenant_id,new.id,'mock')
    on conflict(artifact_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function app_private.enqueue_export_artifact_scan_job_v1() from public,anon,authenticated,service_role;

create trigger export_artifact_scan_job_enqueue
after update of scan_status,content_sha256 on finance.export_artifacts
for each row execute function app_private.enqueue_export_artifact_scan_job_v1();

create or replace function app_private.claim_export_artifact_scan_job_v1(
  p_provider text,p_worker_id text,p_lease_seconds integer default 120
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,finance,storage
as $$
declare j finance.export_artifact_scan_jobs;art finance.export_artifacts;v_token uuid:=gen_random_uuid();
begin
  if length(trim(coalesce(p_provider,''))) not between 2 and 80
     or length(trim(coalesce(p_worker_id,''))) not between 3 and 120
     or p_lease_seconds not between 30 and 600 then
    raise exception 'invalid_export_scan_lease_request' using errcode='22023';
  end if;

  select q.* into j
  from finance.export_artifact_scan_jobs q
  join finance.export_artifacts a on a.id=q.artifact_id and a.tenant_id=q.tenant_id
  where q.provider=trim(p_provider)
    and q.attempt_count<q.max_attempts
    and a.scan_status='scanning_pending'
    and exists(select 1 from storage.objects o where o.bucket_id='export-artifact-vault' and o.name=a.object_path)
    and ((q.state in ('pending','retry') and q.next_attempt_at<=statement_timestamp())
      or (q.state='leased' and q.lease_until<=statement_timestamp()))
  order by q.next_attempt_at,q.created_at,q.id
  for update of q skip locked
  limit 1;

  if not found then return null; end if;
  update finance.export_artifact_scan_jobs
  set state='leased',attempt_count=attempt_count+1,lease_token=v_token,
      lease_owner=trim(p_worker_id),lease_until=statement_timestamp()+make_interval(secs=>p_lease_seconds),
      updated_at=statement_timestamp()
  where id=j.id returning * into j;
  select * into art from finance.export_artifacts where id=j.artifact_id;
  return jsonb_build_object('job_id',j.id,'lease_token',v_token,'artifact_id',art.id,
    'tenant_id',art.tenant_id,'bucket_id','export-artifact-vault','object_path',art.object_path,
    'content_sha256',art.content_sha256,'byte_size',art.byte_size,'media_type',art.media_type,
    'provider',j.provider,'attempt_count',j.attempt_count,'max_attempts',j.max_attempts,
    'lease_until',j.lease_until);
end $$;
revoke all on function app_private.claim_export_artifact_scan_job_v1(text,text,integer) from public,anon,authenticated;
grant execute on function app_private.claim_export_artifact_scan_job_v1(text,text,integer) to service_role;

create or replace function app_private.fail_export_artifact_scan_job_v1(
  p_job_id uuid,p_lease_token uuid,p_error_code text,p_retry_after_seconds integer default 60
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,finance
as $$
declare j finance.export_artifact_scan_jobs;v_dead boolean;
begin
  if coalesce(p_error_code,'') !~ '^[A-Z0-9_]{3,80}$'
     or p_retry_after_seconds not between 5 and 86400 then
    raise exception 'invalid_export_scan_failure' using errcode='22023';
  end if;
  select * into j from finance.export_artifact_scan_jobs where id=p_job_id for update;
  if not found then raise exception 'export_scan_job_not_found' using errcode='22023'; end if;
  if j.state<>'leased' or j.lease_token is distinct from p_lease_token
     or j.lease_until<=statement_timestamp() then
    raise exception 'export_scan_job_lease_invalid' using errcode='42501';
  end if;
  v_dead:=j.attempt_count>=j.max_attempts;
  update finance.export_artifact_scan_jobs
  set state=case when v_dead then 'dead_letter' else 'retry' end,
      next_attempt_at=statement_timestamp()+make_interval(secs=>p_retry_after_seconds),
      lease_token=null,lease_owner=null,lease_until=null,last_error_code=p_error_code,
      updated_at=statement_timestamp()
  where id=j.id returning * into j;
  return jsonb_build_object('job_id',j.id,'state',j.state,'attempt_count',j.attempt_count,
    'max_attempts',j.max_attempts,'next_attempt_at',j.next_attempt_at);
end $$;
revoke all on function app_private.fail_export_artifact_scan_job_v1(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function app_private.fail_export_artifact_scan_job_v1(uuid,uuid,text,integer) to service_role;

create or replace function app_private.complete_export_artifact_scan_job_v1(
  p_job_id uuid,p_lease_token uuid,p_provider_scan_id text,p_verdict text,p_content_sha256 text,
  p_key_id text,p_signature text,p_scanned_at timestamptz
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,finance
as $$
declare j finance.export_artifact_scan_jobs;v_result jsonb;
begin
  select * into j from finance.export_artifact_scan_jobs where id=p_job_id for update;
  if not found then raise exception 'export_scan_job_not_found' using errcode='22023'; end if;
  if j.state='completed' then
    v_result:=app_private.record_export_artifact_scan_v1(j.artifact_id,j.provider,p_provider_scan_id,
      p_verdict,p_content_sha256,p_key_id,p_signature,p_scanned_at);
    return v_result||jsonb_build_object('job_id',j.id,'job_state',j.state,'idempotent_replay',true);
  end if;
  if j.state<>'leased' or j.lease_token is distinct from p_lease_token
     or j.lease_until<=statement_timestamp() then
    raise exception 'export_scan_job_lease_invalid' using errcode='42501';
  end if;
  v_result:=app_private.record_export_artifact_scan_v1(j.artifact_id,j.provider,p_provider_scan_id,
    p_verdict,p_content_sha256,p_key_id,p_signature,p_scanned_at);
  update finance.export_artifact_scan_jobs
  set state='completed',completed_at=statement_timestamp(),lease_token=null,lease_owner=null,
      lease_until=null,last_error_code=null,updated_at=statement_timestamp()
  where id=j.id returning * into j;
  return v_result||jsonb_build_object('job_id',j.id,'job_state',j.state,'idempotent_replay',false);
end $$;
revoke all on function app_private.complete_export_artifact_scan_job_v1(uuid,uuid,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function app_private.complete_export_artifact_scan_job_v1(uuid,uuid,text,text,text,text,text,timestamptz) to service_role;

create or replace function app_private.get_export_artifact_scan_status_internal_v1(
  p_context_id uuid,p_export_pack_id uuid,p_report_code text,p_format text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,finance
as $$
declare a record;art finance.export_artifacts;j finance.export_artifact_scan_jobs;
begin
  select * into a from app_private.export_pack_actor_v1(p_context_id,'finance.exports.read');
  select ea.* into art from finance.export_artifacts ea
  join finance.export_packs ep on ep.id=ea.export_pack_id and ep.tenant_id=ea.tenant_id
  where ea.export_pack_id=p_export_pack_id and ea.tenant_id=a.tenant_id
    and ea.report_code=p_report_code and ea.format=p_format
    and (a.property_id is null or ep.property_id=a.property_id);
  if not found then raise exception 'export_artifact_not_found' using errcode='22023'; end if;
  select * into j from finance.export_artifact_scan_jobs where artifact_id=art.id;
  return jsonb_build_object('artifact_id',art.id,'scan_status',art.scan_status,
    'scan_completed_at',art.scan_completed_at,'queue_state',j.state,
    'attempt_count',coalesce(j.attempt_count,0),'max_attempts',coalesce(j.max_attempts,0));
end $$;
revoke all on function app_private.get_export_artifact_scan_status_internal_v1(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function app_private.get_export_artifact_scan_status_internal_v1(uuid,uuid,text,text) to authenticated,service_role;

create or replace function customer_api.get_export_artifact_scan_status_v1(
  p_context_id uuid,p_export_pack_id uuid,p_report_code text,p_format text
) returns jsonb language sql security invoker set search_path=pg_catalog
as $$select app_private.get_export_artifact_scan_status_internal_v1(p_context_id,p_export_pack_id,p_report_code,p_format)$$;
revoke all on function customer_api.get_export_artifact_scan_status_v1(uuid,uuid,text,text) from public,anon;
grant execute on function customer_api.get_export_artifact_scan_status_v1(uuid,uuid,text,text) to authenticated,service_role;

commit;
