begin;

-- CLADORA-P2-EXPORT-SCANNER-RUNTIME-001A
-- PostgREST-visible, service-role-only wrappers for the private Migration 96
-- queue contract. No worker is scheduled or activated by this migration.

create or replace function public.claim_export_artifact_scan_job_worker_v1(
  p_provider text,
  p_worker_id text,
  p_lease_seconds integer default 120
) returns jsonb
language sql security invoker set search_path=pg_catalog
as $$
  select app_private.claim_export_artifact_scan_job_v1(p_provider,p_worker_id,p_lease_seconds)
$$;

create or replace function public.fail_export_artifact_scan_job_worker_v1(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_retry_after_seconds integer default 60
) returns jsonb
language sql security invoker set search_path=pg_catalog
as $$
  select app_private.fail_export_artifact_scan_job_v1(p_job_id,p_lease_token,p_error_code,p_retry_after_seconds)
$$;

create or replace function public.complete_export_artifact_scan_job_worker_v1(
  p_job_id uuid,
  p_lease_token uuid,
  p_provider_scan_id text,
  p_verdict text,
  p_content_sha256 text,
  p_key_id text,
  p_signature text,
  p_scanned_at timestamptz
) returns jsonb
language sql security invoker set search_path=pg_catalog
as $$
  select app_private.complete_export_artifact_scan_job_v1(
    p_job_id,p_lease_token,p_provider_scan_id,p_verdict,p_content_sha256,
    p_key_id,p_signature,p_scanned_at
  )
$$;

revoke all on function public.claim_export_artifact_scan_job_worker_v1(text,text,integer) from public,anon,authenticated;
revoke all on function public.fail_export_artifact_scan_job_worker_v1(uuid,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.complete_export_artifact_scan_job_worker_v1(uuid,uuid,text,text,text,text,text,timestamptz) from public,anon,authenticated;

grant execute on function public.claim_export_artifact_scan_job_worker_v1(text,text,integer) to service_role;
grant execute on function public.fail_export_artifact_scan_job_worker_v1(uuid,uuid,text,integer) to service_role;
grant execute on function public.complete_export_artifact_scan_job_worker_v1(uuid,uuid,text,text,text,text,text,timestamptz) to service_role;

commit;
