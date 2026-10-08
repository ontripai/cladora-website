begin;

alter table airprop.exclusive_reservations
 add column version integer not null default 1 check(version>0),
 add column updated_by uuid references auth.users(id) on delete restrict,
 add column updated_at timestamptz,
 add column conversion_kind text check(conversion_kind is null or conversion_kind in('presale','resale','lease')),
 add column conversion_reference text check(conversion_reference is null or length(btrim(conversion_reference)) between 8 and 500);

alter table airprop.exclusive_reservations
 add constraint airprop_reservation_conversion_shape check(
  (status='converted' and conversion_kind is not null and conversion_reference is not null)
  or (status<>'converted' and conversion_kind is null and conversion_reference is null)
 );

create table airprop.reservation_revisions(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 reservation_id uuid not null references airprop.exclusive_reservations(id) on delete restrict,
 reservation_version integer not null check(reservation_version>1),
 action text not null check(action in('cancel','expire','extend','convert')),
 before_snapshot jsonb not null check(jsonb_typeof(before_snapshot)='object'),
 after_snapshot jsonb not null check(jsonb_typeof(after_snapshot)='object'),
 reason text not null check(length(btrim(reason)) between 8 and 500),
 changed_by uuid not null references auth.users(id) on delete restrict,
 changed_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null,
 unique(tenant_id,workspace_id,idempotency_key),
 unique(reservation_id,reservation_version)
);
create index airprop_reservation_revisions_reservation_idx
 on airprop.reservation_revisions(reservation_id,reservation_version desc);

alter table airprop.reservation_revisions enable row level security;
revoke all on airprop.reservation_revisions from public,anon,authenticated,service_role;

