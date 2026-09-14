begin;

-- AIRPROP-CORE-001
-- Shared-core, Romania-first foundation for opportunities, versioned
-- underwriting, whole-property interests and effective operating models.
-- No customer fixture, journal, payment, provider or external integration.

create schema if not exists airprop;
grant usage on schema airprop to authenticated,service_role;

create type airprop.opportunity_status as enum
  ('draft','qualified','underwriting','due_diligence','approved','rejected','converted','cancelled');
create type airprop.interest_kind as enum
  ('legal_owner','beneficial_owner','lessor','lessee_operator','managing_agent');
create type airprop.operating_model_kind as enum
  ('own_asset','lease_operate','third_party_management');

create table airprop.investment_opportunities(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  idempotency_key text not null,
  name text not null,
  country_code char(2) not null,
  city text not null,
  asking_price numeric(20,4) not null check(asking_price>0),
  currency char(3) not null,
  status airprop.opportunity_status not null default 'draft',
  source_ref text,
  input_hash text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,idempotency_key)
);
create index airprop_opportunities_tenant_status_idx
  on airprop.investment_opportunities(tenant_id,status,created_at desc,id);
create index airprop_opportunities_property_idx
  on airprop.investment_opportunities(property_id) where property_id is not null;
create index airprop_opportunities_created_by_idx on airprop.investment_opportunities(created_by);

create table airprop.underwriting_cases(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  opportunity_id uuid not null references airprop.investment_opportunities(id) on delete restrict,
  status text not null default 'draft' check(status in ('draft','published','superseded','cancelled')),
  current_version integer not null default 0 check(current_version>=0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,opportunity_id)
);
create index airprop_underwriting_cases_opportunity_idx on airprop.underwriting_cases(opportunity_id);
create index airprop_underwriting_cases_created_by_idx on airprop.underwriting_cases(created_by);

create table airprop.underwriting_versions(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  underwriting_case_id uuid not null references airprop.underwriting_cases(id) on delete restrict,
  version integer not null check(version>0),
  assumptions jsonb not null check(jsonb_typeof(assumptions)='object'),
  results jsonb not null check(jsonb_typeof(results)='object'),
  input_hash text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique(underwriting_case_id,version),
  unique(underwriting_case_id,input_hash)
);
create index airprop_underwriting_versions_tenant_case_idx
  on airprop.underwriting_versions(tenant_id,underwriting_case_id,version desc);
create index airprop_underwriting_versions_created_by_idx on airprop.underwriting_versions(created_by);

create table airprop.property_interests(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  party_id uuid not null references portfolio.parties(id) on delete restrict,
  kind airprop.interest_kind not null,
  share numeric(10,8) not null check(share>0 and share<=1),
  valid_from date not null,
  valid_to date,
  evidence_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  check(valid_to is null or valid_to>valid_from),
  unique(property_id,party_id,kind,valid_from)
);
create index airprop_property_interests_scope_idx
  on airprop.property_interests(tenant_id,property_id,kind,valid_from,valid_to);
create index airprop_property_interests_party_idx on airprop.property_interests(party_id);
create index airprop_property_interests_created_by_idx on airprop.property_interests(created_by);

create table airprop.property_operating_models(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  model airprop.operating_model_kind not null,
  country_pack_code text not null,
  country_pack_version text not null,
  valid_from date not null,
  valid_to date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  check(valid_to is null or valid_to>valid_from),
  unique(property_id,valid_from)
);
create index airprop_operating_models_scope_idx
  on airprop.property_operating_models(tenant_id,property_id,valid_from,valid_to);
create index airprop_operating_models_created_by_idx on airprop.property_operating_models(created_by);

create or replace function airprop.enforce_core_integrity_v1()
returns trigger language plpgsql security invoker
set search_path=pg_catalog,airprop,portfolio
as $$
declare v_total numeric(10,8);v_tenant uuid;
begin
  select tenant_id into v_tenant from portfolio.properties where id=new.property_id;
  if v_tenant is null or v_tenant<>new.tenant_id then
    raise exception 'airprop_property_tenant_mismatch' using errcode='23514';
  end if;
  if tg_table_name='property_interests' then
    if not exists(select 1 from portfolio.parties p where p.id=new.party_id and p.tenant_id=new.tenant_id) then
      raise exception 'airprop_party_tenant_mismatch' using errcode='23514';
    end if;
    select coalesce(sum(i.share),0) into v_total
    from airprop.property_interests i
    where i.id<>new.id and i.tenant_id=new.tenant_id and i.property_id=new.property_id and i.kind=new.kind
      and daterange(i.valid_from,coalesce(i.valid_to,'infinity'::date),'[)') &&
          daterange(new.valid_from,coalesce(new.valid_to,'infinity'::date),'[)');
    if v_total+new.share>1 then
      raise exception 'airprop_interest_share_exceeded' using errcode='23514';
    end if;
  else
    if exists(select 1 from airprop.property_operating_models m
      where m.id<>new.id and m.tenant_id=new.tenant_id and m.property_id=new.property_id
        and daterange(m.valid_from,coalesce(m.valid_to,'infinity'::date),'[)') &&
            daterange(new.valid_from,coalesce(new.valid_to,'infinity'::date),'[)')) then
      raise exception 'airprop_operating_model_overlap' using errcode='23514';
    end if;
  end if;
  return new;
