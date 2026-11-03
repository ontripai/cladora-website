begin;

create function customer_api.get_observed_savings_evidence_v1(
 p_context_id uuid,p_workspace_id uuid,p_period_start date,p_period_end date,p_currency text
) returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare v_benchmark jsonb; v_categories jsonb; v_delta numeric(20,4);
 v_savings numeric(20,4); v_added numeric(20,4);
begin
 -- C14 remains the sole ledger projection and repeats current AUTH01 and
 -- Workspace/property binding checks inside this transaction snapshot.
 v_benchmark:=customer_api.get_workspace_cost_benchmark_v1(
  p_context_id,p_workspace_id,p_period_start,p_period_end,p_currency);
 v_delta:=(v_benchmark->>'delta_amount')::numeric;
 v_savings:=greatest(-v_delta,0); v_added:=greatest(v_delta,0);
 select coalesce(jsonb_agg(jsonb_build_object(
  'account_code',item->>'account_code','account_name',item->>'account_name',
  'previous_amount',(item->>'previous_amount')::numeric,
  'current_amount',(item->>'current_amount')::numeric,
  'observed_savings',greatest(-((item->>'delta_amount')::numeric),0),
  'observed_added_cost',greatest((item->>'delta_amount')::numeric,0),
  'classification',case when (item->>'delta_amount')::numeric<0 then 'observed_saving'
    when (item->>'delta_amount')::numeric>0 then 'increased_cost' else 'unchanged' end
 ) order by greatest(abs((item->>'delta_amount')::numeric),0) desc,item->>'account_code'),'[]'::jsonb)
 into v_categories from jsonb_array_elements(v_benchmark->'categories') item;
 return jsonb_build_object(
  'contract_version','observed-savings-evidence.v1','workspace_id',p_workspace_id,
  'currency',v_benchmark->>'currency','current_period',v_benchmark->'current_period',
  'baseline_period',v_benchmark->'previous_period','observed_savings',v_savings,
  'observed_added_cost',v_added,'net_savings',-v_delta,'categories',v_categories,
  'evidence_basis',jsonb_build_object('contract_version','workspace-cost-benchmark.v1',
    'comparison_kind',v_benchmark->>'comparison_kind','source',v_benchmark->'source',
    'generated_at',v_benchmark->'generated_at'),
  'causal_attribution',jsonb_build_object('status','withheld',
    'reason_code','causal_savings_evidence_unavailable'),
  'asset_value_claim',jsonb_build_object('status','withheld',
    'reason_code','approved_valuation_evidence_unavailable'),
  'generated_at',statement_timestamp(),'read_only_projection',true);
end;
$$;

revoke all on function customer_api.get_observed_savings_evidence_v1(uuid,uuid,date,date,text)
 from public,anon,authenticated,service_role;
grant execute on function customer_api.get_observed_savings_evidence_v1(uuid,uuid,date,date,text)
 to authenticated;
comment on function customer_api.get_observed_savings_evidence_v1(uuid,uuid,date,date,text) is
 'C15 zero-write observed period variance over C14. No causal savings or asset-value claim is inferred.';

commit;
