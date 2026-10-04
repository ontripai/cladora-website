begin;

-- Separate action; no base/local role, assignment, module or entitlement grant.
insert into identity.permissions(code,resource,action,description)
values('airprop.diligence.manage','airprop.diligence','manage','Create workspace diligence drafts against exact underwriting versions')
on conflict(code) do nothing;
insert into platform.module_permission_bindings(module_definition_id,permission_id,binding_version,permission_mode,
 is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,'manage',true,false,true,'active' from platform.module_definitions m
join identity.permissions p on p.code='airprop.diligence.manage' where m.code='airprop_commercial' and m.version=1
on conflict(module_definition_id,permission_id,binding_version) do nothing;

create or replace function app_private.validate_airprop_module_bindings_v1()
returns void language plpgsql stable security definer set search_path=pg_catalog,platform,identity
as $$
declare actual integer; matched integer;
begin
 select count(*) into actual from platform.module_permission_bindings b join platform.module_definitions m on m.id=b.module_definition_id
 where m.code='airprop_commercial' and m.version=1;
 select count(*) into matched from platform.module_permission_bindings b
 join platform.module_definitions m on m.id=b.module_definition_id
 join identity.permissions p on p.id=b.permission_id
 join(values('airprop.opportunity.read','read'),('airprop.opportunity.manage','manage'),
 ('airprop.underwriting.manage','manage'),('airprop.asset.read','read'),('airprop.asset.manage','manage'),('airprop.diligence.manage','manage')) x(code,mode)
 on p.code=x.code and b.permission_mode=x.mode
 where m.code='airprop_commercial' and m.version=1 and b.binding_version=1
 and b.is_assignable_to_local_role and not b.is_delegable and b.requires_aal2
 and b.lifecycle_status='active' and b.valid_to is null;
 if actual<>6 or matched<>6 then raise exception 'airprop_module_binding_manifest_mismatch' using errcode='P0002'; end if;
end;
$$;
revoke all on function app_private.validate_airprop_module_bindings_v1() from public,anon,authenticated,service_role;
select app_private.validate_airprop_module_bindings_v1();


create table airprop.diligence_cases(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id),
 workspace_id uuid not null references platform.customer_workspaces(id),
 opportunity_id uuid not null references airprop.investment_opportunities(id),
 underwriting_case_id uuid not null references airprop.underwriting_cases(id),
 underwriting_version integer not null check(underwriting_version>0),
 revision integer not null default 1 check(revision=1),
 policy_version integer not null default 1 check(policy_version=1),
 status text not null default 'draft' check(status='draft'),
 checklist jsonb not null default '[{"code":"legal","status":"pending","evidence_version_ids":[]},{"code":"financial","status":"pending","evidence_version_ids":[]},{"code":"technical","status":"pending","evidence_version_ids":[]}]',
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default statement_timestamp(),
 foreign key(underwriting_case_id,underwriting_version) references airprop.underwriting_versions(underwriting_case_id,version),
 unique(tenant_id,opportunity_id,underwriting_version)
);
create index diligence_workspace_idx on airprop.diligence_cases(workspace_id,tenant_id);
create index diligence_opportunity_idx on airprop.diligence_cases(opportunity_id);
create index diligence_underwriting_idx on airprop.diligence_cases(underwriting_case_id,underwriting_version);
create index diligence_creator_idx on airprop.diligence_cases(created_by);
alter table airprop.diligence_cases enable row level security;
revoke all on airprop.diligence_cases from public,anon,authenticated,service_role;

create function app_private.protect_airprop_diligence_draft_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if tg_op<>'INSERT' then raise exception 'airprop_diligence_draft_immutable' using errcode='22023';end if;
 if new.revision<>1 or new.policy_version<>1 or new.status<>'draft'
 or new.checklist is distinct from '[{"code":"legal","status":"pending","evidence_version_ids":[]},{"code":"financial","status":"pending","evidence_version_ids":[]},{"code":"technical","status":"pending","evidence_version_ids":[]}]'::jsonb
 or not exists(select 1 from airprop.investment_opportunities o join airprop.underwriting_cases c on c.opportunity_id=o.id and c.tenant_id=o.tenant_id
 where o.id=new.opportunity_id and o.tenant_id=new.tenant_id and o.workspace_id=new.workspace_id and c.id=new.underwriting_case_id) then
 raise exception 'airprop_diligence_reference_mismatch' using errcode='22023';end if;
 return new;
end;$$;
create trigger protect_airprop_diligence_draft before insert or update or delete on airprop.diligence_cases
for each row execute function app_private.protect_airprop_diligence_draft_v1();
revoke all on function app_private.protect_airprop_diligence_draft_v1() from public,anon,authenticated,service_role;

