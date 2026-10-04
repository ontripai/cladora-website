begin;
create function maintenance.can_read_context_target_v1(
 p_context_id uuid,p_permission text,p_tenant_id uuid,p_property_id uuid,p_building_id uuid,p_unit_id uuid
) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;
begin
 -- A bounded authorization predicate, never a privileged data reader.
 if p_permission is null or p_permission not in ('maintenance.requests.read','maintenance.work_orders.read') then return false; end if;
 select * into v from maintenance.verify_customer_maintenance_actor(
   p_context_id,p_permission,p_permission='maintenance.requests.read');
 if p_tenant_id is distinct from v.tenant_id then return false; end if;
 if not coalesce(maintenance.customer_maintenance_scope_matches(v.scope_type::text,
   v.property_id,v.building_id,v.unit_id,p_property_id,p_building_id,p_unit_id),false) then return false; end if;
 return coalesce(app_private.check_effective_permission_v1(p_context_id,p_permission,'maintenance',
   case when p_unit_id is not null then 'unit' when p_building_id is not null then 'building' else 'property' end,
   coalesce(p_unit_id,p_building_id,p_property_id)),false);
exception when insufficient_privilege then return false;
end $$;
revoke all on function maintenance.can_read_context_target_v1(uuid,text,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function maintenance.can_read_context_target_v1(uuid,text,uuid,uuid,uuid,uuid) to authenticated,service_role,cladora_rpc_owner;
comment on function maintenance.can_read_context_target_v1(uuid,text,uuid,uuid,uuid,uuid) is
 'Boolean authorization only: verifies caller-owned live context, legacy read permission, exact physical scope and canonical installed-module authority. Cannot read domain rows or expose private permission metadata.';


-- Domain tables stay closed to authenticated. Reuse the existing non-login,
-- non-superuser, non-BYPASSRLS reader role and add only two missing SELECTs.
grant select on maintenance.tickets,maintenance.vendor_payables to cladora_rpc_owner;
grant execute on function maintenance.verify_customer_maintenance_actor(uuid,text,boolean) to cladora_rpc_owner;
create policy maintenance_reader_tickets on maintenance.tickets for select to cladora_rpc_owner
 using(maintenance.can_read_context_target_v1(
 nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,'maintenance.requests.read',tenant_id,property_id,building_id,unit_id));
create policy maintenance_reader_orders on maintenance.work_orders for select to cladora_rpc_owner
 using(maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.requests.read',tenant_id,property_id,building_id,unit_id)
 or maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.work_orders.read',tenant_id,property_id,building_id,unit_id));
create policy maintenance_reader_payables on maintenance.vendor_payables for select to cladora_rpc_owner
 using(exists(select 1 from maintenance.work_orders w
 where w.id=work_order_id and w.tenant_id=vendor_payables.tenant_id));
-- Metadata projections stay subject to the same verified context. A unit may
-- see its own parent building, never siblings or a different property.
create policy maintenance_reader_buildings on portfolio.buildings for select to cladora_rpc_owner
 using(case when nullif(current_setting('cladora.maintenance_read_context_id',true),'') is null then false else
 exists(select 1 from maintenance.verify_customer_maintenance_actor(
 nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,null,true) v
 where buildings.tenant_id=v.tenant_id and (
 maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.requests.read',buildings.tenant_id,buildings.property_id,buildings.id,
 case when v.scope_type='unit' and v.building_id=buildings.id then v.unit_id else null end)
 or maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.work_orders.read',buildings.tenant_id,buildings.property_id,buildings.id,
 case when v.scope_type='unit' and v.building_id=buildings.id then v.unit_id else null end))) end);
