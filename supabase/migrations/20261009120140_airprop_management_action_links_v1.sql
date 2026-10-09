begin;

-- AP07-OPS-01 is an immutable AIRPROP reference to an Operations-owned work
-- order. It creates no work order, service request/order, outbox or Finance row.
create table airprop.management_action_links(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 mandate_request_id uuid not null references airprop.management_mandate_requests(id) on delete restrict,
 property_id uuid not null references portfolio.properties(id) on delete restrict,
 unit_id uuid references portfolio.units(id) on delete restrict,
 core_record_type text not null check(core_record_type='maintenance.work_order'),
 core_record_id uuid not null references maintenance.work_orders(id) on delete restrict,
 source_status_snapshot text not null check(source_status_snapshot in(
  'scheduled','assigned','in_progress','blocked','completed','verified')),
 linked_by uuid not null references auth.users(id) on delete restrict,
 linked_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),
 unique(tenant_id,workspace_id,idempotency_key),
 unique(core_record_type,core_record_id)
);
create index management_action_link_mandate_idx
 on airprop.management_action_links(mandate_request_id,linked_at desc);
create index management_action_link_property_idx
 on airprop.management_action_links(tenant_id,workspace_id,property_id,linked_at desc);

alter table airprop.management_action_links enable row level security;
revoke all on airprop.management_action_links from public,anon,authenticated,service_role;

create function app_private.guard_airprop_management_action_link_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 raise exception 'airprop_management_action_link_immutable' using errcode='42501';
end;$$;
create trigger immutable_airprop_management_action_link
before update or delete on airprop.management_action_links
for each row execute function app_private.guard_airprop_management_action_link_v1();
revoke all on function app_private.guard_airprop_management_action_link_v1()
 from public,anon,authenticated,service_role;

create function customer_api.link_airprop_management_work_order_v1(
 p_context_id uuid,p_workspace_id uuid,p_mandate_request_id uuid,
 p_work_order_id uuid,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor record;v_mandate airprop.management_mandate_requests%rowtype;
 v_work maintenance.work_orders%rowtype;v_existing airprop.management_action_links%rowtype;
 v_row airprop.management_action_links%rowtype;v_hash text;
begin
 if p_mandate_request_id is null or p_work_order_id is null
  or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'airprop_management_action_invalid' using errcode='22023';end if;
 select * into v_mandate from airprop.management_mandate_requests where id=p_mandate_request_id;
 if v_mandate.id is null or v_mandate.workspace_id<>p_workspace_id then
  raise exception 'airprop_management_action_invalid' using errcode='22023';end if;
 select * into v_actor from app_private.require_airprop_mandate_context_v1(
  p_context_id,p_workspace_id,v_mandate.property_id);
 if v_mandate.tenant_id<>v_actor.tenant_id or v_mandate.status<>'accepted'
  or current_date<v_mandate.valid_from or current_date>=v_mandate.valid_to then
  raise exception 'airprop_management_action_access_denied' using errcode='42501';end if;
 if app_private.current_workspace_property_mandate_v1(
  p_context_id,p_workspace_id,v_mandate.property_id,'property_operations') is null then
  raise exception 'airprop_management_action_access_denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('airprop:management-action:'||p_work_order_id::text,0));
 select * into v_work from maintenance.work_orders where id=p_work_order_id for share;
 if v_work.id is null or v_work.tenant_id<>v_actor.tenant_id
  or v_work.property_id<>v_mandate.property_id
  or v_work.status::text not in('scheduled','assigned','in_progress','blocked','completed','verified') then
  raise exception 'airprop_management_action_core_mismatch' using errcode='22023';end if;
 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'workspace',p_workspace_id,
  'mandate',p_mandate_request_id,'work_order',p_work_order_id)::text,'UTF8')),'hex');
 select * into v_existing from airprop.management_action_links where tenant_id=v_actor.tenant_id
  and workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.linked_by is distinct from auth.uid() or v_existing.request_hash<>v_hash then
   raise exception 'airprop_management_action_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'action_link_id',v_existing.id,
   'source_status',v_existing.source_status_snapshot,'idempotent',true);
 end if;
 begin
  insert into airprop.management_action_links(
   tenant_id,workspace_id,mandate_request_id,property_id,unit_id,core_record_type,core_record_id,
   source_status_snapshot,linked_by,idempotency_key,request_hash)
  values(v_actor.tenant_id,p_workspace_id,v_mandate.id,v_mandate.property_id,v_work.unit_id,
   'maintenance.work_order',v_work.id,v_work.status::text,auth.uid(),p_idempotency_key,v_hash)
  returning * into v_row;
 exception when unique_violation then
  raise exception 'airprop_management_action_conflict' using errcode='23505';
 end;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(v_actor.tenant_id,auth.uid(),v_actor.role_code,'AIRPROP_MANAGEMENT_WORK_ORDER_LINKED',
  'airprop.management_action_link',v_row.id,
  jsonb_build_object('mandate_request_id',v_row.mandate_request_id,'property_id',v_row.property_id,
   'unit_id',v_row.unit_id,'core_record_type',v_row.core_record_type,
   'core_record_id',v_row.core_record_id,'source_status',v_row.source_status_snapshot),
  'Reference to Operations-owned work order; no order, outbox or financial effect');
 return jsonb_build_object('version',1,'action_link_id',v_row.id,
  'source_status',v_row.source_status_snapshot,'idempotent',false);
end;$$;

revoke all on function customer_api.link_airprop_management_work_order_v1(uuid,uuid,uuid,uuid,text)
 from public,anon,service_role;
grant execute on function customer_api.link_airprop_management_work_order_v1(uuid,uuid,uuid,uuid,text)
 to authenticated;

commit;
