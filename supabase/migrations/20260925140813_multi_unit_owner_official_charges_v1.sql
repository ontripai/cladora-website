begin;

-- This is an item-level view of issued charges for the owner liable party.
-- A verified unit link never grants the owner a tenant/building context grant.
create function customer_api.list_my_owner_building_charges_v1(p_private_unit uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_rows jsonb;
begin
  if not app_private.has_multi_unit_owner_role_v1() then
    raise exception 'owner_role_required' using errcode='42501';
  end if;
  if not exists(select 1 from public.owner_private_units u
    where u.id=p_private_unit and u.owner_user_id=auth.uid() and u.status='active') then
    raise exception 'private_unit_unavailable' using errcode='42501';
  end if;
  with visible as (
    select distinct on (i.id) i.id,i.invoice_no,i.period_start,i.period_end,i.issued_on,i.due_on,
      i.currency,i.total,i.status,r.outstanding_amount,l.workspace_id,l.canonical_unit_id
    from platform.owner_unit_links l
    join platform.customer_workspaces w on w.id=l.workspace_id and w.lifecycle_status='ACTIVE'
    join portfolio.ownerships o on o.tenant_id=w.tenant_id and o.unit_id=l.canonical_unit_id
      and o.party_id=l.ownership_party_id and o.valid_from<=current_date
      and (o.valid_to is null or o.valid_to>current_date)
    join billing.invoices i on i.tenant_id=w.tenant_id and i.unit_id=l.canonical_unit_id
      and i.liable_party_id=l.ownership_party_id and i.status in ('issued','partially_paid','paid','credited')
    left join billing.receivables r on r.tenant_id=i.tenant_id and r.invoice_id=i.id
    where l.owner_user_id=auth.uid() and l.private_unit_id=p_private_unit and l.status='linked'
    order by i.id
  ), recent as (
    select * from visible order by due_on desc nulls last,issued_on desc,id desc limit 100
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'invoice_no',invoice_no,
    'period_start',period_start,'period_end',period_end,'issued_on',issued_on,
    'due_on',due_on,'currency',currency,'total',total,'status',status,
    'outstanding_amount',outstanding_amount,'workspace_id',workspace_id,
    'canonical_unit_id',canonical_unit_id)
    order by due_on desc nulls last,issued_on desc,id desc),'[]'::jsonb)
    into v_rows from recent;
  return v_rows;
end $$;
revoke all on function customer_api.list_my_owner_building_charges_v1(uuid) from public;
grant execute on function customer_api.list_my_owner_building_charges_v1(uuid) to authenticated;
commit;
