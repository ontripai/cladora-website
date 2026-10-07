begin;

-- AIRPROP LC-A01..A03 commercial records. Canonical identity, title, lease,
-- document, payment and workspace authority stay in their existing owners.
create table airprop.market_listings(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 opportunity_id uuid not null references airprop.investment_opportunities(id) on delete restrict,
 property_id uuid not null references portfolio.properties(id) on delete restrict,
 unit_id uuid not null references portfolio.units(id) on delete restrict,
 kind text not null check(kind in('presale','resale','lease')),
 status text not null default 'published' check(status in('published','reserved','withdrawn','completed')),
 available_from timestamptz not null,
 available_until timestamptz,
 published_by uuid not null references auth.users(id) on delete restrict,
 published_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null,
 check(available_until is null or available_until>available_from),
 unique(tenant_id,workspace_id,idempotency_key),
 unique(id,tenant_id,workspace_id)
);
create index airprop_market_listings_subject_idx on airprop.market_listings(tenant_id,unit_id,status);
create index airprop_market_listings_property_idx on airprop.market_listings(property_id);
create index airprop_market_listings_opportunity_idx on airprop.market_listings(opportunity_id);

create table airprop.applicants(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 listing_id uuid not null references airprop.market_listings(id) on delete restrict,
 party_id uuid not null references portfolio.parties(id) on delete restrict,
 status text not null default 'active' check(status in('active','withdrawn','accepted','rejected')),
 submitted_by uuid not null references auth.users(id) on delete restrict,
 submitted_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null,
 unique(tenant_id,workspace_id,idempotency_key),
 unique(listing_id,party_id)
);
create index airprop_applicants_listing_idx on airprop.applicants(listing_id,status);
create index airprop_applicants_party_idx on airprop.applicants(party_id);

create table airprop.exclusive_reservations(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 listing_id uuid not null references airprop.market_listings(id) on delete restrict,
 applicant_id uuid not null references airprop.applicants(id) on delete restrict,
 unit_id uuid not null references portfolio.units(id) on delete restrict,
 status text not null default 'active' check(status in('active','cancelled','expired','converted')),
 reserved_from timestamptz not null,
 reserved_until timestamptz not null,
 ended_at timestamptz,
 ended_reason text,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null,
 check(reserved_until>reserved_from),
 check((status='active' and ended_at is null) or status<>'active'),
 unique(tenant_id,workspace_id,idempotency_key)
);
create index airprop_reservations_listing_idx on airprop.exclusive_reservations(listing_id,status);
create index airprop_reservations_applicant_idx on airprop.exclusive_reservations(applicant_id);
alter table airprop.exclusive_reservations add constraint airprop_one_exclusive_reservation
 exclude using gist(unit_id with =,tstzrange(reserved_from,reserved_until,'[)') with &&)
 where(status='active');

create table airprop.purchase_obligation_schedules(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 presale_contract_id uuid not null unique references airprop.presale_contracts(id) on delete restrict,
 currency text not null check(currency~'^[A-Z]{3}$'),
 total_amount numeric(20,4) not null check(total_amount>0),
 status text not null default 'recorded' check(status in('recorded','superseded','fulfilled')),
 terms jsonb not null check(jsonb_typeof(terms)='array' and jsonb_array_length(terms)>0),
 financial_source_reference text not null check(length(btrim(financial_source_reference)) between 8 and 500),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null,
 unique(tenant_id,workspace_id,idempotency_key)
);
create index airprop_obligation_schedules_workspace_idx on airprop.purchase_obligation_schedules(workspace_id,recorded_at desc);

create table airprop.commercial_execution_links(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 property_id uuid not null references portfolio.properties(id) on delete restrict,
 unit_id uuid references portfolio.units(id) on delete restrict,
 kind text not null check(kind in('resale','lease','management_mandate')),
 core_record_type text not null check(core_record_type in('portfolio.ownership_transfer','occupancy.lease_handover','platform.workspace_property_authority')),
 core_record_id uuid not null,
 commercial_terms jsonb not null check(jsonb_typeof(commercial_terms)='object'),
 effective_from date not null,
 effective_to date,
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null,
 check(effective_to is null or effective_to>effective_from),
 unique(tenant_id,workspace_id,idempotency_key),
 unique(kind,core_record_id)
);
create index airprop_execution_links_property_idx on airprop.commercial_execution_links(property_id,kind,effective_from);
create index airprop_execution_links_unit_idx on airprop.commercial_execution_links(unit_id) where unit_id is not null;

