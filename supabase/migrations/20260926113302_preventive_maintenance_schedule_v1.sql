begin;

-- Calendar plans share the existing asset/work-order lifecycle. No approval or
-- payment is automated by this slice. Mutations require the installed module.
alter table maintenance.maintenance_plans
  add column vendor_id uuid references maintenance.vendors(id) on delete restrict,
  add column calendar_anchor date,
  add column calendar_unit text check (calendar_unit in ('days','weeks','months','years')),
  add column calendar_every integer check (calendar_every between 1 and 120),
  add column calendar_index integer not null default 0 check (calendar_index >= 0),
  add column calendar_enabled boolean not null default false,
  add column revision integer not null default 1;

create index maintenance_plans_vendor_idx on maintenance.maintenance_plans(vendor_id);

create table maintenance.plan_occurrences (
  plan_id uuid not null references maintenance.maintenance_plans(id) on delete restrict,
  due_on date not null,
  work_order_id uuid not null unique references maintenance.work_orders(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key(plan_id,due_on)
);
alter table maintenance.plan_occurrences enable row level security;
revoke all on maintenance.plan_occurrences from public, anon, authenticated;
grant select on maintenance.plan_occurrences to service_role;

create function maintenance.calendar_due_v1(p_anchor date,p_unit text,p_every integer,p_index integer)
returns date language plpgsql immutable set search_path=pg_catalog as $$
begin
 if p_anchor is null or p_unit is null or p_unit not in ('days','weeks','months','years')
 or p_every is null or p_every not between 1 and 120 or p_index is null or p_index not between 0 and 100000 then
 raise exception 'invalid_calendar_rule' using errcode='22023'; end if;
 -- Calculate from the original anchor, never from a clamped February date.
 return case p_unit when 'days' then p_anchor + p_every*p_index
 when 'weeks' then p_anchor + 7*p_every*p_index
 when 'months' then (p_anchor + make_interval(months=>p_every*p_index))::date
 when 'years' then (p_anchor + make_interval(years=>p_every*p_index))::date end;
end $$;

create function maintenance.plan_asset_allowed_v1(p_context uuid,p_asset uuid,p_permission text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from assets.assets a join identity.context_grants g on g.id=p_context and g.tenant_id=a.tenant_id
 where a.id=p_asset
 and (g.scope_type='tenant' or (g.scope_type='property' and g.property_id=a.property_id) or (g.scope_type='building' and g.building_id=a.building_id) or (g.scope_type='unit' and g.unit_id=a.unit_id))
 and app_private.check_effective_permission_v1(p_context,p_permission,'maintenance',
 case when a.unit_id is not null then 'unit' when a.building_id is not null then 'building' else 'property' end,
 coalesce(a.unit_id,a.building_id,a.property_id)));
$$;

create function maintenance.list_calendar_plans_v1(p_context_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; v_plans jsonb; v_assets jsonb; v_vendors jsonb;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,'maintenance.work_orders.read',true);
 select coalesce(jsonb_agg(q),'[]') into v_plans from (
 select p.id,p.name,p.asset_id,a.name asset_name,p.vendor_id,pt.legal_name vendor_name,
 p.calendar_anchor,p.calendar_unit,p.calendar_every,p.calendar_enabled,p.revision,
 maintenance.calendar_due_v1(p.calendar_anchor,p.calendar_unit,p.calendar_every,p.calendar_index) next_due_on,
 p.checklist_template,
 (select coalesce(jsonb_agg(jsonb_build_object('due_on',o.due_on,'work_order_id',w.id,'work_order_no',w.work_order_no,'status',w.status) order by o.due_on desc),'[]')
 from maintenance.plan_occurrences o join maintenance.work_orders w on w.id=o.work_order_id where o.plan_id=p.id) history
 from maintenance.maintenance_plans p join assets.assets a on a.id=p.asset_id
 left join maintenance.vendors vd on vd.id=p.vendor_id left join portfolio.parties pt on pt.id=vd.party_id
 where p.tenant_id=v.tenant_id and p.calendar_anchor is not null
 and maintenance.plan_asset_allowed_v1(p_context_id,p.asset_id,'maintenance.work_orders.read')
 order by p.created_at desc limit 200) q;
 select coalesce(jsonb_agg(q),'[]') into v_assets from (
 select a.id,a.name,a.asset_code from assets.assets a where a.tenant_id=v.tenant_id and a.status='active'
 and maintenance.plan_asset_allowed_v1(p_context_id,a.id,'maintenance.work_orders.manage') order by a.name limit 500) q;
 select coalesce(jsonb_agg(q),'[]') into v_vendors from (
 select vd.id,pt.legal_name name from maintenance.vendors vd join portfolio.parties pt on pt.id=vd.party_id
 where vd.tenant_id=v.tenant_id and vd.status='approved' and jsonb_array_length(v_assets)>0 order by pt.legal_name limit 500) q;
 return jsonb_build_object('plans',v_plans,'assets',v_assets,'vendors',v_vendors);
end $$;

create function maintenance.save_calendar_plan_v1(p_context_id uuid,p_id uuid,p_revision integer,p_asset_id uuid,p_vendor_id uuid,p_name text,p_anchor date,p_unit text,p_every integer,p_enabled boolean,p_checklist jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; old_plan maintenance.maintenance_plans%rowtype; result maintenance.maintenance_plans%rowtype;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,'maintenance.work_orders.manage',false);
 if p_id is null or p_revision is null or p_enabled is null or p_name is null or length(trim(p_name)) not between 1 and 200
 or p_checklist is null or jsonb_typeof(p_checklist)<>'array' then raise exception 'invalid_plan' using errcode='22023'; end if;
 if jsonb_array_length(p_checklist)>50 or exists(select 1 from jsonb_array_elements(p_checklist) e where jsonb_typeof(e)<>'string' or length(trim(e#>>'{}')) not between 1 and 200) then raise exception 'invalid_checklist' using errcode='22023'; end if;
 perform maintenance.calendar_due_v1(p_anchor,p_unit,p_every,0);
 if not maintenance.plan_asset_allowed_v1(p_context_id,p_asset_id,'maintenance.work_orders.manage') then raise exception 'scope_violation' using errcode='42501'; end if;
 if not exists(select 1 from assets.assets where id=p_asset_id and tenant_id=v.tenant_id and status='active') then raise exception 'invalid_asset' using errcode='22023'; end if;
 if not exists(select 1 from maintenance.vendors where id=p_vendor_id and tenant_id=v.tenant_id and status='approved') then raise exception 'invalid_vendor' using errcode='22023'; end if;
 -- Serialize creation as well as edits using the caller-supplied stable UUID.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,17));
 select * into old_plan from maintenance.maintenance_plans where id=p_id for update;
 if found then
  if old_plan.tenant_id<>v.tenant_id or not maintenance.plan_asset_allowed_v1(p_context_id,old_plan.asset_id,'maintenance.work_orders.manage') then raise exception 'scope_violation' using errcode='42501'; end if;
  if old_plan.calendar_anchor is null or old_plan.revision<>p_revision then raise exception 'plan_revision_conflict' using errcode='40001'; end if;
  -- Keep occurrence identity stable. Create a new plan for another asset/cadence.
  if old_plan.asset_id<>p_asset_id or old_plan.calendar_anchor<>p_anchor or old_plan.calendar_unit<>p_unit or old_plan.calendar_every<>p_every then raise exception 'plan_calendar_immutable' using errcode='22023'; end if;
  update maintenance.maintenance_plans set name=trim(p_name),vendor_id=p_vendor_id,calendar_enabled=p_enabled,checklist_template=p_checklist,revision=revision+1 where id=p_id returning * into result;
 else
  if p_revision<>0 then raise exception 'plan_revision_conflict' using errcode='40001'; end if;
  insert into maintenance.maintenance_plans(id,tenant_id,asset_id,name,trigger_type,recurrence_rule,checklist_template,vendor_id,calendar_anchor,calendar_unit,calendar_every,calendar_enabled,next_due_at)
  values(p_id,v.tenant_id,p_asset_id,trim(p_name),'calendar',jsonb_build_object('anchor',p_anchor,'unit',p_unit,'every',p_every),p_checklist,p_vendor_id,p_anchor,p_unit,p_every,p_enabled,p_anchor::timestamp at time zone 'Europe/Bucharest') returning * into result;
 end if;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,before_snapshot,after_snapshot)
 values(v.tenant_id,v.user_id,v.role_code,'MAINTENANCE_PLAN_SAVED','maintenance.plan',p_id,'Calendar plan configuration',to_jsonb(old_plan),to_jsonb(result));
 return jsonb_build_object('id',result.id,'revision',result.revision);
end $$;

create function maintenance.generate_calendar_order_v1(p_context_id uuid,p_plan_id uuid,p_due_on date)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; p maintenance.maintenance_plans%rowtype; a assets.assets%rowtype; existing uuid; result jsonb; due date; order_id uuid;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,'maintenance.work_orders.manage',false);
 select * into p from maintenance.maintenance_plans where id=p_plan_id for update;
 if not found then raise exception 'plan_not_found' using errcode='P0002'; end if;
 if p.tenant_id<>v.tenant_id or not maintenance.plan_asset_allowed_v1(p_context_id,p.asset_id,'maintenance.work_orders.manage') then raise exception 'scope_violation' using errcode='42501'; end if;
 select work_order_id into existing from maintenance.plan_occurrences where plan_id=p_plan_id and due_on=p_due_on;
 if found then return jsonb_build_object('id',existing,'replayed',true); end if;
 if not p.calendar_enabled or p.calendar_anchor is null then raise exception 'plan_disabled' using errcode='22023'; end if;
 due:=maintenance.calendar_due_v1(p.calendar_anchor,p.calendar_unit,p.calendar_every,p.calendar_index);
 if p_due_on is null or p_due_on<>due or due>(statement_timestamp() at time zone 'Europe/Bucharest')::date then raise exception 'invalid_due_date' using errcode='22023'; end if;
 select * into a from assets.assets where id=p.asset_id and tenant_id=v.tenant_id and status='active';
 if not found then raise exception 'invalid_asset' using errcode='22023'; end if;
 if not exists(select 1 from maintenance.vendors where id=p.vendor_id and tenant_id=v.tenant_id and status='approved') then raise exception 'invalid_vendor' using errcode='22023'; end if;
 result:=maintenance.create_work_order(p_context_id=>p_context_id,p_property_id=>a.property_id,p_building_id=>a.building_id,p_unit_id=>a.unit_id,p_asset_id=>a.id,p_title=>p.name,p_priority=>p.default_priority::text,p_scheduled_start=>due::timestamp at time zone 'Europe/Bucharest',p_vendor_id=>p.vendor_id);
 order_id:=(result->>'id')::uuid;
 update maintenance.work_orders set plan_id=p.id where id=order_id;
 insert into maintenance.work_order_checklist_items(tenant_id,work_order_id,sequence_no,label)
 select v.tenant_id,order_id,ordinality::integer,value from jsonb_array_elements_text(p.checklist_template) with ordinality;
 insert into maintenance.plan_occurrences(plan_id,due_on,work_order_id) values(p.id,due,order_id);
 update maintenance.maintenance_plans set calendar_index=calendar_index+1,revision=revision+1,last_generated_at=statement_timestamp(),
 next_due_at=maintenance.calendar_due_v1(calendar_anchor,calendar_unit,calendar_every,calendar_index+1)::timestamp at time zone 'Europe/Bucharest' where id=p.id;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
 values(v.tenant_id,v.user_id,v.role_code,'MAINTENANCE_PLAN_ORDER_GENERATED','maintenance.plan',p.id,'Due occurrence issued as draft',jsonb_build_object('due_on',due,'work_order_id',order_id));
 return result || jsonb_build_object('replayed',false);