end $$;

create or replace function airprop.protect_underwriting_version_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$begin raise exception 'airprop_underwriting_version_immutable' using errcode='55000';end$$;

create trigger airprop_property_interests_integrity
before insert or update on airprop.property_interests
for each row execute function airprop.enforce_core_integrity_v1();
create trigger airprop_operating_models_integrity
before insert or update on airprop.property_operating_models
for each row execute function airprop.enforce_core_integrity_v1();
create trigger airprop_underwriting_versions_immutable
before update or delete on airprop.underwriting_versions
for each row execute function airprop.protect_underwriting_version_v1();

alter table airprop.investment_opportunities enable row level security;
alter table airprop.underwriting_cases enable row level security;
alter table airprop.underwriting_versions enable row level security;
alter table airprop.property_interests enable row level security;
alter table airprop.property_operating_models enable row level security;

create policy airprop_opportunities_context_read on airprop.investment_opportunities for select to authenticated
using(tenant_id=app_private.active_tenant_id() and (property_id is null or app_private.can_access_property(property_id)));
create policy airprop_underwriting_cases_context_read on airprop.underwriting_cases for select to authenticated
using(tenant_id=app_private.active_tenant_id() and exists(select 1 from airprop.investment_opportunities o where o.id=opportunity_id and (o.property_id is null or app_private.can_access_property(o.property_id))));
create policy airprop_underwriting_versions_context_read on airprop.underwriting_versions for select to authenticated
using(tenant_id=app_private.active_tenant_id() and exists(select 1 from airprop.underwriting_cases c join airprop.investment_opportunities o on o.id=c.opportunity_id where c.id=underwriting_case_id and (o.property_id is null or app_private.can_access_property(o.property_id))));
create policy airprop_property_interests_context_read on airprop.property_interests for select to authenticated
using(tenant_id=app_private.active_tenant_id() and app_private.can_access_property(property_id));
create policy airprop_operating_models_context_read on airprop.property_operating_models for select to authenticated
using(tenant_id=app_private.active_tenant_id() and app_private.can_access_property(property_id));

grant select on airprop.investment_opportunities,airprop.underwriting_cases,airprop.underwriting_versions,
  airprop.property_interests,airprop.property_operating_models to authenticated;
grant all on all tables in schema airprop to service_role;

insert into identity.permissions(code,resource,action,description) values
 ('airprop.opportunity.read','airprop.opportunity','read','Read AIRPROP investment opportunities'),
 ('airprop.opportunity.manage','airprop.opportunity','manage','Create and manage AIRPROP opportunities'),
 ('airprop.underwriting.manage','airprop.underwriting','manage','Create immutable AIRPROP underwriting versions'),
 ('airprop.asset.read','airprop.asset','read','Read AIRPROP property interests and operating models'),
 ('airprop.asset.manage','airprop.asset','manage','Configure AIRPROP property interests and operating models')
on conflict(code) do update set resource=excluded.resource,action=excluded.action,description=excluded.description;

insert into identity.roles(tenant_id,code,name,is_system) values
 (null,'airprop_portfolio_director','AIRPROP Portfolio Director',true),
 (null,'airprop_acquisition_manager','AIRPROP Acquisition Manager',true),
 (null,'airprop_asset_manager','AIRPROP Asset Manager',true)
on conflict(tenant_id,code) do update set name=excluded.name,is_system=true;

with allowed(role_code,permission_code) as(values
 ('airprop_portfolio_director','airprop.opportunity.read'),('airprop_portfolio_director','airprop.opportunity.manage'),
 ('airprop_portfolio_director','airprop.underwriting.manage'),('airprop_portfolio_director','airprop.asset.read'),
 ('airprop_portfolio_director','airprop.asset.manage'),
 ('airprop_acquisition_manager','airprop.opportunity.read'),('airprop_acquisition_manager','airprop.opportunity.manage'),
 ('airprop_acquisition_manager','airprop.underwriting.manage'),('airprop_acquisition_manager','airprop.asset.read'),
 ('airprop_asset_manager','airprop.opportunity.read'),('airprop_asset_manager','airprop.underwriting.manage'),
 ('airprop_asset_manager','airprop.asset.read'),('airprop_asset_manager','airprop.asset.manage')
)
insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow' from allowed a
join identity.roles r on r.tenant_id is null and r.code=a.role_code
join identity.permissions p on p.code=a.permission_code
on conflict(role_id,permission_id) do update set effect='allow';