alter table airprop.market_listings enable row level security;
alter table airprop.applicants enable row level security;
alter table airprop.exclusive_reservations enable row level security;
alter table airprop.purchase_obligation_schedules enable row level security;
alter table airprop.commercial_execution_links enable row level security;
revoke all on airprop.market_listings,airprop.applicants,airprop.exclusive_reservations,
 airprop.purchase_obligation_schedules,airprop.commercial_execution_links
 from public,anon,authenticated,service_role;

create function app_private.require_airprop_commercial_property_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_permission text
) returns table(workspace_id uuid,tenant_id uuid,membership_id uuid,role_code text)
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor record;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 if p_property_id is null or p_permission not in('airprop.opportunity.manage','airprop.presale.execute','airprop.asset.manage')
  then raise exception 'airprop_commercial_subject_required' using errcode='22023';end if;
 select * into v_actor from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 if app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,p_permission,'airprop_commercial') is not true then
  raise exception 'airprop_commercial_access_denied' using errcode='42501';end if;
 if not exists(select 1 from portfolio.properties p where p.id=p_property_id and p.tenant_id=v_actor.tenant_id)
  or app_private.current_workspace_property_mandate_v1(p_context_id,p_workspace_id,p_property_id,'investment') is null then
  raise exception 'airprop_commercial_access_denied' using errcode='42501';end if;
 return query select v_actor.workspace_id,v_actor.tenant_id,v_actor.membership_id,v_actor.role_code;
end;$$;
revoke all on function app_private.require_airprop_commercial_property_v1(uuid,uuid,uuid,text)
 from public,anon,authenticated,service_role;

create function customer_api.publish_airprop_listing_v1(
 p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_property_id uuid,p_unit_id uuid,
 p_kind text,p_available_from timestamptz,p_available_until timestamptz,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor record;v_existing airprop.market_listings%rowtype;v_row airprop.market_listings%rowtype;v_hash text;
begin
 if p_kind not in('presale','resale','lease') or p_available_from is null
  or(p_available_until is not null and p_available_until<=p_available_from)
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'airprop_listing_invalid' using errcode='22023';end if;
 select * into v_actor from app_private.require_airprop_commercial_property_v1(
  p_context_id,p_workspace_id,p_property_id,'airprop.opportunity.manage');
 perform 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
  where u.id=p_unit_id and u.tenant_id=v_actor.tenant_id and b.property_id=p_property_id for share;
 if not found or not exists(select 1 from airprop.investment_opportunities o where o.id=p_opportunity_id
  and o.tenant_id=v_actor.tenant_id and o.workspace_id=p_workspace_id and o.property_id=p_property_id) then
  raise exception 'airprop_listing_subject_mismatch' using errcode='22023';end if;
 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'workspace',p_workspace_id,
  'opportunity',p_opportunity_id,'property',p_property_id,'unit',p_unit_id,'kind',p_kind,
  'from',p_available_from,'until',p_available_until)::text,'UTF8')),'hex');
 select * into v_existing from airprop.market_listings where tenant_id=v_actor.tenant_id
  and workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.published_by is distinct from auth.uid() or v_existing.request_hash<>v_hash then
   raise exception 'airprop_listing_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'listing_id',v_existing.id,'status',v_existing.status,'idempotent',true);
 end if;
 if exists(select 1 from airprop.market_listings where tenant_id=v_actor.tenant_id and unit_id=p_unit_id
  and kind=p_kind and status in('published','reserved')) then
  raise exception 'airprop_listing_conflict' using errcode='23505';end if;
 insert into airprop.market_listings(tenant_id,workspace_id,opportunity_id,property_id,unit_id,kind,
  available_from,available_until,published_by,idempotency_key,request_hash)
 values(v_actor.tenant_id,p_workspace_id,p_opportunity_id,p_property_id,p_unit_id,p_kind,
  p_available_from,p_available_until,auth.uid(),p_idempotency_key,v_hash) returning * into v_row;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(v_actor.tenant_id,auth.uid(),v_actor.role_code,'AIRPROP_LISTING_PUBLISHED','airprop.market_listing',v_row.id,
  jsonb_build_object('kind',v_row.kind,'status',v_row.status),'Authorized commercial listing');
 return jsonb_build_object('version',1,'listing_id',v_row.id,'status',v_row.status,'idempotent',false);
