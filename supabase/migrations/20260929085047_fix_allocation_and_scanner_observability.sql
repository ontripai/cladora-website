begin;

-- Keep the numeric journal number searchable without coercing an empty string to bigint.
create or replace function finance.get_customer_allocations(
  p_context_id uuid,p_view text default 'runs',p_query text default null,p_status text default null,
  p_method text default null,p_from date default null,p_to date default null,p_limit integer default 25,
  p_offset integer default 0,p_id uuid default null
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,finance,billing,identity,platform,portfolio,occupancy
as $$
declare v record; v_workspace uuid; v_party uuid; v_resident boolean; v_tenant boolean;
  v_property uuid; v_total bigint; v_rows jsonb; v_summary jsonb; v_detail jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
  if p_view not in ('runs','rules','lines') or p_limit<1 or p_limit>100 or p_offset<0 then raise exception 'invalid_query' using errcode='22023'; end if;
  if p_method is not null and p_method not in ('meter_consumption','cpi','per_person','surface_m2','direct','fixed') then raise exception 'invalid_method' using errcode='22023'; end if;
  select g.*,m.id membership_key,m.role_id,r.code role_code,r.name role_name,t.legal_name tenant_name into v
  from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  join identity.roles r on r.id=m.role_id join platform.tenants t on t.id=m.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());
  if not found then raise exception 'customer_context_access_denied' using errcode='42501'; end if;
  if lower(v.role_code) not in ('association_admin','property_manager','president','censor','owner','tenant_resident') then raise exception 'allocation_role_denied' using errcode='42501'; end if;
  if not exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
    where rp.role_id=v.role_id and rp.effect='allow' and p.code='finance.allocations.read') then raise exception 'allocation_permission_required' using errcode='42501'; end if;
  select w.id into v_workspace from platform.customer_workspaces w where w.tenant_id=v.tenant_id and w.lifecycle_status='ACTIVE' order by w.id limit 1;
  if v_workspace is null or not exists(select 1 from platform.workspace_entitlements e where e.customer_workspace_id=v_workspace
    and e.entitlement_key='module.accounting' and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp())
    and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp() then e.override_value_json='true'::jsonb else e.boolean_value is true end))
    then raise exception 'allocation_entitlement_required' using errcode='42501'; end if;
  v_property:=case when v.scope_type='property' then v.property_id when v.scope_type='building' then
    (select b.property_id from portfolio.buildings b where b.id=v.building_id and b.tenant_id=v.tenant_id)
    when v.scope_type='unit' then (select b.property_id from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v.unit_id and u.tenant_id=v.tenant_id) else null end;
  v_resident:=lower(v.role_code) in ('owner','tenant_resident'); v_tenant:=lower(v.role_code)='tenant_resident';
  if v_resident then
    if v.scope_type<>'unit' then raise exception 'resident_unit_context_required' using errcode='42501'; end if;
    select mp.party_id into v_party from identity.membership_parties mp where mp.membership_id=v.membership_key and mp.tenant_id=v.tenant_id;
    if v_party is null then raise exception 'resident_party_mapping_required' using errcode='42501'; end if;
    if not v_tenant and not exists(select 1 from portfolio.ownerships o where o.tenant_id=v.tenant_id and o.unit_id=v.unit_id and o.party_id=v_party
      and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>current_date)) then raise exception 'ownership_required' using errcode='42501'; end if;
    if v_tenant and not exists(select 1 from occupancy.leases l where l.tenant_id=v.tenant_id and l.unit_id=v.unit_id and l.tenant_party_id=v_party
      and l.status='active' and l.starts_on<=current_date and (l.ends_on is null or l.ends_on>current_date)) then raise exception 'active_lease_required' using errcode='42501'; end if;
  end if;

  if p_view='rules' then
    with visible as (select r.*,c.code category_code,c.name category_name from finance.allocation_rules r join finance.charge_categories c on c.id=r.charge_category_id
      where r.tenant_id=v.tenant_id and (v_property is null or r.property_id=v_property)
      and (not v_resident or exists(select 1 from finance.allocation_items a join finance.allocation_runs ar on ar.id=a.run_id
        where ar.tenant_id=v.tenant_id and ar.property_id=v_property and (a.rule_snapshot->>'rule_id')=r.id::text
        and a.unit_id=v.unit_id and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
          else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)))),
    filtered as (select * from visible where (p_id is null or id=p_id) and (p_status is null or status::text=p_status) and (p_method is null or method::text=p_method)
      and (p_from is null or valid_from>=p_from) and (p_to is null or coalesce(valid_to,'infinity'::date)<=p_to)
      and (p_query is null or trim(p_query)='' or category_code ilike '%'||trim(p_query)||'%' or category_name ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by valid_from desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(jsonb_build_object('id',id,'category_code',category_code,'category_name',category_name,'method',method,
      'parameters',parameters,'valid_from',valid_from,'valid_to',valid_to,'version',version,'status',status) order by valid_from desc,id desc),'[]'::jsonb) into v_total,v_rows from page;
  elsif p_view='runs' then
    with visible as (select r.*,j.journal_no,
      case when v_resident then coalesce((select sum(a.allocated_amount) from finance.allocation_items a where a.run_id=r.id and a.unit_id=v.unit_id
        and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
          else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)),0)
        else coalesce((select sum(i.amount) from finance.allocation_inputs i where i.run_id=r.id),0) end source_amount,
      coalesce((select sum(a.allocated_amount) from finance.allocation_items a where a.run_id=r.id
        and (not v_resident or (a.unit_id=v.unit_id and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
          else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)))),0) allocated_amount from finance.allocation_runs r
      left join finance.journals j on j.id=r.journal_id where r.tenant_id=v.tenant_id and (v_property is null or r.property_id=v_property)
      and (not v_resident or exists(select 1 from finance.allocation_items a where a.run_id=r.id and a.unit_id=v.unit_id
        and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
          else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)))),
    filtered as (select * from visible where (p_id is null or id=p_id) and (p_status is null or status::text=p_status)
      and (p_from is null or period_start>=p_from) and (p_to is null or period_end<=p_to)
      and (p_query is null or trim(p_query)='' or coalesce(journal_no::text,'') ilike '%'||trim(p_query)||'%' or id::text ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by period_start desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(jsonb_build_object('id',id,'period_start',period_start,'period_end',period_end,'currency',currency,'status',status,
      'source_amount',source_amount,'allocated_amount',allocated_amount,'difference',source_amount-allocated_amount,'input_hash',input_hash,'calculated_at',calculated_at,
      'approved_at',approved_at,'journal_id',journal_id,'journal_no',journal_no) order by period_start desc,id desc),'[]'::jsonb) into v_total,v_rows from page;
  else
    with visible as (select a.*,r.period_start,r.period_end,r.currency,r.status run_status,i.amount source_amount,i.source_type,i.source_id,
      c.code category_code,c.name category_name,inv.invoice_no,
      coalesce(a.explanation_json->>'legal_debtor','shared') legal_debtor,coalesce(a.explanation_json->>'operational_payer','owner') operational_payer
      from finance.allocation_items a join finance.allocation_runs r on r.id=a.run_id and r.tenant_id=a.tenant_id
      join finance.allocation_inputs i on i.id=a.input_id and i.run_id=a.run_id join finance.charge_categories c on c.id=i.category_id
      left join billing.invoices inv on i.source_type='invoice' and inv.id=i.source_id and inv.tenant_id=i.tenant_id
      where a.tenant_id=v.tenant_id and (v_property is null or r.property_id=v_property)
      and (not v_resident or (a.unit_id=v.unit_id and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
        else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)))),
    filtered as (select * from visible where (p_id is null or id=p_id) and (p_status is null or run_status::text=p_status) and (p_method is null or method::text=p_method)
      and (p_from is null or period_start>=p_from) and (p_to is null or period_end<=p_to)
      and (p_query is null or trim(p_query)='' or category_code ilike '%'||trim(p_query)||'%' or category_name ilike '%'||trim(p_query)||'%' or coalesce(invoice_no,'') ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by period_start desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(jsonb_build_object('id',id,'run_id',run_id,'period_start',period_start,'period_end',period_end,'run_status',run_status,
      'currency',currency,'category_code',category_code,'category_name',category_name,'source_type',source_type,'source_id',source_id,'source_document',invoice_no,
      'source_amount',source_amount,'method',method,'basis_value',basis_value,'basis_total',basis_total,'share_ratio',case when basis_total>0 then basis_value/basis_total else 0 end,
      'allocated_amount',allocated_amount,'legal_debtor',legal_debtor,'operational_payer',operational_payer,'rule_snapshot',rule_snapshot,'explanation',explanation_json)
      order by period_start desc,id desc),'[]'::jsonb) into v_total,v_rows from page;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('currency',currency,'source_amount',source_amount,'allocated_amount',allocated_amount,'difference',source_amount-allocated_amount,'run_count',run_count) order by currency),'[]'::jsonb)
  into v_summary from (select r.currency,coalesce(sum(i.source_amount),0) source_amount,coalesce(sum(i.allocated_amount),0) allocated_amount,count(*) run_count from finance.allocation_runs r
    left join lateral(select case when v_resident then coalesce((select sum(a.allocated_amount) from finance.allocation_items a where a.run_id=r.id and a.unit_id=v.unit_id
      and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
        else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)),0)
      else coalesce(sum(x.amount),0) end source_amount from finance.allocation_inputs x where x.run_id=r.id) i0 on true
    left join lateral(select coalesce(sum(x.allocated_amount),0) allocated_amount from finance.allocation_items x where x.run_id=r.id
      and (not v_resident or (x.unit_id=v.unit_id and (case when v_tenant then x.responsible_party_id=v_party and lower(coalesce(x.explanation_json->>'legal_debtor',''))='tenant'
        else lower(coalesce(x.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)))) a0 on true
    cross join lateral(select i0.source_amount,a0.allocated_amount) i
    where r.tenant_id=v.tenant_id and (v_property is null or r.property_id=v_property)
      and (not v_resident or exists(select 1 from finance.allocation_items a where a.run_id=r.id and a.unit_id=v.unit_id
        and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
          else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end))) group by r.currency) s;
  if p_id is not null then v_detail:=case when v_total=1 then v_rows->0 else null end; end if;
  return jsonb_build_object('context',jsonb_build_object('id',v.id,'tenant_name',v.tenant_name,'role_code',v.role_code,'scope_type',v.scope_type),
    'view',p_view,'total',v_total,'rows',v_rows,'summary',v_summary,'detail',v_detail,'limit',p_limit,'offset',p_offset,'read_only',true,'generated_at',statement_timestamp());
end $$;

-- The invoker gateway calls this guarded internal function. Its actor resolver
-- verifies context, MFA and finance.exports.read before returning redacted data.
grant execute on function app_private.get_export_scanner_observability_internal_v1(uuid,integer) to authenticated;

commit;
