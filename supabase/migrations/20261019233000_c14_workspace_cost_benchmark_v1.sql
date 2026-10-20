begin;

-- The legacy financial-report permission predates Workspace-native AUTH01.
-- Bind it to the existing accounting module without granting or activating it.
insert into platform.module_permission_bindings(
 module_definition_id,permission_id,binding_version,permission_mode,
 is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status
)
select m.id,p.id,1,'read',true,false,false,'active'
from platform.module_definitions m cross join identity.permissions p
where m.code='accounting' and m.version=1 and p.code='finance.reports.read'
on conflict(module_definition_id,permission_id,binding_version) do nothing;

-- C14 extends the accepted accounting manifest by one read-only, v1,
-- non-delegable binding. Keep the historic ten-module validator exact while
-- preserving the six separately enumerated high-risk non-delegable controls.
create or replace function app_private.validate_module_permission_bindings_v2_seeding_v1()
returns void
language plpgsql
security definer
set search_path = pg_catalog, platform, identity
as $$
declare
  v_total_count integer;
  v_active_count integer;
  v_delegable_active_count integer;
  v_non_delegable_active_count integer;
  v_v2_non_delegable_count integer;
begin
  select count(*) into v_total_count
  from platform.module_permission_bindings
  where module_definition_id in (
    select id from platform.module_definitions
    where code in ('occupancy','billing','payments','accounting','maintenance',
      'utilities','governance','communications','documents','security')
  );
  if v_total_count <> 91 then
    raise exception 'module_permission_bindings_total_count_mismatch: expected 91, got %', v_total_count
      using errcode = 'P0002';
  end if;

  select count(*) into v_active_count
  from platform.module_permission_bindings
  where module_definition_id in (
    select id from platform.module_definitions
    where code in ('occupancy','billing','payments','accounting','maintenance',
      'utilities','governance','communications','documents','security')
  ) and lifecycle_status = 'active';
  if v_active_count <> 49 then
    raise exception 'module_permission_bindings_active_count_mismatch: expected 49, got %', v_active_count
      using errcode = 'P0002';
  end if;

  select count(*) into v_delegable_active_count
  from platform.module_permission_bindings
  where module_definition_id in (
    select id from platform.module_definitions
    where code in ('occupancy','billing','payments','accounting','maintenance',
      'utilities','governance','communications','documents','security')
  ) and lifecycle_status = 'active' and is_delegable = true;
  if v_delegable_active_count <> 42 then
    raise exception 'delegable_active_count_mismatch: expected 42, got %', v_delegable_active_count
      using errcode = 'P0002';
  end if;

  select count(*) into v_non_delegable_active_count
  from platform.module_permission_bindings
  where module_definition_id in (
    select id from platform.module_definitions
    where code in ('occupancy','billing','payments','accounting','maintenance',
      'utilities','governance','communications','documents','security')
  ) and lifecycle_status = 'active' and is_delegable = false;
  if v_non_delegable_active_count <> 7 then
    raise exception 'non_delegable_active_count_mismatch: expected 7, got %', v_non_delegable_active_count
      using errcode = 'P0002';
  end if;

  select count(*) into v_v2_non_delegable_count
  from platform.module_permission_bindings b
  join identity.permissions p on p.id = b.permission_id
  where p.code in (
    'billing.cancel','payments.reverse','payments.reconcile',
    'utilities.tariffs.manage','governance.votes.administer','governance.minutes.finalize'
  ) and b.binding_version = 2;
  if v_v2_non_delegable_count <> 0 then
    raise exception 'non_delegable_permissions_must_not_have_v2_records' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function app_private.validate_module_permission_bindings_v2_seeding_v1()
  from public, anon, authenticated, service_role;

create function customer_api.get_workspace_cost_benchmark_v1(
 p_context_id uuid,
 p_workspace_id uuid,
 p_period_start date,
 p_period_end date,
 p_currency text
) returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
 v_actor uuid:=auth.uid(); v_context record; v_currency text:=upper(btrim(p_currency));
 v_previous_start date; v_previous_end date; v_days integer;
 v_current numeric(20,4); v_previous numeric(20,4); v_categories jsonb;
 v_property_count integer; v_generated_at timestamptz:=statement_timestamp();
