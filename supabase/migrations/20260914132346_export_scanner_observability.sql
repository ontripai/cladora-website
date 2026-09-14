begin;

-- CLADORA-P2-EXPORT-SCANNER-OBSERVABILITY-001
-- Tenant-scoped, AAL2-protected, redacted queue health and immutable audit
-- evidence. No object path, filename, content hash, lease token or secret is
-- returned or written to the audit trail.

create or replace function app_private.record_export_scan_job_audit_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog,audit
as $$
begin
  if tg_op='INSERT' or new.state is distinct from old.state
     or new.attempt_count is distinct from old.attempt_count
     or new.last_error_code is distinct from old.last_error_code then
    insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
    values(new.tenant_id,auth.uid(),case when auth.uid() is null then 'scanner_worker' else 'authenticated' end,
      case when tg_op='INSERT' then 'export.scan_job.queued' else 'export.scan_job.'||new.state end,
      'finance.export_artifact_scan_job',new.id,
      jsonb_build_object('state',new.state,'attempt_count',new.attempt_count,
        'max_attempts',new.max_attempts,'error_code',new.last_error_code),
      'CLADORA scanner queue state evidence');
  end if;
  return new;
end $$;
revoke all on function app_private.record_export_scan_job_audit_v1() from public,anon,authenticated,service_role;

create trigger export_artifact_scan_jobs_audit
after insert or update of state,attempt_count,last_error_code
on finance.export_artifact_scan_jobs
for each row execute function app_private.record_export_scan_job_audit_v1();

create or replace function app_private.get_export_scanner_observability_internal_v1(
  p_context_id uuid,p_limit integer default 25
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,finance
as $$
declare a record;v_result jsonb;
begin
  if p_limit not between 1 and 100 then
    raise exception 'invalid_export_scanner_observability_limit' using errcode='22023';
  end if;
  select * into a from app_private.export_pack_actor_v1(p_context_id,'finance.exports.read');

  with scoped as (
    select j.id,j.state,j.provider,j.attempt_count,j.max_attempts,j.next_attempt_at,
      j.lease_until,j.last_error_code,j.created_at,j.updated_at
    from finance.export_artifact_scan_jobs j
    join finance.export_artifacts ea on ea.id=j.artifact_id and ea.tenant_id=j.tenant_id
    join finance.export_packs ep on ep.id=ea.export_pack_id and ep.tenant_id=ea.tenant_id
    where j.tenant_id=a.tenant_id and (a.property_id is null or ep.property_id=a.property_id)
  ), recent as (
    select id,state,provider,attempt_count,max_attempts,next_attempt_at,last_error_code,created_at,updated_at,
      (state='leased' and lease_until<=statement_timestamp()) stalled,
      (state in ('retry','leased') and attempt_count>=max_attempts-1) retry_warning
    from scoped order by updated_at desc,id limit p_limit
  )
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'total',count(*),'pending',count(*) filter(where state='pending'),
      'leased',count(*) filter(where state='leased' and (lease_until is null or lease_until>statement_timestamp())),
      'retry',count(*) filter(where state='retry'),'completed',count(*) filter(where state='completed'),
      'dead_letter',count(*) filter(where state='dead_letter'),
      'stalled',count(*) filter(where state='leased' and lease_until<=statement_timestamp()),
      'retry_warning',count(*) filter(where state in ('retry','leased') and attempt_count>=max_attempts-1)
    ),
    'jobs',(select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc,r.id),'[]'::jsonb) from recent r),
    'redaction',jsonb_build_object('object_path',true,'filename',true,'content_sha256',true,'lease_token',true,'secret',true),
    'generated_at',statement_timestamp()
  ) into v_result from scoped;
  return v_result;
end $$;
revoke all on function app_private.get_export_scanner_observability_internal_v1(uuid,integer) from public,anon,authenticated;

create or replace function customer_api.get_export_scanner_observability_v1(
  p_context_id uuid,p_limit integer default 25
) returns jsonb language sql stable security invoker set search_path=pg_catalog
as $$select app_private.get_export_scanner_observability_internal_v1(p_context_id,p_limit)$$;
revoke all on function customer_api.get_export_scanner_observability_v1(uuid,integer) from public,anon;
grant execute on function customer_api.get_export_scanner_observability_v1(uuid,integer) to authenticated,service_role;

commit;