end;$$;

create function customer_api.submit_airprop_applicant_v1(
 p_context_id uuid,p_workspace_id uuid,p_listing_id uuid,p_party_id uuid,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_listing airprop.market_listings%rowtype;v_actor record;v_existing airprop.applicants%rowtype;v_row airprop.applicants%rowtype;v_hash text;
begin
 select * into v_listing from airprop.market_listings where id=p_listing_id for share;
 if v_listing.id is null or v_listing.status<>'published' or v_listing.available_from>statement_timestamp()
  or(v_listing.available_until is not null and v_listing.available_until<=statement_timestamp())
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'airprop_applicant_invalid' using errcode='22023';end if;
 select * into v_actor from app_private.require_airprop_commercial_property_v1(
  p_context_id,p_workspace_id,v_listing.property_id,'airprop.opportunity.manage');
 if v_listing.workspace_id<>p_workspace_id or v_listing.tenant_id<>v_actor.tenant_id
  or not exists(select 1 from portfolio.parties where id=p_party_id and tenant_id=v_actor.tenant_id) then
  raise exception 'airprop_applicant_subject_mismatch' using errcode='22023';end if;
 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'listing',p_listing_id,'party',p_party_id)::text,'UTF8')),'hex');
 select * into v_existing from airprop.applicants where tenant_id=v_actor.tenant_id and workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.submitted_by is distinct from auth.uid() or v_existing.request_hash<>v_hash then raise exception 'airprop_applicant_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'applicant_id',v_existing.id,'status',v_existing.status,'idempotent',true);end if;
 insert into airprop.applicants(tenant_id,workspace_id,listing_id,party_id,submitted_by,idempotency_key,request_hash)
 values(v_actor.tenant_id,p_workspace_id,p_listing_id,p_party_id,auth.uid(),p_idempotency_key,v_hash) returning * into v_row;
 return jsonb_build_object('version',1,'applicant_id',v_row.id,'status',v_row.status,'idempotent',false);
end;$$;

create function customer_api.reserve_airprop_listing_v1(
 p_context_id uuid,p_workspace_id uuid,p_listing_id uuid,p_applicant_id uuid,
 p_reserved_until timestamptz,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_listing airprop.market_listings%rowtype;v_applicant airprop.applicants%rowtype;v_actor record;
 v_existing airprop.exclusive_reservations%rowtype;v_row airprop.exclusive_reservations%rowtype;v_hash text;v_now timestamptz:=statement_timestamp();
begin
 perform 1 from airprop.market_listings where id=p_listing_id for update;
 select * into v_listing from airprop.market_listings where id=p_listing_id;
 select * into v_applicant from airprop.applicants where id=p_applicant_id for share;
 if v_listing.id is null or v_applicant.id is null or v_applicant.listing_id<>p_listing_id or v_applicant.status<>'active'
  or v_listing.status<>'published' or v_now<v_listing.available_from or p_reserved_until<=v_now
  or(v_listing.available_until is not null and p_reserved_until>v_listing.available_until)
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'airprop_reservation_invalid' using errcode='22023';end if;
 select * into v_actor from app_private.require_airprop_commercial_property_v1(
  p_context_id,p_workspace_id,v_listing.property_id,'airprop.opportunity.manage');
 if v_listing.workspace_id<>p_workspace_id or v_listing.tenant_id<>v_actor.tenant_id then raise exception 'airprop_reservation_access_denied' using errcode='42501';end if;
 update airprop.exclusive_reservations set status='expired',ended_at=v_now,ended_reason='expired'
  where unit_id=v_listing.unit_id and status='active' and reserved_until<=v_now;
 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'listing',p_listing_id,
  'applicant',p_applicant_id,'until',p_reserved_until)::text,'UTF8')),'hex');
 select * into v_existing from airprop.exclusive_reservations where tenant_id=v_actor.tenant_id
  and workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.created_by is distinct from auth.uid() or v_existing.request_hash<>v_hash then raise exception 'airprop_reservation_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'reservation_id',v_existing.id,'status',v_existing.status,'reserved_until',v_existing.reserved_until,'idempotent',true);end if;
 begin
  insert into airprop.exclusive_reservations(tenant_id,workspace_id,listing_id,applicant_id,unit_id,
   reserved_from,reserved_until,created_by,idempotency_key,request_hash)
  values(v_actor.tenant_id,p_workspace_id,p_listing_id,p_applicant_id,v_listing.unit_id,
   v_now,p_reserved_until,auth.uid(),p_idempotency_key,v_hash) returning * into v_row;
 exception when exclusion_violation then raise exception 'airprop_reservation_conflict' using errcode='23P01';end;
 update airprop.market_listings set status='reserved' where id=p_listing_id;
 update airprop.applicants set status='accepted' where id=p_applicant_id;
 return jsonb_build_object('version',1,'reservation_id',v_row.id,'status',v_row.status,'reserved_until',v_row.reserved_until,'idempotent',false);
