begin;

-- Durable scan queue for the private document vault. The external ClamAV host
-- leases work; the database never labels an unscanned version clean.
create table documents.document_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  version_id uuid not null unique references documents.document_versions(id) on delete restrict,
  state text not null default 'pending' check (state in ('pending','leased','retry','completed','dead_letter')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz not null default statement_timestamp(),
  lease_token uuid,
  lease_owner text,
  lease_until timestamptz,
  last_error_code text,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check ((state='leased' and lease_token is not null and lease_owner is not null and lease_until is not null)
    or (state<>'leased' and lease_token is null and lease_owner is null and lease_until is null)),
  check ((state='completed' and completed_at is not null) or (state<>'completed' and completed_at is null)),
  check (lease_owner is null or length(trim(lease_owner)) between 3 and 120),
  check (last_error_code is null or last_error_code ~ '^[A-Z0-9_]{3,80}$')
);
create index document_scan_jobs_tenant_id_idx on documents.document_scan_jobs(tenant_id,created_at desc);
create index document_scan_jobs_ready_idx on documents.document_scan_jobs(next_attempt_at,created_at)
  where state in ('pending','retry','leased');
alter table documents.document_scan_jobs enable row level security;
revoke all on documents.document_scan_jobs from public, anon, authenticated, service_role;

create function documents.queue_document_scan() returns trigger language plpgsql
security definer set search_path=pg_catalog as $$
begin
  if tg_op='INSERT' then
    if new.scanning_status in ('deferred','scanning_pending') then
      insert into documents.document_scan_jobs(tenant_id,version_id)
      values(new.tenant_id,new.id) on conflict(version_id) do nothing;
    end if;
  elsif new.scanning_status in ('clean','quarantined')
    and old.scanning_status is distinct from new.scanning_status then
    update documents.document_scan_jobs set state='completed',completed_at=statement_timestamp(),
      lease_token=null,lease_owner=null,lease_until=null,updated_at=statement_timestamp()
    where version_id=new.id and state<>'completed';
  end if;
  return new;
end $$;
revoke all on function documents.queue_document_scan() from public,anon,authenticated,service_role;
create trigger document_version_scan_queue_insert
after insert on documents.document_versions for each row execute function documents.queue_document_scan();
create trigger document_version_scan_queue_complete
after update of scanning_status on documents.document_versions for each row execute function documents.queue_document_scan();

insert into documents.document_scan_jobs(tenant_id,version_id)
select v.tenant_id,v.id from documents.document_versions v
where v.scanning_status in ('deferred','scanning_pending')
on conflict(version_id) do nothing;

create function public.claim_document_scan_job_v1(p_worker_id text,p_lease_seconds integer default 900)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j documents.document_scan_jobs; v documents.document_versions;
begin
  if length(trim(coalesce(p_worker_id,''))) not between 3 and 120
    or p_lease_seconds not between 60 and 1800 then
    raise exception 'document_scan_lease_invalid' using errcode='22023'; end if;
  select q.* into j from documents.document_scan_jobs q
  join documents.document_versions dv on dv.id=q.version_id and dv.tenant_id=q.tenant_id
  join documents.documents d on d.id=dv.document_id and d.tenant_id=q.tenant_id
  where dv.scanning_status in ('deferred','scanning_pending')
    and dv.sha256 ~ '^[0-9a-f]{64}$' and dv.size_bytes between 0 and 20971520
    and d.status='active' and d.deleted_at is null
    and exists(select 1 from storage.objects o where o.bucket_id='document-vault' and o.name=dv.object_path)
    and q.attempt_count<q.max_attempts
    and ((q.state in ('pending','retry') and q.next_attempt_at<=statement_timestamp())
      or (q.state='leased' and q.lease_until<=statement_timestamp()))
  order by q.next_attempt_at,q.created_at,q.id for update of q skip locked limit 1;
  if not found then return null; end if;
  update documents.document_scan_jobs set state='leased',attempt_count=attempt_count+1,
    lease_token=gen_random_uuid(),lease_owner=trim(p_worker_id),
    lease_until=statement_timestamp()+make_interval(secs=>p_lease_seconds),
    updated_at=statement_timestamp()
  where id=j.id returning * into j;
  select * into v from documents.document_versions where id=j.version_id;
  return jsonb_build_object('job_id',j.id,'lease_token',j.lease_token,'version_id',v.id,
    'attempt_count',j.attempt_count,'max_attempts',j.max_attempts,'lease_until',j.lease_until);