create function customer_api.control_airprop_reservation_v1(
 p_context_id uuid,p_workspace_id uuid,p_reservation_id uuid,p_action text,p_expected_version integer,
 p_reserved_until timestamptz,p_conversion_reference text,p_reason text,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
 v_actor record;
 v_reservation airprop.exclusive_reservations%rowtype;
 v_listing airprop.market_listings%rowtype;
 v_existing airprop.reservation_revisions%rowtype;
 v_before jsonb;
 v_after jsonb;
 v_hash text;
 v_now timestamptz:=statement_timestamp();
 v_listing_status text;
begin
 if p_action not in('cancel','expire','extend','convert') or p_expected_version is null or p_expected_version<1
  or length(btrim(coalesce(p_reason,''))) not between 8 and 500
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  or (p_action='extend' and p_reserved_until is null)
  or (p_action<>'extend' and p_reserved_until is not null)
  or (p_action='convert' and length(btrim(coalesce(p_conversion_reference,''))) not between 8 and 500)
  or (p_action<>'convert' and p_conversion_reference is not null) then
  raise exception 'airprop_reservation_control_invalid' using errcode='22023';
 end if;

 select * into v_reservation from airprop.exclusive_reservations where id=p_reservation_id for update;
 if v_reservation.id is null then raise exception 'airprop_reservation_control_invalid' using errcode='22023';end if;
 select * into v_listing from airprop.market_listings where id=v_reservation.listing_id for update;
 if v_listing.id is null then raise exception 'airprop_reservation_control_invalid' using errcode='22023';end if;
 select * into v_actor from app_private.require_airprop_commercial_property_v1(
  p_context_id,p_workspace_id,v_listing.property_id,'airprop.opportunity.manage');
 if v_reservation.workspace_id<>p_workspace_id or v_reservation.tenant_id<>v_actor.tenant_id
  or v_listing.workspace_id<>p_workspace_id or v_listing.tenant_id<>v_actor.tenant_id then
  raise exception 'airprop_reservation_control_access_denied' using errcode='42501';end if;

 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'reservation',p_reservation_id,
  'action',p_action,'expected_version',p_expected_version,'reserved_until',p_reserved_until,
  'conversion_reference',p_conversion_reference,'reason',btrim(p_reason))::text,'UTF8')),'hex');
 select * into v_existing from airprop.reservation_revisions where tenant_id=v_actor.tenant_id
  and workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.changed_by is distinct from auth.uid() or v_existing.request_hash<>v_hash then
   raise exception 'airprop_reservation_control_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'reservation_id',v_existing.reservation_id,
   'reservation_version',v_existing.reservation_version,'status',v_existing.after_snapshot->>'status',
   'reserved_until',v_existing.after_snapshot->>'reserved_until','idempotent',true);
 end if;

 if v_reservation.version<>p_expected_version then
  raise exception 'airprop_reservation_version_conflict' using errcode='23505';end if;
 if v_reservation.status<>'active' or v_listing.status<>'reserved' then
  raise exception 'airprop_reservation_state_invalid' using errcode='22023';end if;
 if p_action in('cancel','extend','convert') and v_reservation.reserved_until<=v_now then
  raise exception 'airprop_reservation_expired' using errcode='22023';end if;
 if p_action='expire' and v_reservation.reserved_until>v_now then
  raise exception 'airprop_reservation_not_expired' using errcode='22023';end if;
 if p_action='extend' and (p_reserved_until<=v_reservation.reserved_until
  or (v_listing.available_until is not null and p_reserved_until>v_listing.available_until)) then
  raise exception 'airprop_reservation_extension_invalid' using errcode='22023';end if;

 v_before=jsonb_build_object('version',v_reservation.version,'status',v_reservation.status,
  'reserved_until',v_reservation.reserved_until,'ended_at',v_reservation.ended_at,
  'ended_reason',v_reservation.ended_reason,'conversion_kind',v_reservation.conversion_kind,
  'conversion_reference',v_reservation.conversion_reference);
 update airprop.exclusive_reservations set
  status=case p_action when 'cancel' then 'cancelled' when 'expire' then 'expired'
   when 'convert' then 'converted' else status end,
  reserved_until=case when p_action='extend' then p_reserved_until else reserved_until end,
  ended_at=case when p_action in('cancel','expire','convert') then v_now else null end,
  ended_reason=case when p_action in('cancel','expire','convert') then p_action else null end,
  conversion_kind=case when p_action='convert' then v_listing.kind else null end,
  conversion_reference=case when p_action='convert' then btrim(p_conversion_reference) else null end,
  version=version+1,updated_by=auth.uid(),updated_at=v_now
 where id=p_reservation_id returning * into v_reservation;

 if p_action='convert' then
  v_listing_status='completed';
  update airprop.applicants set status='rejected'
   where listing_id=v_listing.id and id<>v_reservation.applicant_id and status='active';
 else
  v_listing_status=case when v_listing.available_until is null or v_listing.available_until>v_now
   then 'published' else 'withdrawn' end;
  update airprop.applicants set status='active'
   where id=v_reservation.applicant_id and status='accepted';
 end if;
 update airprop.market_listings set status=v_listing_status,version=version+1,updated_by=auth.uid(),updated_at=v_now,
  withdrawn_reason=case when v_listing_status='withdrawn' then 'Reservation ended after listing availability.' else null end
 where id=v_listing.id;

 v_after=jsonb_build_object('version',v_reservation.version,'status',v_reservation.status,
  'reserved_until',v_reservation.reserved_until,'ended_at',v_reservation.ended_at,
  'ended_reason',v_reservation.ended_reason,'conversion_kind',v_reservation.conversion_kind,
  'conversion_reference',v_reservation.conversion_reference,'listing_status',v_listing_status);
 insert into airprop.reservation_revisions(tenant_id,workspace_id,reservation_id,reservation_version,action,
  before_snapshot,after_snapshot,reason,changed_by,idempotency_key,request_hash)
 values(v_actor.tenant_id,p_workspace_id,p_reservation_id,v_reservation.version,p_action,
  v_before,v_after,btrim(p_reason),auth.uid(),p_idempotency_key,v_hash);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,before_snapshot,after_snapshot,reason)
 values(v_actor.tenant_id,auth.uid(),v_actor.role_code,'AIRPROP_RESERVATION_'||upper(p_action),
  'airprop.exclusive_reservation',p_reservation_id,v_before,v_after,btrim(p_reason));
 return jsonb_build_object('version',1,'reservation_id',p_reservation_id,
  'reservation_version',v_reservation.version,'status',v_reservation.status,
  'reserved_until',v_reservation.reserved_until,'idempotent',false);
end;$$;

revoke all on function customer_api.control_airprop_reservation_v1(
 uuid,uuid,uuid,text,integer,timestamptz,text,text,text) from public,anon,service_role;
grant execute on function customer_api.control_airprop_reservation_v1(
 uuid,uuid,uuid,text,integer,timestamptz,text,text,text) to authenticated;

commit;
