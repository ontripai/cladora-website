begin;

create table platform.building_setup_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  idempotency_key text not null,
  status text not null default 'draft' check(status in ('draft','rehearsed','submitted','approved','provisioned','cancelled')),
  setup_payload jsonb not null,
  payload_hash text not null,
  rehearsal_result jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  submitted_by uuid references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,idempotency_key),
  check(jsonb_typeof(setup_payload)='object')
);
create index building_setup_runs_workspace_idx on platform.building_setup_runs(customer_workspace_id,status,id);
create index building_setup_runs_created_by_idx on platform.building_setup_runs(created_by);
create index building_setup_runs_submitted_by_idx on platform.building_setup_runs(submitted_by) where submitted_by is not null;
create index building_setup_runs_approved_by_idx on platform.building_setup_runs(approved_by) where approved_by is not null;
alter table platform.building_setup_runs enable row level security;
create policy building_setup_runs_context_read on platform.building_setup_runs for select to authenticated
using(tenant_id=app_private.active_tenant_id() and app_private.is_active_member(tenant_id));
grant select on platform.building_setup_runs to authenticated;
grant all on platform.building_setup_runs to service_role;

create or replace function app_private.require_setup_context(p_context_id uuid,p_permission text)
returns table(tenant_id uuid,workspace_id uuid)
language plpgsql stable security definer
set search_path=pg_catalog,identity,platform
as $$
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
 return query
 select g.tenant_id,w.id
 from identity.context_grants g
 join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
 join identity.role_permissions rp on rp.role_id=m.role_id and rp.effect='allow'
 join identity.permissions p on p.id=rp.permission_id and p.code=p_permission
 join platform.customer_workspaces w on w.tenant_id=g.tenant_id and w.lifecycle_status in ('PROVISIONING','ACTIVE')
 where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
   and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
 order by w.id limit 1;
 if not found then raise exception 'setup_access_denied' using errcode='42501'; end if;
end $$;
revoke all on function app_private.require_setup_context(uuid,text) from public,anon,authenticated;
grant execute on function app_private.require_setup_context(uuid,text) to service_role;

