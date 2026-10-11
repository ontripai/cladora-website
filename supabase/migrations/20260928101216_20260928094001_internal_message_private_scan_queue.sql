begin;

create function public.claim_internal_private_scan_job_v1(p_worker_id text,p_lease_seconds integer default 900)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j platform.internal_private_scan_jobs;
begin
  if p_worker_id !~ '^[A-Za-z0-9._:-]{3,120}$' or p_lease_seconds not between 60 and 1800 then
    raise exception 'internal_scan_claim_invalid' using errcode='22023'; end if;
  update platform.internal_private_scan_jobs set state='dead_letter',lease_token=null,lease_until=null,
    last_error_code='LEASE_EXHAUSTED'
    where state='leased' and lease_until<=statement_timestamp() and attempt_count>=5;
  select * into j from platform.internal_private_scan_jobs
  where state in ('pending','retry','leased') and next_attempt_at<=statement_timestamp()
    and (state<>'leased' or lease_until<=statement_timestamp())
    and attempt_count<5
  order by created_at,id limit 1 for update skip locked;
  if not found then return null; end if;
  update platform.internal_private_scan_jobs set state='leased',lease_token=gen_random_uuid(),
    lease_until=statement_timestamp()+make_interval(secs=>p_lease_seconds),attempt_count=attempt_count+1
    where id=j.id returning * into j;
  return jsonb_build_object('job_id',j.id,'lease_token',j.lease_token,'document_id',j.document_id,
    'attempt_count',j.attempt_count);
end $$;

create function public.get_internal_private_scan_target_v1(p_document_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare d platform.internal_private_documents;
begin
  select * into d from platform.internal_private_documents where id=p_document_id and state='pending';
  if not found or not exists(select 1 from platform.internal_private_scan_jobs j
    where j.document_id=d.id and j.state='leased' and j.lease_until>statement_timestamp())
    or not exists(select 1 from storage.objects o where o.bucket_id='internal-message-vault'
      and o.name=d.object_path) then
    raise exception 'internal_scan_target_invalid' using errcode='42501'; end if;
  return jsonb_build_object('document_id',d.id,'bucket_id','internal-message-vault',
    'object_path',d.object_path,'sha256',d.sha256,'size_bytes',d.size_bytes);
end $$;

create function public.complete_internal_private_scan_job_v1(
  p_job_id uuid,p_lease_token uuid,p_verdict text,p_sha256 text,
  p_engine_version text,p_scanned_at timestamptz
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j platform.internal_private_scan_jobs; d platform.internal_private_documents;
begin
  select * into j from platform.internal_private_scan_jobs where id=p_job_id for update;
  if j.id is null or j.state<>'leased' or j.lease_token is distinct from p_lease_token
    or j.lease_until<=statement_timestamp() then
    raise exception 'internal_scan_lease_invalid' using errcode='42501'; end if;
  select * into d from platform.internal_private_documents where id=j.document_id for update;
  if d.state<>'pending' or p_verdict not in ('clean','quarantined') or p_sha256<>d.sha256
    or length(trim(coalesce(p_engine_version,''))) not between 1 and 160
    or p_scanned_at is null or abs(extract(epoch from (statement_timestamp()-p_scanned_at)))>900 then
    raise exception 'internal_scan_verdict_invalid' using errcode='22023'; end if;
  insert into platform.internal_private_scan_attestations(document_id,content_sha256,verdict,engine_version,scanned_at)
    values(d.id,p_sha256,p_verdict,trim(p_engine_version),p_scanned_at);
  update platform.internal_private_documents set state=p_verdict,scanned_at=p_scanned_at where id=d.id;
  update platform.internal_private_scan_jobs set state='completed',lease_token=null,lease_until=null
    where id=j.id;
  insert into audit.events(tenant_id,action,entity_type,entity_id,after_snapshot)
    values(d.tenant_id,'internal_private_document.scan','platform.internal_private_document',d.id,
      jsonb_build_object('verdict',p_verdict,'engine',p_engine_version));
  return jsonb_build_object('document_id',d.id,'verdict',p_verdict);
end $$;

create function public.fail_internal_private_scan_job_v1(
  p_job_id uuid,p_lease_token uuid,p_error_code text,p_retry_after_seconds integer default 60
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j platform.internal_private_scan_jobs;
begin
  if p_error_code !~ '^[A-Z0-9_]{3,80}$' or p_retry_after_seconds not between 5 and 86400 then
    raise exception 'internal_scan_failure_invalid' using errcode='22023'; end if;
  select * into j from platform.internal_private_scan_jobs where id=p_job_id for update;
  if j.id is null or j.state<>'leased' or j.lease_token is distinct from p_lease_token
    or j.lease_until<=statement_timestamp() then
    raise exception 'internal_scan_lease_invalid' using errcode='42501'; end if;
  update platform.internal_private_scan_jobs set state=case when j.attempt_count>=5 then 'dead_letter' else 'retry' end,
    lease_token=null,lease_until=null,last_error_code=p_error_code,
    next_attempt_at=statement_timestamp()+make_interval(secs=>p_retry_after_seconds)
    where id=j.id returning * into j;
  return jsonb_build_object('job_id',j.id,'state',j.state);
end $$;

create function public.get_internal_private_scan_queue_status_v1()
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_build_object('pending',count(*) filter(where state='pending'),
    'retry',count(*) filter(where state='retry'),
    'dead_letter',count(*) filter(where state='dead_letter'),
    'oldest_pending_at',min(created_at) filter(where state in ('pending','retry','dead_letter')))
    from platform.internal_private_scan_jobs;
$$;

revoke all on function public.claim_internal_private_scan_job_v1(text,integer),
  public.get_internal_private_scan_target_v1(uuid),
  public.complete_internal_private_scan_job_v1(uuid,uuid,text,text,text,timestamptz),
  public.fail_internal_private_scan_job_v1(uuid,uuid,text,integer),
  public.get_internal_private_scan_queue_status_v1() from public,anon,authenticated;
grant execute on function public.claim_internal_private_scan_job_v1(text,integer),
  public.get_internal_private_scan_target_v1(uuid),
  public.complete_internal_private_scan_job_v1(uuid,uuid,text,text,text,timestamptz),
  public.fail_internal_private_scan_job_v1(uuid,uuid,text,integer),
  public.get_internal_private_scan_queue_status_v1() to service_role;

commit;
