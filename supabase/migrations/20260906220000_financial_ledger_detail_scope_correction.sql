-- =============================================================================
-- Migration: 20260906220000_financial_ledger_detail_scope_correction.sql
-- Description: CLADORA P1 — Financial Ledger Detail Scope & Authorization Hardening
--   1. Authoritative Journal Target Scope Verification in finance.get_customer_ledger:
--      - Validates p_journal_id exists and belongs strictly to caller's context scope.
--      - Property scope is strictly limited to j.property_id = context.property_id (rejects cross-property AND tenant-wide journals).
--      - Resident roles (owner, tenant_resident) are strictly limited to journals touching their assigned unit/party.
--      - Out-of-scope or non-existent journals fail identically with SQLSTATE P0002 / 'ledger_journal_not_found'.
-- =============================================================================

begin;

create or replace function finance.get_customer_ledger(
  p_context_id uuid,
  p_query text default null,
  p_status text default null,
  p_account_type text default null,
  p_from date default null,
  p_to date default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_journal_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, finance, identity, platform, portfolio, occupancy
as $$
declare
  v record;
  v_workspace uuid;
  v_party uuid;
  v_is_resident boolean;
  v_is_tenant boolean;
  v_total bigint;
  v_journals jsonb;
  v_accounts jsonb;
  v_periods jsonb;
  v_trial jsonb;
  v_detail jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
  if p_limit<1 or p_limit>100 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  if p_status is not null and p_status not in ('draft','posted','reversed') then raise exception 'invalid_status' using errcode='22023'; end if;
  if p_account_type is not null and p_account_type not in ('asset','liability','equity','income','expense') then raise exception 'invalid_account_type' using errcode='22023'; end if;

  select g.*, m.id membership_key, m.role_id, r.code role_code, r.name role_name, t.legal_name tenant_name
  into v
  from identity.context_grants g
  join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  join identity.roles r on r.id=m.role_id
  join platform.tenants t on t.id=m.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode='42501'; end if;

  if lower(v.role_code) not in ('association_admin','property_manager','president','censor','owner','tenant_resident') then
    raise exception 'ledger_role_denied' using errcode='42501';
  end if;

  if not exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
    where rp.role_id=v.role_id and rp.effect='allow' and p.code='finance.ledger.read') then
    raise exception 'ledger_permission_required' using errcode='42501';
  end if;

  select w.id into v_workspace from platform.customer_workspaces w
  where w.tenant_id=v.tenant_id and w.lifecycle_status='ACTIVE' order by w.id limit 1;

  if v_workspace is null or not exists(select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id=v_workspace and e.entitlement_key='module.accounting'
      and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp()
        then e.override_value_json='true'::jsonb else e.boolean_value is true end)) then
    raise exception 'ledger_entitlement_required' using errcode='42501';
  end if;

  v_is_resident:=lower(v.role_code) in ('owner','tenant_resident');
  v_is_tenant:=lower(v.role_code)='tenant_resident';
  if v_is_resident then
    if v.scope_type<>'unit' then raise exception 'resident_unit_context_required' using errcode='42501'; end if;
    select mp.party_id into v_party from identity.membership_parties mp
    where mp.membership_id=v.membership_key and mp.tenant_id=v.tenant_id;
    if v_party is null then raise exception 'resident_party_mapping_required' using errcode='42501'; end if;
  end if;

  with visible_journals as (
    select j.* from finance.journals j
    where j.tenant_id=v.tenant_id
      and (case
            when v.scope_type='tenant' then true
            when v.scope_type='property' then (j.property_id is not null and j.property_id=v.property_id)
            when v.scope_type='building' then (j.property_id is not null and j.property_id=(select b.property_id from portfolio.buildings b where b.id=v.building_id))
            when v.scope_type='unit' then (j.property_id is not null and j.property_id=(select b.property_id from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v.unit_id))
            else false end)
      and (not v_is_resident or exists(select 1 from finance.journal_entries re
        where re.journal_id=j.id and re.unit_id=v.unit_id and (not v_is_tenant or re.party_id is null or re.party_id=v_party)))
      and (p_status is null or j.status::text=p_status)
      and (p_from is null or j.occurred_on>=p_from)
      and (p_to is null or j.occurred_on<=p_to)
      and (p_journal_id is null or j.id=p_journal_id)
      and (p_query is null or j.description ilike '%'||trim(p_query)||'%' or j.journal_no::text ilike '%'||trim(p_query)||'%')
  ), totals as (
    select j.id,
      coalesce(sum(e.amount) filter(where e.side='debit' and (not v_is_resident or (e.unit_id=v.unit_id and (not v_is_tenant or e.party_id is null or e.party_id=v_party)))),0) debit_total,
      coalesce(sum(e.amount) filter(where e.side='credit' and (not v_is_resident or (e.unit_id=v.unit_id and (not v_is_tenant or e.party_id is null or e.party_id=v_party)))),0) credit_total
    from visible_journals j left join finance.journal_entries e on e.journal_id=j.id group by j.id
  ), page as (
    select j.*,t.debit_total,t.credit_total,count(*) over() total_count
    from visible_journals j join totals t on t.id=j.id order by j.occurred_on desc,j.journal_no desc limit p_limit offset p_offset
  )
  select coalesce(max(total_count),0),coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'journal_no',journal_no,'occurred_on',occurred_on,'currency',currency,'description',description,
    'source_type',source_type,'status',status,'posted_at',posted_at,'debit_total',debit_total,
    'credit_total',credit_total,'balanced',debit_total=credit_total) order by occurred_on desc,journal_no desc),'[]'::jsonb)
  into v_total,v_journals from page;

  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'name',a.name,'type',a.type,'currency',a.currency,'balance',a.balance)
    order by a.code),'[]'::jsonb) into v_accounts from (
    select ac.id,ac.code,ac.name,ac.type,ac.currency,
      coalesce(sum(case when e.side='debit' then e.amount else -e.amount end)
        filter(where j.status in ('posted','reversed') and (not v_is_resident or (e.unit_id=v.unit_id and (not v_is_tenant or e.party_id is null or e.party_id=v_party)))),0) balance
    from finance.accounts ac left join finance.journal_entries e on e.account_id=ac.id
    left join finance.journals j on j.id=e.journal_id and j.status in ('posted','reversed')
    where ac.tenant_id=v.tenant_id and (p_account_type is null or ac.type::text=p_account_type)
      and (v.scope_type='tenant' or ac.property_id is null or ac.property_id=v.property_id
        or ac.property_id=(select b.property_id from portfolio.buildings b where b.id=v.building_id)
        or ac.property_id=(select b.property_id from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v.unit_id))
    group by ac.id
  ) a;

  -- PERIODS ISOLATION:
  -- Tenant scope: all tenant periods.
  -- Property scope: strictly p.property_id = v.property_id (NEVER null, never cross-property).
  -- Building/unit scope: specific property_id of that building/unit.
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'starts_on',p.starts_on,'ends_on',p.ends_on,
    'status',p.status,'closed_at',p.closed_at) order by p.starts_on desc, p.id desc),'[]'::jsonb)
  into v_periods from finance.accounting_periods p
  where p.tenant_id=v.tenant_id
    and (case
          when v.scope_type='tenant' then true
          when v.scope_type='property' then (p.property_id is not null and p.property_id=v.property_id)
          when v.scope_type='building' then (p.property_id is not null and p.property_id=(select b.property_id from portfolio.buildings b where b.id=v.building_id))
          when v.scope_type='unit' then (p.property_id is not null and p.property_id=(select b.property_id from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v.unit_id))
          else false end);

  select jsonb_build_object('debit',coalesce(sum(e.amount) filter(where e.side='debit'),0),
    'credit',coalesce(sum(e.amount) filter(where e.side='credit'),0),
    'balanced',coalesce(sum(e.amount) filter(where e.side='debit'),0)=coalesce(sum(e.amount) filter(where e.side='credit'),0))
  into v_trial from finance.journal_entries e join finance.journals j on j.id=e.journal_id
  where j.tenant_id=v.tenant_id and j.status in ('posted','reversed')
    and (not v_is_resident or (e.unit_id=v.unit_id and (not v_is_tenant or e.party_id is null or e.party_id=v_party)))
    and (case
          when v.scope_type='tenant' then true
          when v.scope_type='property' then (j.property_id is not null and j.property_id=v.property_id)
          when v.scope_type='building' then (j.property_id is not null and j.property_id=(select b.property_id from portfolio.buildings b where b.id=v.building_id))
          when v.scope_type='unit' then (j.property_id is not null and j.property_id=(select b.property_id from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v.unit_id))
          else false end);

  -- AUTHORITATIVE JOURNAL DETAIL SCOPE & AUTHORIZATION CHECK
  if p_journal_id is not null then
    -- Verify target journal exists and belongs to the caller's authorized scope
    if not exists (
      select 1 from finance.journals j
      where j.id = p_journal_id
        and j.tenant_id = v.tenant_id
        and (case
              when v.scope_type = 'tenant' then true
              when v.scope_type = 'property' then (j.property_id is not null and j.property_id = v.property_id)
              when v.scope_type = 'building' then (j.property_id is not null and j.property_id = (select b.property_id from portfolio.buildings b where b.id = v.building_id))
              when v.scope_type = 'unit' then (j.property_id is not null and j.property_id = (select b.property_id from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.id = v.unit_id))
              else false end)
        and (not v_is_resident or exists (
          select 1 from finance.journal_entries re
          where re.journal_id = j.id
            and re.unit_id = v.unit_id
            and (not v_is_tenant or re.party_id is null or re.party_id = v_party)
        ))
    ) then
      -- Zero-disclosure uniform error: Journal does not exist or caller has no scope access
      raise exception 'ledger_journal_not_found' using errcode = 'P0002';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'account_code',a.code,'account_name',a.name,
      'side',e.side,'amount',e.amount,'memo',e.memo,'unit_id',e.unit_id) order by e.created_at,e.id),'[]'::jsonb)
    into v_detail from finance.journal_entries e join finance.accounts a on a.id=e.account_id
    where e.journal_id=p_journal_id
      and (not v_is_resident or (e.unit_id=v.unit_id and (not v_is_tenant or e.party_id is null or e.party_id=v_party)));
  end if;

  return jsonb_build_object('context',jsonb_build_object('id',v.id,'tenant_name',v.tenant_name,'role_code',v.role_code,'scope_type',v.scope_type),
    'total',v_total,'journals',v_journals,'accounts',v_accounts,'periods',v_periods,'trial_balance',v_trial,
    'detail',coalesce(v_detail,'[]'::jsonb),'limit',p_limit,'offset',p_offset,'read_only',true,'generated_at',statement_timestamp());
end;
$$;

revoke all on function finance.get_customer_ledger(uuid,text,text,text,date,date,integer,integer,uuid) from public,anon;
grant execute on function finance.get_customer_ledger(uuid,text,text,text,date,date,integer,integer,uuid) to authenticated,service_role;

commit;
