-- NOT EXECUTED. One prepared SELECT for an independently authorized metadata lane.
-- $1 Workspace, $2 property, $3 tenant from that lane's observed binding.
-- BEGIN READ ONLY + local lock5s/statement30s precede this query in the executor.
-- Code/name/presence alone is not a qualification or an authority decision.
with actual_roles as (
 select 'identity.roles'::text as source_relation,r.id,r.code,null::integer as role_version,
  null::text as lifecycle_status,null::uuid as workspace_id,
  coalesce((select jsonb_agg(jsonb_build_object('permission',p.code,'effect',rp.effect) order by p.code)
   from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
   where rp.role_id=r.id and p.code in ('utilities.invoices.ingest','utilities.invoices.review')),'[]'::jsonb) as explicit_bindings,
  null::bigint as property_assignment_count
 from identity.roles r where (r.tenant_id is null or r.tenant_id=$3::uuid)
  and (r.code='property_manager' or exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
   where rp.role_id=r.id and p.code in ('utilities.invoices.ingest','utilities.invoices.review')))
 union all
 select 'platform.workspace_roles',r.id,r.code,r.role_version,r.lifecycle_status,r.customer_workspace_id,
  coalesce((select jsonb_agg(jsonb_build_object('permission',p.code,'effect',rp.effect) order by p.code)
   from platform.workspace_role_permissions rp join identity.permissions p on p.id=rp.permission_id
   where rp.workspace_role_id=r.id and rp.tenant_id=$3::uuid
   and p.code in ('utilities.invoices.ingest','utilities.invoices.review')),'[]'::jsonb),
  (select count(*) from platform.workspace_member_roles a where a.workspace_role_id=r.id and a.tenant_id=$3::uuid
   and a.customer_workspace_id=$1::uuid and a.scope_type='property' and a.property_id=$2::uuid
   and a.valid_from<=clock_timestamp() and(a.valid_to is null or a.valid_to>clock_timestamp()))
 from platform.workspace_roles r where r.customer_workspace_id=$1::uuid and r.tenant_id=$3::uuid
), ranked as(select *,count(*) over() as full_count from actual_roles)
select *,full_count>128 as truncated from ranked order by source_relation,id limit 128;