end;$$;

create function customer_api.record_airprop_obligation_schedule_v1(
 p_context_id uuid,p_workspace_id uuid,p_presale_contract_id uuid,p_currency text,p_total_amount numeric,
 p_terms jsonb,p_financial_source_reference text,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_contract airprop.presale_contracts%rowtype;v_opp airprop.investment_opportunities%rowtype;v_actor record;
 v_existing airprop.purchase_obligation_schedules%rowtype;v_row airprop.purchase_obligation_schedules%rowtype;v_hash text;v_sum numeric;
begin
 select * into v_contract from airprop.presale_contracts where id=p_presale_contract_id for share;
 select * into v_opp from airprop.investment_opportunities where id=v_contract.opportunity_id for share;
 if v_contract.id is null or p_currency !~ '^[A-Z]{3}$' or p_total_amount<=0
  or jsonb_typeof(p_terms)<>'array' or jsonb_array_length(p_terms)=0
  or length(btrim(coalesce(p_financial_source_reference,''))) not between 8 and 500
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'airprop_obligation_invalid' using errcode='22023';end if;
 begin select sum((x->>'amount')::numeric) into v_sum from jsonb_array_elements(p_terms)x
  where x ? 'amount' and x ? 'due_on' and jsonb_typeof(x->'amount')='number';exception when others then raise exception 'airprop_obligation_invalid' using errcode='22023';end;
 if v_sum is distinct from p_total_amount then raise exception 'airprop_obligation_total_mismatch' using errcode='22023';end if;
 select * into v_actor from app_private.require_airprop_commercial_property_v1(p_context_id,p_workspace_id,v_opp.property_id,'airprop.presale.execute');
 if v_contract.workspace_id<>p_workspace_id or v_contract.tenant_id<>v_actor.tenant_id then raise exception 'airprop_obligation_access_denied' using errcode='42501';end if;
 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'contract',p_presale_contract_id,'currency',p_currency,
  'total',p_total_amount,'terms',p_terms,'source',btrim(p_financial_source_reference))::text,'UTF8')),'hex');
 select * into v_existing from airprop.purchase_obligation_schedules where tenant_id=v_actor.tenant_id and workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.recorded_by is distinct from auth.uid() or v_existing.request_hash<>v_hash then raise exception 'airprop_obligation_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'schedule_id',v_existing.id,'status',v_existing.status,'idempotent',true);end if;
 insert into airprop.purchase_obligation_schedules(tenant_id,workspace_id,presale_contract_id,currency,total_amount,terms,
  financial_source_reference,recorded_by,idempotency_key,request_hash)
 values(v_actor.tenant_id,p_workspace_id,p_presale_contract_id,p_currency,p_total_amount,p_terms,
  btrim(p_financial_source_reference),auth.uid(),p_idempotency_key,v_hash) returning * into v_row;
 return jsonb_build_object('version',1,'schedule_id',v_row.id,'status',v_row.status,'idempotent',false);
end;$$;

