begin;
-- Private authority path; no direct table mutation grants or role changes.
create function maintenance.work_order_checklist_v1(p_context_id uuid,p_work_order_id uuid,p_item_id uuid default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; w record; i record;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,'maintenance.work_orders.manage',false);
 select * into w from maintenance.work_orders where id=p_work_order_id and tenant_id=v.tenant_id for update;
 if not found then raise exception 'work_order_not_found' using errcode='P0002';end if;
 if not maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id)
 or not app_private.check_effective_permission_v1(p_context_id,'maintenance.work_orders.manage','maintenance',
 case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id))
 then raise exception 'scope_violation' using errcode='42501';end if;
 if p_item_id is not null then
  if w.status<>'in_progress' then raise exception 'invalid_work_order_transition: checklist requires in_progress' using errcode='22023';end if;
  if length(trim(coalesce(p_notes,''))) not between 10 and 2000 then raise exception 'checklist_result_notes_required' using errcode='22023';end if;
  select * into i from maintenance.work_order_checklist_items where id=p_item_id and work_order_id=w.id and tenant_id=v.tenant_id for update;
  if not found then raise exception 'checklist_item_not_found' using errcode='P0002';end if;
  if i.completed then
   if i.result_json->>'notes' is distinct from trim(p_notes) then raise exception 'checklist_result_already_recorded' using errcode='40001';end if;
  else
   update maintenance.work_order_checklist_items set completed=true,completed_by=v.user_id,completed_at=statement_timestamp(),result_json=jsonb_build_object('notes',trim(p_notes)) where id=i.id;
   insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
   values(v.tenant_id,v.user_id,v.role_code,'WORK_ORDER_CHECKLIST_COMPLETED','maintenance.work_order_checklist_item',i.id,trim(p_notes),jsonb_build_object('work_order_id',w.id,'completed',true));
  end if;
 end if;
 return jsonb_build_object('work_order_id',w.id,'status',w.status,'items',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'label',c.label,'required',c.required,'completed',c.completed,'completed_at',c.completed_at,'notes',c.result_json->>'notes') order by c.sequence_no),'[]'::jsonb) from maintenance.work_order_checklist_items c where c.work_order_id=w.id and c.tenant_id=v.tenant_id));
end $$;
revoke all on function maintenance.work_order_checklist_v1(uuid,uuid,uuid,text) from public,anon;
grant execute on function maintenance.work_order_checklist_v1(uuid,uuid,uuid,text) to authenticated;
create function customer_api.work_order_checklist_v1(p_context_id uuid,p_work_order_id uuid,p_item_id uuid default null,p_notes text default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select maintenance.work_order_checklist_v1(p_context_id,p_work_order_id,p_item_id,p_notes) $$;
revoke all on function customer_api.work_order_checklist_v1(uuid,uuid,uuid,text) from public,anon;
grant execute on function customer_api.work_order_checklist_v1(uuid,uuid,uuid,text) to authenticated;
commit;