create or replace function customer_api.create_building_setup_v1(
 p_context_id uuid,p_idempotency_key text,p_payload jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,platform
as $$
declare c record;r platform.building_setup_runs%rowtype;u jsonb;codes text[];
begin
 select * into c from app_private.require_setup_context(p_context_id,'onboarding.import.manage');
 if p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'invalid_idempotency_key' using errcode='22023'; end if;
 if coalesce(p_payload#>>'{association,name}','')='' or coalesce(p_payload#>>'{building,name}','')='' then raise exception 'setup_required_fields' using errcode='22023'; end if;
 if upper(coalesce(p_payload->>'currency',''))<>'RON' then raise exception 'setup_currency_must_be_ron' using errcode='22023'; end if;
 if (p_payload->>'period_start')::date>(p_payload->>'period_end')::date then raise exception 'setup_invalid_period' using errcode='22023'; end if;
 if jsonb_typeof(p_payload->'units')<>'array' or jsonb_array_length(p_payload->'units')<1 or jsonb_array_length(p_payload->'units')>500 then raise exception 'setup_invalid_units' using errcode='22023'; end if;
 select array_agg(x->>'code') into codes from jsonb_array_elements(p_payload->'units') x;
 if exists(select 1 from unnest(codes) x group by x having count(*)>1) or exists(select 1 from unnest(codes) x where nullif(trim(x),'') is null) then raise exception 'setup_duplicate_unit_code' using errcode='22023'; end if;
 insert into platform.building_setup_runs(tenant_id,customer_workspace_id,idempotency_key,setup_payload,payload_hash,created_by)
 values(c.tenant_id,c.workspace_id,p_idempotency_key,p_payload,encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex'),auth.uid())
 on conflict(tenant_id,idempotency_key) do update set updated_at=statement_timestamp()
 returning * into r;
 return jsonb_build_object('version',1,'run_id',r.id,'status',r.status,'payload_hash',r.payload_hash);
end $$;

create or replace function customer_api.rehearse_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform
as $$
declare c record;r platform.building_setup_runs%rowtype;d numeric;cr numeric;result jsonb;
begin
 select * into c from app_private.require_setup_context(p_context_id,'onboarding.import.manage');
 select * into r from platform.building_setup_runs where id=p_run_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002'; end if;
 if r.status not in ('draft','rehearsed') then raise exception 'setup_invalid_state' using errcode='22023'; end if;
 select coalesce(sum((x->>'amount')::numeric) filter(where x->>'side'='debit'),0),
        coalesce(sum((x->>'amount')::numeric) filter(where x->>'side'='credit'),0)
 into d,cr from jsonb_array_elements(coalesce(r.setup_payload->'opening_balances','[]'::jsonb)) x;
 result=jsonb_build_object('debits',d,'credits',cr,'difference',d-cr,'unit_count',jsonb_array_length(r.setup_payload->'units'),'zero_writes',true,'balanced',d=cr);
 if d<>cr then raise exception 'opening_balance_rehearsal_not_zero' using errcode='22023'; end if;
 update platform.building_setup_runs set status='rehearsed',rehearsal_result=result,updated_at=statement_timestamp() where id=r.id;
 return jsonb_build_object('version',1,'run_id',r.id,'status','rehearsed','rehearsal',result);
end $$;

create or replace function customer_api.submit_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform
as $$
declare c record;r platform.building_setup_runs%rowtype;
begin
 select * into c from app_private.require_setup_context(p_context_id,'onboarding.import.manage');
 select * into r from platform.building_setup_runs where id=p_run_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002'; end if;
 if r.status<>'rehearsed' or coalesce((r.rehearsal_result->>'balanced')::boolean,false) is not true then raise exception 'setup_rehearsal_required' using errcode='22023'; end if;
 update platform.building_setup_runs set status='submitted',submitted_by=auth.uid(),updated_at=statement_timestamp() where id=r.id;
 return jsonb_build_object('version',1,'run_id',r.id,'status','submitted');
end $$;

create or replace function customer_api.approve_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform
as $$
declare c record;r platform.building_setup_runs%rowtype;
begin
 select * into c from app_private.require_setup_context(p_context_id,'onboarding.import.approve');
 select * into r from platform.building_setup_runs where id=p_run_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002'; end if;
 if r.status<>'submitted' then raise exception 'setup_invalid_state' using errcode='22023'; end if;
 if r.submitted_by=auth.uid() then raise exception 'setup_dual_control_violation' using errcode='42501'; end if;
 update platform.building_setup_runs set status='approved',approved_by=auth.uid(),updated_at=statement_timestamp() where id=r.id;
 return jsonb_build_object('version',1,'run_id',r.id,'status','approved');
end $$;

create or replace function customer_api.provision_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,platform,portfolio,finance
as $$
declare c record;r platform.building_setup_runs%rowtype;p_id uuid;b_id uuid;x jsonb;
begin
 select * into c from app_private.require_setup_context(p_context_id,'onboarding.import.approve');
 select * into r from platform.building_setup_runs where id=p_run_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002'; end if;
 if r.status='provisioned' then return jsonb_build_object('version',1,'run_id',r.id,'status',r.status,'property_id',r.property_id,'idempotent',true); end if;
 if r.status<>'approved' then raise exception 'setup_approval_required' using errcode='22023'; end if;
 insert into portfolio.properties(tenant_id,type,name,base_currency,status)
 values(c.tenant_id,'condominium',r.setup_payload#>>'{association,name}','RON','active') returning id into p_id;
 insert into portfolio.buildings(tenant_id,property_id,code,name,floors,status)
 values(c.tenant_id,p_id,coalesce(r.setup_payload#>>'{building,code}','MAIN'),r.setup_payload#>>'{building,name}',nullif(r.setup_payload#>>'{building,floors}','')::smallint,'active') returning id into b_id;
 for x in select value from jsonb_array_elements(r.setup_payload->'units') loop
   insert into portfolio.units(tenant_id,building_id,code,floor,area_m2,status)
   values(c.tenant_id,b_id,x->>'code',nullif(x->>'floor','')::smallint,nullif(x->>'area_m2','')::numeric,'active');
 end loop;
 insert into finance.accounting_periods(tenant_id,property_id,starts_on,ends_on,status)
 values(c.tenant_id,p_id,(r.setup_payload->>'period_start')::date,(r.setup_payload->>'period_end')::date,'open');
 update platform.building_setup_runs set status='provisioned',property_id=p_id,updated_at=statement_timestamp() where id=r.id;
 return jsonb_build_object('version',1,'run_id',r.id,'status','provisioned','property_id',p_id,'building_id',b_id,'idempotent',false);
end $$;

revoke all on function customer_api.create_building_setup_v1(uuid,text,jsonb),customer_api.rehearse_building_setup_v1(uuid,uuid),customer_api.submit_building_setup_v1(uuid,uuid),customer_api.approve_building_setup_v1(uuid,uuid),customer_api.provision_building_setup_v1(uuid,uuid) from public,anon;
grant execute on function customer_api.create_building_setup_v1(uuid,text,jsonb),customer_api.rehearse_building_setup_v1(uuid,uuid),customer_api.submit_building_setup_v1(uuid,uuid),customer_api.approve_building_setup_v1(uuid,uuid),customer_api.provision_building_setup_v1(uuid,uuid) to authenticated,service_role;

commit;