end $$;

create function public.fail_document_scan_job_v1(
  p_job_id uuid,p_lease_token uuid,p_error_code text,p_retry_after_seconds integer default 60
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j documents.document_scan_jobs; v_dead boolean;
begin
  if coalesce(p_error_code,'') !~ '^[A-Z0-9_]{3,80}$'
    or p_retry_after_seconds not between 5 and 86400 then
    raise exception 'document_scan_failure_invalid' using errcode='22023'; end if;
  select * into j from documents.document_scan_jobs where id=p_job_id for update;
  if not found then raise exception 'document_scan_job_not_found' using errcode='22023'; end if;
  if j.state='completed' then return jsonb_build_object('job_id',j.id,'state','completed'); end if;
  if j.state<>'leased' or j.lease_token is distinct from p_lease_token
    or j.lease_until<=statement_timestamp() then
    raise exception 'document_scan_job_lease_invalid' using errcode='42501'; end if;
  v_dead:=j.attempt_count>=j.max_attempts;
  update documents.document_scan_jobs set state=case when v_dead then 'dead_letter' else 'retry' end,
    next_attempt_at=statement_timestamp()+make_interval(secs=>p_retry_after_seconds),
    lease_token=null,lease_owner=null,lease_until=null,last_error_code=p_error_code,
    updated_at=statement_timestamp() where id=j.id returning * into j;
  return jsonb_build_object('job_id',j.id,'state',j.state,'attempt_count',j.attempt_count,
    'max_attempts',j.max_attempts,'next_attempt_at',j.next_attempt_at);
end $$;

create function public.complete_document_scan_job_v1(
  p_job_id uuid,p_lease_token uuid,p_scan_id uuid,p_verdict text,
  p_content_sha256 text,p_engine_version text,p_scanned_at timestamptz
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j documents.document_scan_jobs; result jsonb;
begin
  select * into j from documents.document_scan_jobs where id=p_job_id for update;
  if not found then raise exception 'document_scan_job_not_found' using errcode='22023'; end if;
  if j.state<>'leased' or j.lease_token is distinct from p_lease_token
    or j.lease_until<=statement_timestamp() then
    raise exception 'document_scan_job_lease_invalid' using errcode='42501'; end if;
  result:=public.record_document_scan_v1(j.version_id,p_scan_id,p_verdict,p_content_sha256,
    p_engine_version,p_scanned_at);
  -- The version's AFTER UPDATE trigger completes the job in this transaction.
  if not exists(select 1 from documents.document_scan_jobs where id=j.id and state='completed') then
    raise exception 'document_scan_completion_missing' using errcode='55000'; end if;
  return result;
end $$;

create function public.get_document_scan_queue_status_v1() returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_build_object('pending',count(*) filter(where state='pending'),
    'leased',count(*) filter(where state='leased'),
    'retry',count(*) filter(where state='retry'),
    'dead_letter',count(*) filter(where state='dead_letter'),
    'completed',count(*) filter(where state='completed'),
    'oldest_pending_at',min(created_at) filter(where state in ('pending','retry','dead_letter')))
  from documents.document_scan_jobs;
$$;

revoke all on function public.claim_document_scan_job_v1(text,integer) from public,anon,authenticated;
revoke all on function public.fail_document_scan_job_v1(uuid,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.complete_document_scan_job_v1(uuid,uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.get_document_scan_queue_status_v1() from public,anon,authenticated;
grant execute on function public.claim_document_scan_job_v1(text,integer) to service_role;
grant execute on function public.fail_document_scan_job_v1(uuid,uuid,text,integer) to service_role;
grant execute on function public.complete_document_scan_job_v1(uuid,uuid,uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.get_document_scan_queue_status_v1() to service_role;

commit;