end $$;

create function customer_api.list_calendar_plans_v1(p_context_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select maintenance.list_calendar_plans_v1(p_context_id) $$;
create function customer_api.save_calendar_plan_v1(p_context_id uuid,p_id uuid,p_revision integer,p_asset_id uuid,p_vendor_id uuid,p_name text,p_anchor date,p_unit text,p_every integer,p_enabled boolean,p_checklist jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select maintenance.save_calendar_plan_v1(p_context_id,p_id,p_revision,p_asset_id,p_vendor_id,p_name,p_anchor,p_unit,p_every,p_enabled,p_checklist) $$;
create function customer_api.generate_calendar_order_v1(p_context_id uuid,p_plan_id uuid,p_due_on date) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select maintenance.generate_calendar_order_v1(p_context_id,p_plan_id,p_due_on) $$;

revoke all on function maintenance.calendar_due_v1(date,text,integer,integer),maintenance.plan_asset_allowed_v1(uuid,uuid,text) from public,anon,authenticated;
revoke all on function maintenance.list_calendar_plans_v1(uuid),maintenance.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb),maintenance.generate_calendar_order_v1(uuid,uuid,date) from public,anon;
revoke all on function customer_api.list_calendar_plans_v1(uuid),customer_api.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb),customer_api.generate_calendar_order_v1(uuid,uuid,date) from public,anon;
grant execute on function maintenance.list_calendar_plans_v1(uuid),maintenance.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb),maintenance.generate_calendar_order_v1(uuid,uuid,date) to authenticated;
grant execute on function customer_api.list_calendar_plans_v1(uuid),customer_api.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb),customer_api.generate_calendar_order_v1(uuid,uuid,date) to authenticated;

commit;