create function customer_api.link_airprop_commercial_execution_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_unit_id uuid,p_kind text,
 p_core_record_id uuid,p_commercial_terms jsonb,p_effective_from date,p_effective_to date,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor record;v_type text;v_existing airprop.commercial_execution_links%rowtype;v_row airprop.commercial_execution_links%rowtype;v_hash text;
begin
 if p_kind not in('resale','lease','management_mandate') or jsonb_typeof(p_commercial_terms)<>'object'
  or p_effective_from is null or(p_effective_to is not null and p_effective_to<=p_effective_from)
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'airprop_execution_link_invalid' using errcode='22023';end if;
 select * into v_actor from app_private.require_airprop_commercial_property_v1(p_context_id,p_workspace_id,p_property_id,'airprop.asset.manage');
 if p_kind='resale' then v_type='portfolio.ownership_transfer';
  if not exists(select 1 from portfolio.ownership_transfers where id=p_core_record_id and tenant_id=v_actor.tenant_id and property_id=p_property_id and unit_id=p_unit_id and effective_on=p_effective_from) then raise exception 'airprop_execution_link_core_mismatch' using errcode='22023';end if;
 elsif p_kind='lease' then v_type='occupancy.lease_handover';
  if not exists(select 1 from occupancy.lease_handover_receipts where id=p_core_record_id and tenant_id=v_actor.tenant_id and property_id=p_property_id and unit_id=p_unit_id and effective_on=p_effective_from) then raise exception 'airprop_execution_link_core_mismatch' using errcode='22023';end if;
 else v_type='platform.workspace_property_authority';
  if p_unit_id is not null or not exists(select 1 from platform.workspace_property_authorities where id=p_core_record_id
   and tenant_id=v_actor.tenant_id and property_id=p_property_id and customer_workspace_id=p_workspace_id
   and purpose='property_operations' and status='active' and valid_from<=p_effective_from::timestamptz
   and(valid_to is null or valid_to>p_effective_from::timestamptz)) then raise exception 'airprop_execution_link_core_mismatch' using errcode='22023';end if;
 end if;
 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'workspace',p_workspace_id,'property',p_property_id,
  'unit',p_unit_id,'kind',p_kind,'core',p_core_record_id,'terms',p_commercial_terms,'from',p_effective_from,'to',p_effective_to)::text,'UTF8')),'hex');
 select * into v_existing from airprop.commercial_execution_links where tenant_id=v_actor.tenant_id and workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.recorded_by is distinct from auth.uid() or v_existing.request_hash<>v_hash then raise exception 'airprop_execution_link_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'link_id',v_existing.id,'kind',v_existing.kind,'idempotent',true);end if;
 insert into airprop.commercial_execution_links(tenant_id,workspace_id,property_id,unit_id,kind,core_record_type,core_record_id,
  commercial_terms,effective_from,effective_to,recorded_by,idempotency_key,request_hash)
 values(v_actor.tenant_id,p_workspace_id,p_property_id,p_unit_id,p_kind,v_type,p_core_record_id,
  p_commercial_terms,p_effective_from,p_effective_to,auth.uid(),p_idempotency_key,v_hash) returning * into v_row;
 return jsonb_build_object('version',1,'link_id',v_row.id,'kind',v_row.kind,'idempotent',false);
end;$$;

revoke all on function customer_api.publish_airprop_listing_v1(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text),
 customer_api.submit_airprop_applicant_v1(uuid,uuid,uuid,uuid,text),
 customer_api.reserve_airprop_listing_v1(uuid,uuid,uuid,uuid,timestamptz,text),
 customer_api.record_airprop_obligation_schedule_v1(uuid,uuid,uuid,text,numeric,jsonb,text,text),
 customer_api.link_airprop_commercial_execution_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text)
 from public,anon,service_role;
grant execute on function customer_api.publish_airprop_listing_v1(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text),
 customer_api.submit_airprop_applicant_v1(uuid,uuid,uuid,uuid,text),
 customer_api.reserve_airprop_listing_v1(uuid,uuid,uuid,uuid,timestamptz,text),
 customer_api.record_airprop_obligation_schedule_v1(uuid,uuid,uuid,text,numeric,jsonb,text,text),
 customer_api.link_airprop_commercial_execution_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text)
 to authenticated;

commit;
