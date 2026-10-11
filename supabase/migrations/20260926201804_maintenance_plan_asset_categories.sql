begin;

-- Retain the existing scoped list and expose a stable category for suggestions.
create or replace function maintenance.list_calendar_plans_v1(p_context_id uuid)
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
 select a.id,a.name,a.asset_code,c.code category_code from assets.assets a
 join assets.asset_categories c on c.id=a.category_id and c.tenant_id=a.tenant_id
 where a.tenant_id=v.tenant_id and a.status='active'
 and maintenance.plan_asset_allowed_v1(p_context_id,a.id,'maintenance.work_orders.manage') order by a.name limit 500) q;
 select coalesce(jsonb_agg(q),'[]') into v_vendors from (
 select vd.id,pt.legal_name name from maintenance.vendors vd join portfolio.parties pt on pt.id=vd.party_id
 where vd.tenant_id=v.tenant_id and vd.status='approved' and jsonb_array_length(v_assets)>0 order by pt.legal_name limit 500) q;
 return jsonb_build_object('plans',v_plans,'assets',v_assets,'vendors',v_vendors);
end $$;

commit;
