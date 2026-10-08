begin;

alter table airprop.market_listings
 add column version integer not null default 1 check(version>0),
 add column updated_by uuid references auth.users(id) on delete restrict,
 add column updated_at timestamptz,
 add column withdrawn_reason text check(withdrawn_reason is null or length(btrim(withdrawn_reason)) between 8 and 500);

create table airprop.market_listing_revisions(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 listing_id uuid not null references airprop.market_listings(id) on delete restrict,
 listing_version integer not null check(listing_version>1),
 action text not null check(action in('edit','withdraw','republish')),
 before_snapshot jsonb not null check(jsonb_typeof(before_snapshot)='object'),
 after_snapshot jsonb not null check(jsonb_typeof(after_snapshot)='object'),
 reason text not null check(length(btrim(reason)) between 8 and 500),
 changed_by uuid not null references auth.users(id) on delete restrict,
 changed_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null,
 unique(tenant_id,workspace_id,idempotency_key),
 unique(listing_id,listing_version)
);
create index airprop_market_listing_revisions_listing_idx
 on airprop.market_listing_revisions(listing_id,listing_version desc);

alter table airprop.market_listing_revisions enable row level security;
revoke all on airprop.market_listing_revisions from public,anon,authenticated,service_role;

create function customer_api.control_airprop_listing_v1(
 p_context_id uuid,p_workspace_id uuid,p_listing_id uuid,p_action text,p_expected_version integer,
 p_available_from timestamptz,p_available_until timestamptz,p_reason text,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
 v_actor record;
 v_listing airprop.market_listings%rowtype;
 v_existing airprop.market_listing_revisions%rowtype;
 v_before jsonb;
 v_after jsonb;
 v_hash text;
 v_next_status text;
begin
 if p_action not in('edit','withdraw','republish') or p_expected_version is null or p_expected_version<1
  or length(btrim(coalesce(p_reason,''))) not between 8 and 500
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  or (p_action in('edit','republish') and (p_available_from is null or (p_available_until is not null and p_available_until<=p_available_from)))
  or (p_action='withdraw' and (p_available_from is not null or p_available_until is not null)) then
  raise exception 'airprop_listing_control_invalid' using errcode='22023';
 end if;

 select * into v_listing from airprop.market_listings where id=p_listing_id for update;
 if v_listing.id is null then raise exception 'airprop_listing_control_invalid' using errcode='22023';end if;
 select * into v_actor from app_private.require_airprop_commercial_property_v1(
  p_context_id,p_workspace_id,v_listing.property_id,'airprop.opportunity.manage');
 if v_listing.workspace_id<>p_workspace_id or v_listing.tenant_id<>v_actor.tenant_id then
  raise exception 'airprop_listing_control_access_denied' using errcode='42501';end if;

 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'listing',p_listing_id,
  'action',p_action,'expected_version',p_expected_version,'from',p_available_from,'until',p_available_until,
  'reason',btrim(p_reason))::text,'UTF8')),'hex');
 select * into v_existing from airprop.market_listing_revisions where tenant_id=v_actor.tenant_id
  and workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.changed_by is distinct from auth.uid() or v_existing.request_hash<>v_hash then
   raise exception 'airprop_listing_control_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'listing_id',v_existing.listing_id,
   'listing_version',v_existing.listing_version,'status',v_existing.after_snapshot->>'status','idempotent',true);
 end if;

 if v_listing.version<>p_expected_version then
  raise exception 'airprop_listing_version_conflict' using errcode='23505';end if;
 if p_action='edit' and v_listing.status<>'published' then
  raise exception 'airprop_listing_edit_state_invalid' using errcode='22023';
 elsif p_action='withdraw' and v_listing.status<>'published' then
  raise exception 'airprop_listing_withdraw_state_invalid' using errcode='22023';
 elsif p_action='republish' and v_listing.status<>'withdrawn' then
  raise exception 'airprop_listing_republish_state_invalid' using errcode='22023';
 end if;
 if p_action in('withdraw','republish') and exists(
  select 1 from airprop.exclusive_reservations r where r.listing_id=p_listing_id and r.status='active'
   and r.reserved_until>statement_timestamp()) then
  raise exception 'airprop_listing_active_reservation' using errcode='23505';end if;

 v_before=jsonb_build_object('version',v_listing.version,'status',v_listing.status,
  'available_from',v_listing.available_from,'available_until',v_listing.available_until,
  'withdrawn_reason',v_listing.withdrawn_reason);
 v_next_status=case when p_action='withdraw' then 'withdrawn' else 'published' end;
 update airprop.market_listings set
  status=v_next_status,
  available_from=case when p_action='withdraw' then available_from else p_available_from end,
  available_until=case when p_action='withdraw' then available_until else p_available_until end,
  withdrawn_reason=case when p_action='withdraw' then btrim(p_reason) else null end,
  version=version+1,updated_by=auth.uid(),updated_at=statement_timestamp()
 where id=p_listing_id returning * into v_listing;
 v_after=jsonb_build_object('version',v_listing.version,'status',v_listing.status,
  'available_from',v_listing.available_from,'available_until',v_listing.available_until,
  'withdrawn_reason',v_listing.withdrawn_reason);
 insert into airprop.market_listing_revisions(tenant_id,workspace_id,listing_id,listing_version,action,
  before_snapshot,after_snapshot,reason,changed_by,idempotency_key,request_hash)
 values(v_actor.tenant_id,p_workspace_id,p_listing_id,v_listing.version,p_action,
  v_before,v_after,btrim(p_reason),auth.uid(),p_idempotency_key,v_hash);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,before_snapshot,after_snapshot,reason)
 values(v_actor.tenant_id,auth.uid(),v_actor.role_code,'AIRPROP_LISTING_'||upper(p_action),
  'airprop.market_listing',p_listing_id,v_before,v_after,btrim(p_reason));
 return jsonb_build_object('version',1,'listing_id',p_listing_id,'listing_version',v_listing.version,
  'status',v_listing.status,'idempotent',false);
end;$$;

revoke all on function customer_api.control_airprop_listing_v1(
 uuid,uuid,uuid,text,integer,timestamptz,timestamptz,text,text) from public,anon,service_role;
grant execute on function customer_api.control_airprop_listing_v1(
 uuid,uuid,uuid,text,integer,timestamptz,timestamptz,text,text) to authenticated;

commit;