create function app_private.require_airprop_diligence_target_v1(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_write boolean)
returns airprop.investment_opportunities language plpgsql security definer set search_path=pg_catalog as $$
declare o airprop.investment_opportunities%rowtype;
begin
 o=app_private.require_airprop_underwriting_opportunity_v2(p_context_id,p_workspace_id,p_opportunity_id,'airprop.opportunity.read');
 if p_write is null or (p_write and not app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'airprop.diligence.manage','airprop_commercial')) then
 raise exception 'airprop_workspace_access_denied' using errcode='42501';end if;
 return o;
end;$$;
revoke all on function app_private.require_airprop_diligence_target_v1(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function customer_api.create_airprop_diligence_draft_v1(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_expected_underwriting_version integer,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o airprop.investment_opportunities%rowtype; c airprop.underwriting_cases%rowtype; d airprop.diligence_cases%rowtype;
 r platform.idempotency_keys%rowtype; k text; h text; response jsonb; a record;
begin
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,true);
 if p_expected_underwriting_version is null or p_expected_underwriting_version<1 or p_idempotency_key is null
 or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'airprop_invalid_diligence' using errcode='22023';end if;
 k='airprop.diligence.create.v1/'||p_workspace_id||'/'||p_opportunity_id||'/'||p_idempotency_key;
 h=encode(sha256(convert_to(jsonb_build_object('actor_id',auth.uid(),'workspace_id',p_workspace_id,'opportunity_id',p_opportunity_id,'underwriting_version',p_expected_underwriting_version)::text,'UTF8')),'hex');
 perform 1 from airprop.investment_opportunities where id=o.id for update;
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,true);
 select * into r from platform.idempotency_keys where tenant_id=o.tenant_id and key=k for update;
 if found then
  if r.actor_id is distinct from auth.uid() or r.request_hash is distinct from h then raise exception 'airprop_idempotency_conflict' using errcode='22023';end if;
  return r.response_ref||jsonb_build_object('idempotent',true);
 end if;
 select * into c from airprop.underwriting_cases where tenant_id=o.tenant_id and opportunity_id=o.id for update;
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,true);
 if c.id is null or c.status<>'published' or c.current_version<>p_expected_underwriting_version or o.status<>'underwriting' then
 raise exception 'airprop_diligence_baseline_conflict' using errcode='22023';end if;
 if exists(select 1 from airprop.diligence_cases where tenant_id=o.tenant_id and opportunity_id=o.id and underwriting_version=p_expected_underwriting_version) then
 raise exception 'airprop_diligence_already_exists' using errcode='22023';end if;
 insert into airprop.diligence_cases(tenant_id,workspace_id,opportunity_id,underwriting_case_id,underwriting_version,created_by)
 values(o.tenant_id,o.workspace_id,o.id,c.id,c.current_version,auth.uid()) returning * into d;
 response=jsonb_build_object('version',1,'diligence_case_id',d.id,'workspace_id',d.workspace_id,'opportunity_id',d.opportunity_id,'underwriting_case_id',d.underwriting_case_id,
 'underwriting_version',d.underwriting_version,'revision',1,'policy_version',1,'status','draft','idempotent',false);
 select * into a from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(o.tenant_id,auth.uid(),a.role_code,'AIRPROP_DILIGENCE_DRAFT_CREATED','airprop.diligence_case',d.id,response-'idempotent','Exact-version diligence draft');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(o.tenant_id,'airprop.diligence_case',d.id,1,'airprop.diligence.draft_created.v1',response-'idempotent');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,response_ref,status_code,expires_at)
 values(o.tenant_id,auth.uid(),k,h,response,201,statement_timestamp()+interval '30 days');
 return response;
end;$$;
revoke all on function customer_api.create_airprop_diligence_draft_v1(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function customer_api.create_airprop_diligence_draft_v1(uuid,uuid,uuid,integer,text) to authenticated;

create function customer_api.list_airprop_diligence_drafts_v1(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o airprop.investment_opportunities%rowtype; rows jsonb;
begin
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,false);
 select coalesce(jsonb_agg(jsonb_build_object('diligence_case_id',d.id,'underwriting_case_id',d.underwriting_case_id,'underwriting_version',d.underwriting_version,
 'revision',d.revision,'policy_version',d.policy_version,'status',d.status,'checklist',d.checklist,'created_at',d.created_at) order by d.underwriting_version desc),'[]'::jsonb) into rows
 from (select * from airprop.diligence_cases where tenant_id=o.tenant_id and workspace_id=o.workspace_id and opportunity_id=o.id order by underwriting_version desc limit 50) d;
 return jsonb_build_object('version',1,'workspace_id',o.workspace_id,'opportunity_id',o.id,'drafts',rows);
end;$$;
revoke all on function customer_api.list_airprop_diligence_drafts_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function customer_api.list_airprop_diligence_drafts_v1(uuid,uuid,uuid) to authenticated;

commit;
