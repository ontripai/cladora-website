begin;
-- Preserve the existing authenticated AAL2/assets-read contract; add canonical target authority.
create or replace function maintenance.get_customer_maintenance(
  p_context_id uuid,p_view text default 'assets',p_query text default null,p_status text default null,p_priority text default null,
  p_from date default null,p_to date default null,p_limit integer default 25,p_offset integer default 0,p_id uuid default null
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog
as $$
declare v record; v_workspace uuid; v_party uuid; v_resident boolean; v_tenant boolean; v_total bigint; v_rows jsonb; v_summary jsonb; v_detail jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
  if p_view is null or p_limit is null or p_offset is null or p_view not in ('assets','components','plans','work_orders','tasks','vendors','sla','costs','history') or p_limit<1 or p_limit>100 or p_offset<0 then raise exception 'invalid_query' using errcode='22023'; end if;
  if p_priority is not null and p_priority not in ('low','normal','high','urgent','emergency') then raise exception 'invalid_priority' using errcode='22023'; end if;
  select g.*,m.id membership_key,m.role_id,r.code role_code,r.name role_name,t.legal_name tenant_name into v
  from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  join identity.roles r on r.id=m.role_id join platform.tenants t on t.id=m.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());
  if not found then raise exception 'customer_context_access_denied' using errcode='42501'; end if;
  if lower(v.role_code) not in ('association_admin','property_manager','president','censor','owner','tenant_resident') then raise exception 'maintenance_role_denied' using errcode='42501'; end if;
  if not exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id where rp.role_id=v.role_id and rp.effect='allow' and p.code='maintenance.assets.read') then raise exception 'maintenance_permission_required' using errcode='42501'; end if;
  select w.id into v_workspace from platform.customer_workspaces w where w.tenant_id=v.tenant_id and w.lifecycle_status='ACTIVE' order by w.id limit 1;
  if v_workspace is null or not exists(select 1 from platform.workspace_entitlements e where e.customer_workspace_id=v_workspace and e.entitlement_key='module.maintenance'
    and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp())
    and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp() then e.override_value_json='true'::jsonb else e.boolean_value is true end))
    then raise exception 'maintenance_entitlement_required' using errcode='42501'; end if;
  v_resident:=lower(v.role_code) in ('owner','tenant_resident'); v_tenant:=lower(v.role_code)='tenant_resident';
  if v_resident then
    if v.scope_type<>'unit' then raise exception 'resident_unit_context_required' using errcode='42501'; end if;
    select mp.party_id into v_party from identity.membership_parties mp where mp.membership_id=v.membership_key and mp.tenant_id=v.tenant_id;
    if v_party is null then raise exception 'resident_party_mapping_required' using errcode='42501'; end if;
    if not v_tenant and not exists(select 1 from portfolio.ownerships o where o.tenant_id=v.tenant_id and o.unit_id=v.unit_id and o.party_id=v_party and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>current_date)) then raise exception 'ownership_required' using errcode='42501'; end if;
    if v_tenant and not exists(select 1 from occupancy.leases l where l.tenant_id=v.tenant_id and l.unit_id=v.unit_id and l.tenant_party_id=v_party and l.status='active' and l.starts_on<=current_date and (l.ends_on is null or l.ends_on>current_date)) then raise exception 'active_lease_required' using errcode='42501'; end if;
  end if;

  if p_view='assets' then
    with filtered as (select a.id,a.asset_code,a.name,a.scope,a.condition,a.criticality,a.manufacturer,a.model,right(a.serial_fingerprint,8) serial_suffix,a.installed_on,a.expected_life_months,a.replacement_cost,a.currency,a.status,a.retired_at,
      c.code category_code,c.name category_name,p.name property_name,b.name building_name,u.code unit_code,(select count(*) from assets.asset_documents d where d.asset_id=a.id) document_count,
      (select min(mp.next_due_at) from maintenance.maintenance_plans mp where mp.asset_id=a.id and mp.status='active') next_service_at
      from assets.assets a join assets.asset_categories c on c.id=a.category_id left join portfolio.properties p on p.id=a.property_id left join portfolio.buildings b on b.id=a.building_id left join portfolio.units u on u.id=a.unit_id
      where a.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,a.property_id,a.building_id,a.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when a.unit_id is not null then 'unit' when a.building_id is not null then 'building' else 'property' end,coalesce(a.unit_id,a.building_id,a.property_id)),false)) and (not v_resident or a.unit_id=v.unit_id)
      and (p_id is null or a.id=p_id) and (p_status is null or a.status::text=p_status or a.condition::text=p_status) and (p_query is null or trim(p_query)='' or a.asset_code ilike '%'||trim(p_query)||'%' or a.name ilike '%'||trim(p_query)||'%' or coalesce(c.name,'') ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by criticality desc,name,id limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by criticality desc,name,id),'[]') into v_total,v_rows from page;
  elsif p_view='components' then
    with filtered as (select ac.id,ac.quantity,ac.installed_on,ac.removed_on,pa.id parent_asset_id,pa.asset_code parent_code,pa.name parent_name,ca.id component_asset_id,ca.asset_code component_code,ca.name component_name,ca.condition,ca.status
      from assets.asset_components ac join assets.assets pa on pa.id=ac.parent_asset_id join assets.assets ca on ca.id=ac.component_asset_id
      where ac.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,pa.property_id,pa.building_id,pa.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when pa.unit_id is not null then 'unit' when pa.building_id is not null then 'building' else 'property' end,coalesce(pa.unit_id,pa.building_id,pa.property_id)),false)) and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,ca.property_id,ca.building_id,ca.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when ca.unit_id is not null then 'unit' when ca.building_id is not null then 'building' else 'property' end,coalesce(ca.unit_id,ca.building_id,ca.property_id)),false)) and (not v_resident or pa.unit_id=v.unit_id)
      and (p_id is null or ac.id=p_id) and (p_status is null or ca.status::text=p_status or ca.condition::text=p_status) and (p_query is null or trim(p_query)='' or pa.name ilike '%'||trim(p_query)||'%' or ca.name ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by parent_name,component_name,id limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by parent_name,component_name,id),'[]') into v_total,v_rows from page;
  elsif p_view='plans' then
    with filtered as (select mp.id,mp.name,mp.trigger_type,mp.estimated_duration_minutes,mp.default_priority,mp.next_due_at,mp.last_generated_at,mp.status,a.id asset_id,a.asset_code,a.name asset_name,a.condition,
      (mp.next_due_at is not null and mp.next_due_at<statement_timestamp()) overdue
      from maintenance.maintenance_plans mp join assets.assets a on a.id=mp.asset_id
      where mp.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,a.property_id,a.building_id,a.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when a.unit_id is not null then 'unit' when a.building_id is not null then 'building' else 'property' end,coalesce(a.unit_id,a.building_id,a.property_id)),false)) and (not v_resident or a.unit_id=v.unit_id)
      and (p_id is null or mp.id=p_id) and (p_status is null or mp.status::text=p_status) and (p_priority is null or mp.default_priority::text=p_priority) and (p_from is null or mp.next_due_at::date>=p_from) and (p_to is null or mp.next_due_at::date<=p_to)
      and (p_query is null or trim(p_query)='' or mp.name ilike '%'||trim(p_query)||'%' or a.name ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by next_due_at nulls last,id limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by next_due_at nulls last,id),'[]') into v_total,v_rows from page;
  elsif p_view='work_orders' then
    with filtered as (select w.id,w.work_order_no,w.title,w.description,w.priority,w.status,w.scheduled_start,w.scheduled_end,w.started_at,w.completed_at,w.verified_at,w.completion_summary,w.created_at,
      a.asset_code,a.name asset_name,p.name property_name,b.name building_name,u.code unit_code,mp.name plan_name,
      va.vendor_name,coalesce(sc.cost_totals,'{}'::jsonb) cost_totals,sc.invoice_ids,sc.journal_ids,tw.ticket_no,
      case when w.status not in ('completed','verified','cancelled') and coalesce(w.scheduled_end,w.scheduled_start)<statement_timestamp() then true else false end overdue
      from maintenance.work_orders w left join assets.assets a on a.id=w.asset_id left join maintenance.maintenance_plans mp on mp.id=w.plan_id left join portfolio.properties p on p.id=w.property_id left join portfolio.buildings b on b.id=w.building_id left join portfolio.units u on u.id=w.unit_id
      left join lateral(select pp.legal_name vendor_name from maintenance.work_order_assignments wa join maintenance.vendors mv on mv.id=wa.vendor_id join portfolio.parties pp on pp.id=mv.party_id where wa.work_order_id=w.id order by wa.assigned_at desc limit 1) va on true
      left join lateral(select (select jsonb_object_agg(x.currency,x.total) from (select wc.currency,sum(wc.amount) total from maintenance.work_order_costs wc where wc.work_order_id=w.id group by wc.currency) x) cost_totals,
        (select jsonb_agg(distinct wc.invoice_id) filter(where wc.invoice_id is not null) from maintenance.work_order_costs wc where wc.work_order_id=w.id) invoice_ids,
        (select jsonb_agg(distinct wc.journal_id) filter(where wc.journal_id is not null) from maintenance.work_order_costs wc where wc.work_order_id=w.id) journal_ids) sc on true
      left join lateral(select t.ticket_no from maintenance.ticket_work_orders x join maintenance.tickets t on t.id=x.ticket_id where x.work_order_id=w.id order by t.reported_at desc limit 1) tw on true
      where w.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)
      and (p_id is null or w.id=p_id) and (p_status is null or w.status::text=p_status) and (p_priority is null or w.priority::text=p_priority) and (p_from is null or w.created_at::date>=p_from) and (p_to is null or w.created_at::date<=p_to)
      and (p_query is null or trim(p_query)='' or w.title ilike '%'||trim(p_query)||'%' or w.work_order_no::text ilike '%'||trim(p_query)||'%' or coalesce(a.name,'') ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by created_at desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by created_at desc,id desc),'[]') into v_total,v_rows from page;
  elsif p_view='tasks' then
    with filtered as (select i.id,i.sequence_no,i.label,i.required,i.completed,i.completed_at,w.id work_order_id,w.work_order_no,w.title work_order_title,w.priority,w.status work_order_status,w.created_at
      from maintenance.work_order_checklist_items i join maintenance.work_orders w on w.id=i.work_order_id
      where i.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)
      and (p_id is null or i.id=p_id) and (p_status is null or (case when i.completed then 'completed' else 'pending' end)=p_status) and (p_priority is null or w.priority::text=p_priority) and (p_query is null or trim(p_query)='' or i.label ilike '%'||trim(p_query)||'%' or w.title ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by created_at desc,sequence_no,id limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by created_at desc,sequence_no,id),'[]') into v_total,v_rows from page;
  elsif p_view='vendors' then
    with filtered as (select mv.id,mv.status,mv.service_categories,mv.rating,mv.insurance_valid_until,pp.legal_name vendor_name,
      count(distinct wa.work_order_id) filter(where w.id is not null) assigned_work_orders,count(distinct vc.id) active_contracts
      from maintenance.vendors mv join portfolio.parties pp on pp.id=mv.party_id
      left join maintenance.work_order_assignments wa on wa.vendor_id=mv.id and wa.tenant_id=mv.tenant_id left join maintenance.work_orders w on w.id=wa.work_order_id and w.tenant_id=mv.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false))
      left join maintenance.vendor_contracts vc on vc.vendor_id=mv.id and vc.tenant_id=mv.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,vc.property_id,null,null) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when null is not null then 'unit' when null is not null then 'building' else 'property' end,coalesce(null,null,vc.property_id)),false)) and vc.status='active' and vc.starts_on<=current_date and (vc.ends_on is null or vc.ends_on>=current_date)
      where mv.tenant_id=v.tenant_id and (exists(select 1 from maintenance.vendor_contracts x where x.vendor_id=mv.id and x.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,x.property_id,null,null) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when null is not null then 'unit' when null is not null then 'building' else 'property' end,coalesce(null,null,x.property_id)),false)))
        or exists(select 1 from maintenance.work_order_assignments xwa join maintenance.work_orders xw on xw.id=xwa.work_order_id where xwa.vendor_id=mv.id and xwa.tenant_id=mv.tenant_id and xw.tenant_id=mv.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,xw.property_id,xw.building_id,xw.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when xw.unit_id is not null then 'unit' when xw.building_id is not null then 'building' else 'property' end,coalesce(xw.unit_id,xw.building_id,xw.property_id)),false))))
      and (not v_resident or exists(select 1 from maintenance.work_order_assignments xwa join maintenance.work_orders xw on xw.id=xwa.work_order_id where xwa.vendor_id=mv.id and xwa.tenant_id=mv.tenant_id and xw.tenant_id=mv.tenant_id and xw.unit_id=v.unit_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,xw.property_id,xw.building_id,xw.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when xw.unit_id is not null then 'unit' when xw.building_id is not null then 'building' else 'property' end,coalesce(xw.unit_id,xw.building_id,xw.property_id)),false))))
      and (p_id is null or mv.id=p_id) and (p_status is null or mv.status::text=p_status) and (p_query is null or trim(p_query)='' or pp.legal_name ilike '%'||trim(p_query)||'%' or exists(select 1 from unnest(mv.service_categories) s where s ilike '%'||trim(p_query)||'%'))
      group by mv.id,pp.legal_name), page as (select *,count(*) over() total_count from filtered order by vendor_name,id limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by vendor_name,id),'[]') into v_total,v_rows from page;
  elsif p_view='sla' then
    with filtered as (select s.id,s.metric_code,s.target_value,s.actual_value,s.unit_code,s.met,s.measured_at,w.id work_order_id,w.work_order_no,w.title work_order_title,w.priority,w.status,
      case when s.met is false then true else false end breached
      from maintenance.sla_measurements s join maintenance.work_orders w on w.id=s.work_order_id
      where s.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)
      and (p_id is null or s.id=p_id) and (p_status is null or (case when s.met then 'met' else 'breached' end)=p_status) and (p_priority is null or w.priority::text=p_priority) and (p_from is null or s.measured_at::date>=p_from) and (p_to is null or s.measured_at::date<=p_to)
      and (p_query is null or trim(p_query)='' or s.metric_code ilike '%'||trim(p_query)||'%' or w.title ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by measured_at desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by measured_at desc,id desc),'[]') into v_total,v_rows from page;
  elsif p_view='costs' then
    with filtered as (select wc.id,wc.category_code,wc.description,wc.amount,wc.currency,wc.incurred_on,wc.purchase_order_id,wc.invoice_id,wc.journal_id,wc.allocation_run_id,w.id work_order_id,w.work_order_no,w.title work_order_title
      from maintenance.work_order_costs wc join maintenance.work_orders w on w.id=wc.work_order_id
      where wc.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)
      and (p_id is null or wc.id=p_id) and (p_status is null or wc.category_code=p_status) and (p_from is null or wc.incurred_on>=p_from) and (p_to is null or wc.incurred_on<=p_to)
      and (p_query is null or trim(p_query)='' or wc.description ilike '%'||trim(p_query)||'%' or w.title ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by incurred_on desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by incurred_on desc,id desc),'[]') into v_total,v_rows from page;
  else
    with filtered as (select h.id,h.event_type,h.reason,h.occurred_at,h.work_order_id,h.ticket_id,a.id asset_id,a.asset_code,a.name asset_name
      from assets.asset_history h join assets.assets a on a.id=h.asset_id
      where h.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,a.property_id,a.building_id,a.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when a.unit_id is not null then 'unit' when a.building_id is not null then 'building' else 'property' end,coalesce(a.unit_id,a.building_id,a.property_id)),false)) and (not v_resident or a.unit_id=v.unit_id)
      and (p_id is null or h.id=p_id) and (p_status is null or h.event_type=p_status) and (p_from is null or h.occurred_at::date>=p_from) and (p_to is null or h.occurred_at::date<=p_to)
      and (p_query is null or trim(p_query)='' or h.event_type ilike '%'||trim(p_query)||'%' or coalesce(h.reason,'') ilike '%'||trim(p_query)||'%' or a.name ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by occurred_at desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by occurred_at desc,id desc),'[]') into v_total,v_rows from page;
  end if;

  select jsonb_build_object(
    'assets',(select count(*) from assets.assets a where a.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,a.property_id,a.building_id,a.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when a.unit_id is not null then 'unit' when a.building_id is not null then 'building' else 'property' end,coalesce(a.unit_id,a.building_id,a.property_id)),false)) and (not v_resident or a.unit_id=v.unit_id)),
    'open_work_orders',(select count(*) from maintenance.work_orders w where w.tenant_id=v.tenant_id and w.status in ('draft','scheduled','assigned','in_progress','blocked') and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)),
    'overdue',(select count(*) from maintenance.work_orders w where w.tenant_id=v.tenant_id and w.status not in ('completed','verified','cancelled') and coalesce(w.scheduled_end,w.scheduled_start)<statement_timestamp() and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)),
    'cost_total',(select coalesce(jsonb_object_agg(x.currency,x.total),'{}'::jsonb) from (select wc.currency,sum(wc.amount) total from maintenance.work_order_costs wc join maintenance.work_orders w on w.id=wc.work_order_id where wc.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id) group by wc.currency) x)
  ) into v_summary;
  if p_id is not null then v_detail:=case when v_total=1 then v_rows->0 else null end; end if;
  return jsonb_build_object('context',jsonb_build_object('id',v.id,'tenant_name',v.tenant_name,'role_code',v.role_code,'scope_type',v.scope_type),'view',p_view,'total',v_total,'rows',v_rows,'summary',v_summary,'detail',v_detail,'limit',p_limit,'offset',p_offset,'read_only',true,'generated_at',statement_timestamp());
end $$;
commit;
