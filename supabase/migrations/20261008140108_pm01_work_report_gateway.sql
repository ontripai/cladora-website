-- PM-01B: opaque work credentials, report/status only. No closure authority.
create table pm_control.work_credentials (
 id uuid primary key default gen_random_uuid(),
 project_code text not null references pm_control.projects,
 work_code text not null references pm_control.workstreams,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 label text not null, created_at timestamptz not null default clock_timestamp(),
 valid_until timestamptz not null, revoked_at timestamptz,
 window_start timestamptz not null default clock_timestamp(), window_requests integer not null default 0,
 check(valid_until>created_at), check(window_requests>=0)
);
alter table pm_control.work_credentials enable row level security;
revoke all on pm_control.work_credentials from public,anon,authenticated,service_role;

create function pm_control.work_gateway_v1(p_token text,p_request jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pm_control as $$
declare
 cred pm_control.work_credentials%rowtype; pkg pm_control.packages%rowtype;
 operation text:=p_request->>'operation'; rp jsonb:=p_request->'report';
 item jsonb; k text; body jsonb; receipt jsonb; rows jsonb; claimed_at timestamptz;
begin
 -- Opaque credentials are independent of customer accounts and tenant roles.
 if p_token is null or p_token !~ '^cldpm_[0-9a-f]{64}$' then raise exception 'pm_invalid_credential' using errcode='28000'; end if;
 select * into cred from pm_control.work_credentials
  where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
    and revoked_at is null and valid_until>clock_timestamp() for update;
 if not found then raise exception 'pm_invalid_credential' using errcode='28000'; end if;
 if jsonb_typeof(p_request) is distinct from 'object' or octet_length(p_request::text)>49152 then raise exception 'pm_invalid_request' using errcode='22023'; end if;
 if operation not in ('status','report') or operation is null then raise exception 'pm_operation_denied' using errcode='42501'; end if;
 if cred.window_start<clock_timestamp()-interval '1 minute' then
  update pm_control.work_credentials set window_start=clock_timestamp(),window_requests=1 where id=cred.id;
 elsif cred.window_requests>=120 then raise exception 'pm_rate_limit' using errcode='P0001';
 else update pm_control.work_credentials set window_requests=window_requests+1 where id=cred.id; end if;
 if operation='status' then
  if exists(select 1 from jsonb_object_keys(p_request) z where z not in ('operation','package')) then raise exception 'pm_invalid_request' using errcode='22023'; end if;
  if p_request ? 'package' and not exists(select 1 from pm_control.packages where project_code=cred.project_code and code=p_request->>'package' and owner_work=cred.work_code) then raise exception 'pm_package_access_denied' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.code),'[]'::jsonb) into rows
   from pm_control.package_status_v1 s where s.project_code=cred.project_code and s.owner_work=cred.work_code
    and (not(p_request ? 'package') or s.code=p_request->>'package');
  return jsonb_build_object('contract','pm-work-gateway.v1','work',cred.work_code,'packages',rows,'credential_expires_at',cred.valid_until);
 end if;
 if exists(select 1 from jsonb_object_keys(p_request) z where z not in ('operation','package','cycle_no','expected_version','request_id','report'))
 or nullif(p_request->>'package','') is null
 or coalesce(p_request->>'request_id','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$'
 or coalesce(p_request->>'cycle_no','') !~ '^[1-9][0-9]{0,8}$'
 or coalesce(p_request->>'expected_version','') !~ '^[1-9][0-9]{0,8}$'
 or jsonb_typeof(rp) is distinct from 'object' then raise exception 'pm_invalid_request' using errcode='22023'; end if;
 perform 1 from pm_control.projects where code=cred.project_code for update;
 select * into pkg from pm_control.packages where project_code=cred.project_code and code=p_request->>'package' and owner_work=cred.work_code for share;
 if not found then raise exception 'pm_package_access_denied' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(rp) z where z not in ('stage','summary','commit','pr_url','tests','blocker','next_step','reported_at','baseline','artifact_refs','source_cycle_ref'))
 or coalesce(rp->>'stage','') not in ('planned','ready','in_progress','in_review','tested','blocked')
 or length(trim(coalesce(rp->>'summary',''))) not between 1 and 6000
 or length(coalesce(rp->>'next_step',''))>3000
 or (rp->>'commit' is not null and rp->>'commit' !~ '^[0-9a-f]{40}$')
 or (rp->>'pr_url' is not null and rp->>'pr_url' !~ '^https://github[.]com/ontripai/cladora-website/pull/[0-9]+$')
 or jsonb_typeof(rp->'tests') is distinct from 'array'
 then raise exception 'pm_invalid_report' using errcode='22023'; end if;
 if jsonb_array_length(rp->'tests')>100 then raise exception 'pm_invalid_report' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(rp->'tests') loop
  if jsonb_typeof(item) is distinct from 'object' then raise exception 'pm_invalid_test' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(item) z where z not in ('name','result','environment','evidence_ref','command'))
   or length(trim(coalesce(item->>'name',''))) not between 1 and 240
   or coalesce(item->>'result','') not in ('pass','fail','error','not_run','blocked')
   or length(trim(coalesce(item->>'environment',''))) not between 1 and 240
   then raise exception 'pm_invalid_test' using errcode='22023'; end if;
 end loop;
 begin claimed_at:=(rp->>'reported_at')::timestamptz; exception when others then raise exception 'pm_invalid_report_time' using errcode='22023'; end;
 if claimed_at is null or not isfinite(claimed_at) or claimed_at>clock_timestamp()+interval '5 minutes' then raise exception 'pm_invalid_report_time' using errcode='22023'; end if;
 -- Fingerprint uses client report, while attribution is derived from the credential.
 -- Key namespace is stable per work; credential rotation cannot create duplicate writes.
 k:='work-report/'||cred.work_code||'/'||(p_request->>'request_id');
 body:=jsonb_build_object('action','report','package',pkg.code,'cycle_no',(p_request->>'cycle_no')::integer,
 'reported_at',claimed_at,'source_ref','pm-work-gateway.v1/'||cred.work_code,
 'source_sha256',encode(sha256(convert_to(rp::text,'UTF8')),'hex'),
 'payload',rp||jsonb_build_object('reported_owner',cred.work_code,'classification','reported','source_kind','authenticated_work_report'));
 receipt:=pm_control.command_v1(cred.project_code,k,(p_request->>'expected_version')::integer,body);
 return receipt||jsonb_build_object('work',cred.work_code,'classification','reported');
end $$;
revoke all on function pm_control.work_gateway_v1(text,jsonb) from public,anon,authenticated;
grant usage on schema pm_control to service_role;
grant execute on function pm_control.work_gateway_v1(text,jsonb) to service_role;
-- Exposed wrapper is invoker only; the private bounded helper verifies token and work scope.
create function public.pm_work_gateway_v1(p_token text,p_request jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog as $$
 select pm_control.work_gateway_v1(p_token,p_request);
$$;
revoke all on function public.pm_work_gateway_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.pm_work_gateway_v1(text,jsonb) to service_role;
comment on function public.pm_work_gateway_v1(text,jsonb) is 'Server-only Edge bridge. Custom work credential authorizes status/report only; no acceptance, closure, arbitrary SQL or customer role access.';