begin
 if v_actor is null then
  raise exception 'cost_benchmark_access_denied' using errcode='42501';
 end if;
 if p_context_id is null or p_workspace_id is null
    or p_period_start is null or p_period_end is null or p_period_end<p_period_start
    or p_period_end-p_period_start>365 or v_currency!~'^[A-Z]{3}$' then
  raise exception 'cost_benchmark_input_invalid' using errcode='22023';
 end if;
 select * into strict v_context
 from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 if app_private.check_workspace_native_permission_v2(
      p_context_id,p_workspace_id,'finance.reports.read','accounting') is not true then
  raise exception 'cost_benchmark_access_denied' using errcode='42501';
 end if;
 select count(*) into v_property_count
 from platform.workspace_property_bindings b
 join portfolio.properties p on p.id=b.property_id and p.tenant_id=b.tenant_id and p.status='active'
 where b.customer_workspace_id=p_workspace_id and b.tenant_id=v_context.tenant_id
  and b.status='active' and b.valid_from<=v_generated_at
  and(b.valid_to is null or b.valid_to>v_generated_at);
 if v_property_count=0 then
  raise exception 'cost_benchmark_workspace_unbound' using errcode='42501';
 end if;
 v_days:=p_period_end-p_period_start+1;
 v_previous_end:=p_period_start-1;
 v_previous_start:=p_period_start-v_days;

 with bound_properties as materialized(
  select b.property_id from platform.workspace_property_bindings b
  where b.customer_workspace_id=p_workspace_id and b.tenant_id=v_context.tenant_id
   and b.status='active' and b.valid_from<=v_generated_at
   and(b.valid_to is null or b.valid_to>v_generated_at)
 ), expense_rows as materialized(
  select a.code,a.name,j.occurred_on,
   case when e.side='debit' then e.amount else -e.amount end amount
  from finance.journals j
  join bound_properties bp on bp.property_id=j.property_id
  join finance.journal_entries e on e.journal_id=j.id and e.tenant_id=j.tenant_id
  join finance.accounts a on a.id=e.account_id and a.tenant_id=e.tenant_id and a.type='expense'
  where j.tenant_id=v_context.tenant_id and j.currency=v_currency
   and j.status in('posted','reversed')
   and j.occurred_on between v_previous_start and p_period_end
 ), totals as(
  select coalesce(sum(amount) filter(where occurred_on between p_period_start and p_period_end),0)::numeric(20,4) current_total,
   coalesce(sum(amount) filter(where occurred_on between v_previous_start and v_previous_end),0)::numeric(20,4) previous_total
  from expense_rows
 ), by_category as(
  select code,name,
   coalesce(sum(amount) filter(where occurred_on between p_period_start and p_period_end),0)::numeric(20,4) current_amount,
   coalesce(sum(amount) filter(where occurred_on between v_previous_start and v_previous_end),0)::numeric(20,4) previous_amount
  from expense_rows group by code,name
 )
 select t.current_total,t.previous_total,
  coalesce((select jsonb_agg(jsonb_build_object(
   'account_code',c.code,'account_name',c.name,'current_amount',c.current_amount,
   'previous_amount',c.previous_amount,'delta_amount',c.current_amount-c.previous_amount,
   'delta_percent',case when c.previous_amount=0 then null else round(((c.current_amount-c.previous_amount)/abs(c.previous_amount))*100,2) end
  ) order by abs(c.current_amount-c.previous_amount) desc,c.code) from by_category c),'[]'::jsonb)
 into v_current,v_previous,v_categories from totals t;

 return jsonb_build_object(
  'contract_version','workspace-cost-benchmark.v1','workspace_id',p_workspace_id,
  'comparison_kind','workspace_prior_period','currency',v_currency,
  'current_period',jsonb_build_object('starts_on',p_period_start,'ends_on',p_period_end,'expense_total',v_current),
  'previous_period',jsonb_build_object('starts_on',v_previous_start,'ends_on',v_previous_end,'expense_total',v_previous),
  'delta_amount',v_current-v_previous,
  'delta_percent',case when v_previous=0 then null else round(((v_current-v_previous)/abs(v_previous))*100,2) end,
  'categories',v_categories,'property_count',v_property_count,
  'source',jsonb_build_object('system','finance.journals','account_type','expense','journal_states',jsonb_build_array('posted','reversed')),
  'external_benchmark',jsonb_build_object('status','withheld','reason_code','approved_regional_dataset_unavailable'),
  'generated_at',v_generated_at,'read_only_projection',true);
end;
$$;

revoke all on function customer_api.get_workspace_cost_benchmark_v1(uuid,uuid,date,date,text)
 from public,anon,authenticated,service_role;
grant execute on function customer_api.get_workspace_cost_benchmark_v1(uuid,uuid,date,date,text)
 to authenticated;
comment on function customer_api.get_workspace_cost_benchmark_v1(uuid,uuid,date,date,text) is
 'C14 zero-write Workspace expense comparison. AUTH01 and active Workspace/property binding scope the existing ledger; unapproved regional benchmarks are withheld.';

commit;