create or replace function app_private.require_airprop_context_v1(p_context_id uuid,p_permission text,p_property_id uuid default null)
returns table(tenant_id uuid,role_code text)
language plpgsql stable security definer set search_path=pg_catalog,identity,portfolio
as $$
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 return query
 select g.tenant_id,r.code from identity.context_grants g
 join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
 join identity.roles r on r.id=m.role_id
 join identity.role_permissions rp on rp.role_id=m.role_id and rp.effect='allow'
 join identity.permissions p on p.id=rp.permission_id and p.code=p_permission
 where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
  and m.starts_at<=statement_timestamp() and(m.ends_at is null or m.ends_at>statement_timestamp())
  and g.starts_at<=statement_timestamp() and(g.ends_at is null or g.ends_at>statement_timestamp())
  and(p_property_id is null or g.scope_type='tenant' or g.property_id=p_property_id
    or(g.building_id is not null and exists(select 1 from portfolio.buildings b where b.id=g.building_id and b.property_id=p_property_id))
    or(g.unit_id is not null and exists(select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=g.unit_id and b.property_id=p_property_id)))
 limit 1;
 if not found then raise exception 'airprop_access_denied' using errcode='42501';end if;
end$$;
revoke all on function app_private.require_airprop_context_v1(uuid,text,uuid) from public,anon,authenticated,service_role;

create or replace function app_private.create_airprop_opportunity_internal_v1(p_context_id uuid,p_idempotency_key text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,airprop,portfolio,audit,extensions
as $$
declare a record;o airprop.investment_opportunities%rowtype;v_hash text;v_property uuid;
begin
 select * into a from app_private.require_airprop_context_v1(p_context_id,'airprop.opportunity.manage');
 if p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'invalid_idempotency_key' using errcode='22023';end if;
 if jsonb_typeof(p_payload)<>'object' or nullif(trim(p_payload->>'name'),'') is null or upper(coalesce(p_payload->>'country_code',''))<>'RO'
   or nullif(trim(p_payload->>'city'),'') is null or upper(coalesce(p_payload->>'currency','')) not in('RON','EUR')
   or coalesce((p_payload->>'asking_price')::numeric,0)<=0 then raise exception 'airprop_invalid_opportunity' using errcode='22023';end if;
 v_property=nullif(p_payload->>'property_id','')::uuid;
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
declare a record;o airprop.investment_opportunities%rowtype;c airprop.underwriting_cases%rowtype;v airprop.underwriting_versions%rowtype;
 cost numeric;rent numeric;opex numeric;noi numeric;v_hash text;next_version integer;
begin
 select * into o from airprop.investment_opportunities where id=p_opportunity_id;
 if not found then raise exception 'airprop_opportunity_not_found' using errcode='P0002';end if;
 select * into a from app_private.require_airprop_context_v1(p_context_id,'airprop.underwriting.manage',o.property_id);
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
 select * into a from app_private.require_airprop_context_v1(p_context_id,'airprop.asset.manage',p_property_id);
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

revoke all on function app_private.create_airprop_opportunity_internal_v1(uuid,text,jsonb),app_private.add_airprop_underwriting_version_internal_v1(uuid,uuid,jsonb),app_private.configure_airprop_property_internal_v1(uuid,uuid,uuid,airprop.interest_kind,numeric,airprop.operating_model_kind,date,text,text) from public,anon,service_role;
grant execute on function app_private.create_airprop_opportunity_internal_v1(uuid,text,jsonb),app_private.add_airprop_underwriting_version_internal_v1(uuid,uuid,jsonb),app_private.configure_airprop_property_internal_v1(uuid,uuid,uuid,airprop.interest_kind,numeric,airprop.operating_model_kind,date,text,text) to authenticated;

create function customer_api.create_airprop_opportunity_v1(p_context_id uuid,p_idempotency_key text,p_payload jsonb)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.create_airprop_opportunity_internal_v1(p_context_id,p_idempotency_key,p_payload)$$;
create function customer_api.add_airprop_underwriting_version_v1(p_context_id uuid,p_opportunity_id uuid,p_assumptions jsonb)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.add_airprop_underwriting_version_internal_v1(p_context_id,p_opportunity_id,p_assumptions)$$;
create function customer_api.configure_airprop_property_v1(p_context_id uuid,p_property_id uuid,p_party_id uuid,p_interest_kind airprop.interest_kind,p_share numeric,p_model airprop.operating_model_kind,p_valid_from date,p_country_pack_code text default 'AIRPROP-RO',p_country_pack_version text default '1.0')
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.configure_airprop_property_internal_v1(p_context_id,p_property_id,p_party_id,p_interest_kind,p_share,p_model,p_valid_from,p_country_pack_code,p_country_pack_version)$$;

revoke all on function customer_api.create_airprop_opportunity_v1(uuid,text,jsonb),customer_api.add_airprop_underwriting_version_v1(uuid,uuid,jsonb),customer_api.configure_airprop_property_v1(uuid,uuid,uuid,airprop.interest_kind,numeric,airprop.operating_model_kind,date,text,text) from public,anon;
grant execute on function customer_api.create_airprop_opportunity_v1(uuid,text,jsonb),customer_api.add_airprop_underwriting_version_v1(uuid,uuid,jsonb),customer_api.configure_airprop_property_v1(uuid,uuid,uuid,airprop.interest_kind,numeric,airprop.operating_model_kind,date,text,text) to authenticated;

revoke all on function airprop.enforce_core_integrity_v1(),airprop.protect_underwriting_version_v1() from public,anon,authenticated,service_role;

commit;
