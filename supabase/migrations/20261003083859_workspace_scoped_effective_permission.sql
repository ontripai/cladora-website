begin;

-- Shared context ceiling. Domain permissions continue to come from the core engine.
create function app_private.context_covers_workspace_target_v1(
 p_context_id uuid,p_target_scope_type text,p_target_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private
as $$
declare
 r record; g identity.context_grants%rowtype;
 target_property uuid; target_building uuid; source_property uuid;
 target_tenant uuid; binding_count integer;
begin
 if auth.uid() is null or p_context_id is null or p_target_scope_id is null
   or p_target_scope_type is null or p_target_scope_type not in ('workspace','property','building','unit') then
  return false;
 end if;
 begin
  select * into r from app_private.resolve_workspace_from_customer_context_v1(p_context_id,false);
 exception when sqlstate '42501' then return false;
 end;
 if r.workspace_id is null or r.status is distinct from 'active' then return false; end if;
 select * into g from identity.context_grants where id=p_context_id
  and membership_id=r.membership_id and tenant_id=r.tenant_id;
 if not found then return false; end if;
 if p_target_scope_type='workspace' then
  return g.scope_type='tenant' and p_target_scope_id=r.workspace_id;
 elsif p_target_scope_type='property' then
  select id,tenant_id into target_property,target_tenant
   from portfolio.properties where id=p_target_scope_id;
 elsif p_target_scope_type='building' then
  select property_id,id,tenant_id into target_property,target_building,target_tenant
   from portfolio.buildings where id=p_target_scope_id;
 else
  select b.property_id,u.building_id,u.tenant_id into target_property,target_building,target_tenant
   from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
   where u.id=p_target_scope_id;
 end if;
 if target_property is null or target_tenant is distinct from r.tenant_id then return false; end if;
 if not exists(select 1 from portfolio.properties where id=target_property and tenant_id=r.tenant_id) then return false; end if;
 select count(*) into binding_count from platform.workspace_property_bindings
  where property_id=target_property and status='active'
   and valid_from<=statement_timestamp() and(valid_to is null or valid_to>statement_timestamp());
 if binding_count<>1 or not exists(
  select 1 from platform.workspace_property_bindings
  where property_id=target_property and customer_workspace_id=r.workspace_id and tenant_id=r.tenant_id
   and status='active' and valid_from<=statement_timestamp() and(valid_to is null or valid_to>statement_timestamp())
 ) then return false; end if;
 if g.scope_type='tenant' then return true;
 elsif g.scope_type='property' then return g.property_id=target_property;
 elsif g.scope_type='building' then
  select property_id into source_property from portfolio.buildings where id=g.building_id and tenant_id=r.tenant_id;
  return coalesce(p_target_scope_type in ('building','unit') and target_building=g.building_id
   and source_property=target_property and(g.property_id is null or g.property_id=source_property),false);
 elsif g.scope_type='unit' then
  return coalesce(p_target_scope_type='unit' and g.unit_id=p_target_scope_id
   and(g.building_id is null or g.building_id=target_building)
   and(g.property_id is null or g.property_id=target_property),false);
 end if;
 return false;
end;
$$;

create function app_private.check_scoped_effective_permission_v1(
 p_context_id uuid,p_permission_code text,p_module_code text,p_target_scope_type text,p_target_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,app_private
as $$
begin
 if not app_private.context_covers_workspace_target_v1(p_context_id,p_target_scope_type,p_target_scope_id) then return false; end if;
 return coalesce(app_private.check_effective_permission_v1(
  p_context_id,p_permission_code,p_module_code,p_target_scope_type,p_target_scope_id),false);
end;
$$;
revoke all on function app_private.context_covers_workspace_target_v1(uuid,text,uuid),
 app_private.check_scoped_effective_permission_v1(uuid,text,text,text,uuid)
 from public,anon,authenticated,service_role;
comment on function app_private.check_scoped_effective_permission_v1(uuid,text,text,text,uuid)
 is 'Internal additive adapter: context ceiling AND canonical effective permission; caller-specific AAL and mutation binding gates remain required. AIRPROP command and read adapters use this shared scope ceiling.';

-- AIRPROP is a runtime module in the existing catalogue; workspace activation is separate.
insert into platform.module_definitions(code,version,name,labels_json,description,category,is_active,lifecycle_status,
 sensitivity_level,requires_aal2,entitlement_key,published_at)
values('airprop_commercial',1,'AIRPROP Commercial Workspace',
 '{"ro":"AIRPROP Comercial","en":"AIRPROP Commercial","fa":"ایرپراپ تجاری"}',
 'Commercial opportunities, underwriting and interests referencing canonical workspace subjects',
 'investment',true,'published','high_impact',true,'module.airprop_commercial',statement_timestamp());

insert into platform.module_permission_bindings(module_definition_id,permission_id,binding_version,permission_mode,
 is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,x.mode,true,false,true,'active'
from (values
 ('airprop.opportunity.read','read'),('airprop.opportunity.manage','manage'),
 ('airprop.underwriting.manage','manage'),('airprop.asset.read','read'),('airprop.asset.manage','manage')
) x(code,mode) join identity.permissions p on p.code=x.code
cross join platform.module_definitions m where m.code='airprop_commercial' and m.version=1;

-- AIRPROP applies to the full workspace taxonomy; this seed covers existing v1 taxonomy only.
insert into platform.module_property_profile_compatibilities(module_definition_id,property_profile_id,compatibility_level,reason)
select m.id,p.id,'compatible','AIRPROP workspace-wide commercial domain, initial taxonomy v1'
from platform.module_definitions m cross join platform.property_profiles p
where m.code='airprop_commercial' and m.version=1 and p.version=1;
insert into platform.module_operating_model_compatibilities(module_definition_id,operating_model_id,compatibility_level,reason)
select m.id,o.id,'compatible','AIRPROP commercial model remains distinct from workspace operating taxonomy'
from platform.module_definitions m cross join platform.operating_models o
where m.code='airprop_commercial' and m.version=1 and o.version=1;

create function app_private.validate_airprop_module_bindings_v1()
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
 ('airprop.underwriting.manage','manage'),('airprop.asset.read','read'),('airprop.asset.manage','manage')) x(code,mode)
 on p.code=x.code and b.permission_mode=x.mode
 where m.code='airprop_commercial' and m.version=1 and b.binding_version=1
 and b.is_assignable_to_local_role and not b.is_delegable and b.requires_aal2
 and b.lifecycle_status='active' and b.valid_to is null;
 if actual<>5 or matched<>5 then raise exception 'airprop_module_binding_manifest_mismatch' using errcode='P0002'; end if;
end;
$$;
revoke all on function app_private.validate_airprop_module_bindings_v1() from public,anon,authenticated,service_role;
select app_private.validate_airprop_module_bindings_v1();

-- Preserve the historic registry manifest within its module set as new domains are added.
create or replace function app_private.validate_module_permission_bindings_v2_seeding_v1()
returns void
language plpgsql
security definer
set search_path = pg_catalog, platform, identity
as $$
declare
  v_total_count integer;
  v_active_count integer;
  v_delegable_active_count integer;
  v_non_delegable_active_count integer;
  v_v2_non_delegable_count integer;
begin
  select count(*) into v_total_count from platform.module_permission_bindings where module_definition_id in (select id from platform.module_definitions where code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security'));
  if v_total_count <> 90 then
    raise exception 'module_permission_bindings_total_count_mismatch: expected 90, got %', v_total_count using errcode = 'P0002';
  end if;

  select count(*) into v_active_count from platform.module_permission_bindings where module_definition_id in (select id from platform.module_definitions where code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security')) and lifecycle_status = 'active';
  if v_active_count <> 48 then
    raise exception 'module_permission_bindings_active_count_mismatch: expected 48, got %', v_active_count using errcode = 'P0002';
  end if;

  select count(*) into v_delegable_active_count from platform.module_permission_bindings where module_definition_id in (select id from platform.module_definitions where code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security')) and lifecycle_status = 'active' and is_delegable = true;
  if v_delegable_active_count <> 42 then
    raise exception 'delegable_active_count_mismatch: expected 42, got %', v_delegable_active_count using errcode = 'P0002';
  end if;

  select count(*) into v_non_delegable_active_count from platform.module_permission_bindings where module_definition_id in (select id from platform.module_definitions where code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security')) and lifecycle_status = 'active' and is_delegable = false;
  if v_non_delegable_active_count <> 6 then
    raise exception 'non_delegable_active_count_mismatch: expected 6, got %', v_non_delegable_active_count using errcode = 'P0002';
  end if;

  -- Ensure 6 non-delegable permissions have zero v2 records
  select count(*) into v_v2_non_delegable_count
  from platform.module_permission_bindings b
  join identity.permissions p on p.id = b.permission_id
  where p.code in ('billing.cancel', 'payments.reverse', 'payments.reconcile', 'utilities.tariffs.manage', 'governance.votes.administer', 'governance.minutes.finalize')
    and b.binding_version = 2;

  if v_v2_non_delegable_count <> 0 then
    raise exception 'non_delegable_permissions_must_not_have_v2_records' using errcode = 'P0002';
  end if;
end;
$$;
select app_private.validate_module_permission_bindings_v2_seeding_v1();

-- Additive gate for bound AIRPROP subjects. Existing public commands are not cut over here.
create function app_private.require_airprop_workspace_context_v1(
 p_context_id uuid,p_permission text,p_property_id uuid
) returns table(workspace_id uuid,tenant_id uuid,membership_id uuid,role_code text)
language plpgsql stable security definer set search_path=pg_catalog,app_private
as $$
declare r record; mutation boolean;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
 if p_permission is null or p_permission not in('airprop.opportunity.read','airprop.opportunity.manage',
 'airprop.underwriting.manage','airprop.asset.read','airprop.asset.manage') or p_property_id is null then
  raise exception 'airprop_workspace_access_denied' using errcode='42501';
 end if;
 mutation:=p_permission not in('airprop.opportunity.read','airprop.asset.read');
 select * into r from app_private.resolve_workspace_from_customer_context_v1(p_context_id,mutation);
 if not app_private.check_scoped_effective_permission_v1(p_context_id,p_permission,'airprop_commercial','property',p_property_id) then
  raise exception 'airprop_workspace_access_denied' using errcode='42501';
 end if;
 return query select r.workspace_id,r.tenant_id,r.membership_id,r.role_code;
end;
$$;
revoke all on function app_private.require_airprop_workspace_context_v1(uuid,text,uuid)
 from public,anon,authenticated,service_role;

-- Existing command cutover: the business and retry semantics remain intact.
create or replace function app_private.create_airprop_opportunity_internal_v1(p_context_id uuid,p_idempotency_key text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,airprop,portfolio,audit,extensions
as $$
declare a record;o airprop.investment_opportunities%rowtype;v_hash text;v_property uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 v_property=nullif(p_payload->>'property_id','')::uuid;
 select * into a from app_private.require_airprop_workspace_context_v1(p_context_id,'airprop.opportunity.manage',v_property);
 if p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'invalid_idempotency_key' using errcode='22023';end if;
 if jsonb_typeof(p_payload)<>'object' or nullif(trim(p_payload->>'name'),'') is null or upper(coalesce(p_payload->>'country_code',''))<>'RO'
   or nullif(trim(p_payload->>'city'),'') is null or upper(coalesce(p_payload->>'currency','')) not in('RON','EUR')
   or coalesce((p_payload->>'asking_price')::numeric,0)<=0 then raise exception 'airprop_invalid_opportunity' using errcode='22023';end if;
 if v_property is not null and not exists(select 1 from portfolio.properties p where p.id=v_property and p.tenant_id=a.tenant_id) then raise exception 'airprop_property_not_found' using errcode='P0002';end if;
 v_hash=encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
 select * into o from airprop.investment_opportunities where tenant_id=a.tenant_id and idempotency_key=p_idempotency_key for update;
 if found then
  if o.input_hash<>v_hash then raise exception 'airprop_idempotency_payload_mismatch' using errcode='22023';end if;
  return jsonb_build_object('version',1,'opportunity_id',o.id,'status',o.status,'idempotent',true);
 end if;
 insert into airprop.investment_opportunities(tenant_id,property_id,idempotency_key,name,country_code,city,asking_price,currency,source_ref,input_hash,created_by)
 values(a.tenant_id,v_property,p_idempotency_key,trim(p_payload->>'name'),'RO',trim(p_payload->>'city'),(p_payload->>'asking_price')::numeric,upper(p_payload->>'currency'),nullif(trim(p_payload->>'source_ref'),''),v_hash,auth.uid()) returning * into o;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(a.tenant_id,auth.uid(),a.role_code,'AIRPROP_OPPORTUNITY_CREATED','airprop.investment_opportunity',o.id,jsonb_build_object('status',o.status,'country_code',o.country_code,'currency',o.currency),'AIRPROP synthetic/core opportunity evidence');
 return jsonb_build_object('version',1,'opportunity_id',o.id,'status',o.status,'idempotent',false);
end$$;

create or replace function app_private.add_airprop_underwriting_version_internal_v1(p_context_id uuid,p_opportunity_id uuid,p_assumptions jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,airprop,audit,extensions
as $$
declare a record;ctx record;o airprop.investment_opportunities%rowtype;c airprop.underwriting_cases%rowtype;v airprop.underwriting_versions%rowtype;
 cost numeric;rent numeric;opex numeric;noi numeric;v_hash text;next_version integer;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 select * into ctx from app_private.resolve_workspace_from_customer_context_v1(p_context_id,true);
 select * into o from airprop.investment_opportunities where id=p_opportunity_id and tenant_id=ctx.tenant_id;
 if not found then raise exception 'airprop_opportunity_not_found' using errcode='P0002';end if;
 select * into a from app_private.require_airprop_workspace_context_v1(p_context_id,'airprop.underwriting.manage',o.property_id);
 if o.tenant_id<>a.tenant_id then raise exception 'airprop_opportunity_not_found' using errcode='P0002';end if;
 if jsonb_typeof(p_assumptions)<>'object' then raise exception 'airprop_invalid_underwriting' using errcode='22023';end if;
 cost=coalesce((p_assumptions->>'acquisition_cost')::numeric,0);rent=coalesce((p_assumptions->>'annual_rent')::numeric,-1);opex=coalesce((p_assumptions->>'annual_opex')::numeric,-1);
 if cost<=0 or rent<0 or opex<0 or opex>rent then raise exception 'airprop_invalid_underwriting' using errcode='22023';end if;
 v_hash=encode(extensions.digest(convert_to(p_assumptions::text,'UTF8'),'sha256'),'hex');noi=rent-opex;
 insert into airprop.underwriting_cases(tenant_id,opportunity_id,created_by) values(a.tenant_id,p_opportunity_id,auth.uid())
 on conflict(tenant_id,opportunity_id) do update set updated_at=statement_timestamp() returning * into c;
 perform pg_advisory_xact_lock(hashtextextended(c.id::text,0));
 select * into v from airprop.underwriting_versions where underwriting_case_id=c.id and input_hash=v_hash;
 if found then return jsonb_build_object('version',v.version,'underwriting_case_id',c.id,'results',v.results,'idempotent',true);end if;
 select coalesce(max(version),0)+1 into next_version from airprop.underwriting_versions where underwriting_case_id=c.id;
 insert into airprop.underwriting_versions(tenant_id,underwriting_case_id,version,assumptions,results,input_hash,created_by)
 values(a.tenant_id,c.id,next_version,p_assumptions,jsonb_build_object('annual_noi',noi,'gross_yield',round(rent/cost,8),'net_yield',round(noi/cost,8),'currency',upper(coalesce(p_assumptions->>'currency',o.currency))),v_hash,auth.uid()) returning * into v;
 update airprop.underwriting_cases set current_version=next_version,status='published',updated_at=statement_timestamp() where id=c.id;
 update airprop.investment_opportunities set status='underwriting',updated_at=statement_timestamp() where id=p_opportunity_id and status in('draft','qualified','underwriting');
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(a.tenant_id,auth.uid(),a.role_code,'AIRPROP_UNDERWRITING_VERSION_CREATED','airprop.underwriting_case',c.id,jsonb_build_object('version',next_version,'input_hash',v_hash),'AIRPROP deterministic underwriting evidence');
 return jsonb_build_object('version',next_version,'underwriting_case_id',c.id,'results',v.results,'idempotent',false);
end$$;

create or replace function app_private.configure_airprop_property_internal_v1(p_context_id uuid,p_property_id uuid,p_party_id uuid,p_interest_kind airprop.interest_kind,p_share numeric,p_model airprop.operating_model_kind,p_valid_from date,p_country_pack_code text default 'AIRPROP-RO',p_country_pack_version text default '1.0')
returns jsonb language plpgsql security definer set search_path=pg_catalog,airprop,portfolio,audit
as $$
declare a record;i airprop.property_interests%rowtype;m airprop.property_operating_models%rowtype;
begin
 select * into a from app_private.require_airprop_workspace_context_v1(p_context_id,'airprop.asset.manage',p_property_id);
 if not exists(select 1 from portfolio.properties p where p.id=p_property_id and p.tenant_id=a.tenant_id) then raise exception 'airprop_property_not_found' using errcode='P0002';end if;
 if not exists(select 1 from portfolio.parties p where p.id=p_party_id and p.tenant_id=a.tenant_id) then raise exception 'airprop_party_not_found' using errcode='P0002';end if;
 if p_share<=0 or p_share>1 or p_valid_from is null then raise exception 'airprop_invalid_property_configuration' using errcode='22023';end if;
 if p_country_pack_code<>'AIRPROP-RO' or p_country_pack_version<>'1.0' then raise exception 'airprop_country_pack_not_active' using errcode='22023';end if;
 select * into i from airprop.property_interests where tenant_id=a.tenant_id and property_id=p_property_id and party_id=p_party_id and kind=p_interest_kind and valid_from=p_valid_from;
 select * into m from airprop.property_operating_models where tenant_id=a.tenant_id and property_id=p_property_id and valid_from=p_valid_from;
 if i.id is not null or m.id is not null then
  if i.id is null or m.id is null or i.share<>p_share or m.model<>p_model or m.country_pack_code<>p_country_pack_code or m.country_pack_version<>p_country_pack_version then raise exception 'airprop_property_configuration_conflict' using errcode='22023';end if;
  return jsonb_build_object('version',1,'interest_id',i.id,'operating_model_id',m.id,'idempotent',true);
 end if;
 insert into airprop.property_interests(tenant_id,property_id,party_id,kind,share,valid_from,created_by)
 values(a.tenant_id,p_property_id,p_party_id,p_interest_kind,p_share,p_valid_from,auth.uid()) returning * into i;
 insert into airprop.property_operating_models(tenant_id,property_id,model,country_pack_code,country_pack_version,valid_from,created_by)
 values(a.tenant_id,p_property_id,p_model,p_country_pack_code,p_country_pack_version,p_valid_from,auth.uid()) returning * into m;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(a.tenant_id,auth.uid(),a.role_code,'AIRPROP_PROPERTY_CONFIGURED','portfolio.property',p_property_id,jsonb_build_object('interest_kind',p_interest_kind,'share',p_share,'operating_model',p_model,'country_pack_code',p_country_pack_code,'country_pack_version',p_country_pack_version),'AIRPROP Romania core configuration evidence');
 return jsonb_build_object('version',1,'interest_id',i.id,'operating_model_id',m.id,'idempotent',false);
end$$;



-- RLS uses the same core scope/permission engine as command authorization.
create function app_private.can_read_airprop_subject_v1(
 p_tenant_id uuid,p_property_id uuid,p_permission text
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,app_private
as $$
declare r record; ctx uuid;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
  or p_tenant_id is null or p_property_id is null or p_permission is null
  or p_permission not in('airprop.opportunity.read','airprop.asset.read')
  or p_tenant_id is distinct from app_private.active_tenant_id() then return false;end if;
 ctx:=app_private.active_context_id();
 begin
  select * into r from app_private.resolve_workspace_from_customer_context_v1(ctx,false);
 exception when sqlstate '42501' then return false;
 end;
 if r.tenant_id is distinct from p_tenant_id then return false;end if;
 return app_private.check_scoped_effective_permission_v1(ctx,p_permission,'airprop_commercial','property',p_property_id);
end;
$$;
revoke all on function app_private.can_read_airprop_subject_v1(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function app_private.can_read_airprop_subject_v1(uuid,uuid,text) to authenticated;

drop policy airprop_opportunities_context_read on airprop.investment_opportunities;
create policy airprop_opportunities_context_read on airprop.investment_opportunities for select to authenticated
 using(app_private.can_read_airprop_subject_v1(tenant_id,property_id,'airprop.opportunity.read'));
drop policy airprop_underwriting_cases_context_read on airprop.underwriting_cases;
create policy airprop_underwriting_cases_context_read on airprop.underwriting_cases for select to authenticated
 using(exists(select 1 from airprop.investment_opportunities o where o.id=opportunity_id and o.tenant_id=underwriting_cases.tenant_id));
drop policy airprop_underwriting_versions_context_read on airprop.underwriting_versions;
create policy airprop_underwriting_versions_context_read on airprop.underwriting_versions for select to authenticated
 using(exists(select 1 from airprop.underwriting_cases c where c.id=underwriting_case_id and c.tenant_id=underwriting_versions.tenant_id));
drop policy airprop_property_interests_context_read on airprop.property_interests;
create policy airprop_property_interests_context_read on airprop.property_interests for select to authenticated
 using(app_private.can_read_airprop_subject_v1(tenant_id,property_id,'airprop.asset.read'));
drop policy airprop_operating_models_context_read on airprop.property_operating_models;
create policy airprop_operating_models_context_read on airprop.property_operating_models for select to authenticated
 using(app_private.can_read_airprop_subject_v1(tenant_id,property_id,'airprop.asset.read'));

commit;