create policy maintenance_reader_units on portfolio.units for select to cladora_rpc_owner
 using(exists(select 1 from portfolio.buildings b where b.id=units.building_id and b.tenant_id=units.tenant_id and (
 maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.requests.read',units.tenant_id,b.property_id,b.id,units.id)
 or maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.work_orders.read',units.tenant_id,b.property_id,b.id,units.id))));

create function maintenance.read_scoped_maintenance_v1(
 p_context_id uuid,p_view text,p_status text default null,p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; result jsonb; res jsonb; v_previous_context text;
begin
 v_previous_context:=current_setting('cladora.maintenance_read_context_id',true);
 if p_view not in ('requests','work_orders','summary') or p_view is null then raise exception 'invalid_query' using errcode='22023'; end if;
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,
 case when p_view='work_orders' then 'maintenance.work_orders.read' else 'maintenance.requests.read' end,p_view<>'work_orders');
 -- This GUC carries a verified scope, never changes JWT identity/claims, and is
 -- restored on every normal/error path. Only the non-login reader role uses it.
 perform set_config('cladora.maintenance_read_context_id',p_context_id::text,true);
  if p_view='requests' then

  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.requests.read', true);

  select jsonb_agg(row_to_json(r)::jsonb)
  into result
  from (
    select
      t.id, t.ticket_no, t.title, t.description, t.category, t.priority, t.status,
      t.severity, t.safety_impact, t.sla_target_at, t.reported_at, t.created_at,
      t.assigned_vendor_id, vnd.party_id as vendor_party_id,
      p.name as property_name, b.name as building_name, u.code as unit_code,
      case
        when t.status in ('resolved', 'closed', 'cancelled') then 'achieved'
        when statement_timestamp() > t.sla_target_at then 'breached'
        when statement_timestamp() > (t.sla_target_at - interval '12 hours') then 'at_risk'
        else 'on_track'
      end as sla_status
    from maintenance.tickets t
    join portfolio.properties p on p.id = t.property_id
    left join portfolio.buildings b on b.id = t.building_id
    left join portfolio.units u on u.id = t.unit_id
    left join maintenance.vendors vnd on vnd.id = t.assigned_vendor_id and vnd.tenant_id = t.tenant_id
    where t.tenant_id = v.tenant_id
      and (p_status is null or t.status::text = p_status)
      and maintenance.can_read_context_target_v1(p_context_id,'maintenance.requests.read',t.tenant_id,t.property_id,t.building_id,t.unit_id)
    order by t.created_at desc
    limit coalesce(p_limit, 50) offset coalesce(p_offset, 0)
  ) r;

  result:=coalesce(result, '[]'::jsonb);
  elsif p_view='work_orders' then

  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.read', false);

  select jsonb_agg(row_to_json(r)::jsonb)
  into result
  from (
    select
      w.id, w.work_order_no, w.title, w.description, w.priority, w.status,
      w.scheduled_start, w.scheduled_end, w.started_at, w.completed_at, w.verified_at,
      w.approved_budget, w.estimated_cost, w.actual_cost, w.currency,
      w.vendor_id, vnd.party_id as vendor_party_id,
      vp.id as payable_id, vp.payable_no, vp.status as payable_status, vp.journal_id
    from maintenance.work_orders w
    left join maintenance.vendors vnd on vnd.id = w.vendor_id and vnd.tenant_id = w.tenant_id
    left join maintenance.vendor_payables vp on vp.work_order_id = w.id and vp.tenant_id = w.tenant_id
    where w.tenant_id = v.tenant_id
      and (p_status is null or w.status::text = p_status)
      and maintenance.can_read_context_target_v1(p_context_id,'maintenance.work_orders.read',w.tenant_id,w.property_id,w.building_id,w.unit_id)
    order by w.created_at desc
    limit coalesce(p_limit, 50) offset coalesce(p_offset, 0)
  ) r;

  result:=coalesce(result, '[]'::jsonb);
  elsif p_view='summary' then

  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.requests.read', true);

  select jsonb_build_object(
    'total_requests', count(*),
    'open_requests', count(*) filter (where t.status = 'open'),
    'in_progress_requests', count(*) filter (where t.status = 'in_progress'),
    'emergency_requests', count(*) filter (where t.priority = 'emergency' and t.status not in ('closed', 'cancelled')),
    'sla_at_risk', count(*) filter (where t.status not in ('closed', 'cancelled', 'resolved') and statement_timestamp() > (t.sla_target_at - interval '12 hours') and statement_timestamp() <= t.sla_target_at),
    'sla_breached', count(*) filter (where t.status not in ('closed', 'cancelled', 'resolved') and statement_timestamp() > t.sla_target_at),
    'open_work_orders', (
      select count(*) from maintenance.work_orders w
      where w.tenant_id = v.tenant_id and w.status in ('draft', 'scheduled', 'assigned', 'in_progress', 'blocked')
        and maintenance.can_read_context_target_v1(p_context_id,'maintenance.requests.read',w.tenant_id,w.property_id,w.building_id,w.unit_id)
    ),
    'total_payables_count', (
      select count(*) from maintenance.vendor_payables vp
      join maintenance.work_orders pw on pw.id=vp.work_order_id and pw.tenant_id=vp.tenant_id
      where vp.tenant_id = v.tenant_id
        and maintenance.can_read_context_target_v1(p_context_id,'maintenance.requests.read',pw.tenant_id,pw.property_id,pw.building_id,pw.unit_id)
    ),
    'total_payables_amount', (
      select coalesce(sum(vp.total_amount), 0) from maintenance.vendor_payables vp
      join maintenance.work_orders pw on pw.id=vp.work_order_id and pw.tenant_id=vp.tenant_id
      where vp.tenant_id = v.tenant_id
        and maintenance.can_read_context_target_v1(p_context_id,'maintenance.requests.read',pw.tenant_id,pw.property_id,pw.building_id,pw.unit_id)
    )
  )
  into res
  from maintenance.tickets t
  where t.tenant_id = v.tenant_id
    and maintenance.can_read_context_target_v1(p_context_id,'maintenance.requests.read',t.tenant_id,t.property_id,t.building_id,t.unit_id);

  result:=coalesce(res, '{}'::jsonb);
  else raise exception 'invalid_query' using errcode='22023'; end if;
 perform set_config('cladora.maintenance_read_context_id',coalesce(v_previous_context,''),true);
 return result;
exception when others then
 perform set_config('cladora.maintenance_read_context_id',coalesce(v_previous_context,''),true);
 raise;
end $$;
grant create on schema maintenance to cladora_rpc_owner;
alter function maintenance.read_scoped_maintenance_v1(uuid,text,text,integer,integer) owner to cladora_rpc_owner;
revoke create on schema maintenance from cladora_rpc_owner;
revoke all on function maintenance.read_scoped_maintenance_v1(uuid,text,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function maintenance.read_scoped_maintenance_v1(uuid,text,text,integer,integer) to authenticated,service_role;
comment on function maintenance.read_scoped_maintenance_v1(uuid,text,text,integer,integer) is
 'Bounded read model owned by non-login non-BYPASSRLS role. RLS and row predicates enforce verified explicit RPC context and canonical permission, without requiring custom JWT scope claims. No domain-table grants to authenticated.';
create or replace function customer_api.list_maintenance_requests_v1(
  p_context_id uuid,
  p_status text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  return maintenance.read_scoped_maintenance_v1(p_context_id,'requests',p_status,p_limit,p_offset);
end;
$$;

create or replace function customer_api.list_work_orders_v1(
  p_context_id uuid,
  p_status text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  return maintenance.read_scoped_maintenance_v1(p_context_id,'work_orders',p_status,p_limit,p_offset);
end;
$$;

create or replace function customer_api.get_maintenance_summary_v1(
  p_context_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  return maintenance.read_scoped_maintenance_v1(p_context_id,'summary');
end;
$$;
commit;
