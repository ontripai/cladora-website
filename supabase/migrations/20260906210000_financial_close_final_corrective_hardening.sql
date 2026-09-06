-- =============================================================================
-- Migration: 20260906210000_financial_close_final_corrective_hardening.sql
-- Description: CLADORA P1 — Financial Close Final Corrective Hardening
--   1. Non-destructive Preflight validation (Fail-Closed, zero auto-modifications)
--   2. Period Property-to-Tenant mandatory relationship trigger
--   3. Parent-update structural integrity triggers on journals and accounts
--   4. Scope leak fix in finance.get_customer_ledger (property scope never returns tenant-wide periods)
--   5. Dedicated RPC finance.list_customer_accounting_periods(p_context_id uuid)
--   6. Authoritative reason redaction in app_private.redact_audit_text and finance.close_accounting_period
-- =============================================================================

begin;

-- =============================================================================
-- 1. PREFLIGHT DATA VALIDATION (FAIL-CLOSED, ZERO AUTOMATIC DATA MODIFICATION)
-- =============================================================================
do $$
declare
  v_bad_periods int;
  v_bad_entries int;
begin
  -- Check 1: Ensure existing accounting periods with a property belong to the exact same tenant as the property
  select count(*) into v_bad_periods
  from finance.accounting_periods p
  join portfolio.properties prop on prop.id = p.property_id
  where p.property_id is not null
    and p.tenant_id <> prop.tenant_id;

  if v_bad_periods > 0 then
    raise exception 'Migration preflight check failed: % accounting periods belong to property of different tenant', v_bad_periods
      using errcode = '42501';
  end if;

  -- Check 2: Ensure all existing journal entries are consistent with parent journal and account
  select count(*) into v_bad_entries
  from finance.journal_entries e
  join finance.journals j on j.id = e.journal_id
  join finance.accounts a on a.id = e.account_id
  where e.tenant_id <> j.tenant_id
     or a.tenant_id <> j.tenant_id
     or a.property_id is distinct from j.property_id
     or a.currency <> j.currency;

  if v_bad_entries > 0 then
    raise exception 'Migration preflight check failed: % inconsistent journal entries found', v_bad_entries
      using errcode = '42501';
  end if;
end;
$$;

-- =============================================================================
-- 2. MANDATORY ACCOUNTING PERIOD PROPERTY-TO-TENANT INTEGRITY
-- Guarantees that any property-scoped period belongs to the same tenant as the property.
-- =============================================================================
create or replace function finance.assert_accounting_period_property_tenant()
returns trigger
language plpgsql
set search_path = finance, portfolio, platform, public
as $$
declare
  v_prop_tenant uuid;
begin
  if new.property_id is not null then
    select tenant_id into v_prop_tenant
    from portfolio.properties
    where id = new.property_id;

    if not found then
      raise exception 'Property % does not exist', new.property_id
        using errcode = '23503';
    end if;

    if v_prop_tenant <> new.tenant_id then
      raise exception 'Accounting period property (%) belongs to tenant %, not period tenant %',
        new.property_id, v_prop_tenant, new.tenant_id
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists a_assert_accounting_period_property_tenant on finance.accounting_periods;
create trigger a_assert_accounting_period_property_tenant
before insert or update of tenant_id, property_id on finance.accounting_periods
for each row
execute function finance.assert_accounting_period_property_tenant();

-- =============================================================================
-- 3. PARENT-UPDATE STRUCTURAL INTEGRITY ON JOURNALS AND ACCOUNTS
-- Prevents mutating journal or account tenant, property, or currency when entries exist,
-- closing any bypass routes that would leave child entries inconsistent.
-- =============================================================================
create or replace function finance.assert_journal_parent_update_integrity()
returns trigger
language plpgsql
set search_path = finance, portfolio, platform, public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.tenant_id <> old.tenant_id or
    new.property_id is distinct from old.property_id or
    new.currency <> old.currency
  ) then
    if exists (
      select 1
      from finance.journal_entries e
      join finance.accounts a on a.id = e.account_id
      left join portfolio.units u on u.id = e.unit_id
      left join portfolio.buildings b on b.id = u.building_id
      where e.journal_id = new.id
        and (
          e.tenant_id <> new.tenant_id
          or a.tenant_id <> new.tenant_id
          or a.property_id is distinct from new.property_id
          or a.currency <> new.currency
          or (e.unit_id is not null and (
              u.tenant_id <> new.tenant_id
              or (new.property_id is not null and b.property_id <> new.property_id)
          ))
        )
    ) then
      raise exception 'Cannot update journal tenant, property, or currency because existing entries or accounts would become inconsistent'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists a_assert_journal_parent_update_integrity on finance.journals;
create trigger a_assert_journal_parent_update_integrity
before update of tenant_id, property_id, currency on finance.journals
for each row
execute function finance.assert_journal_parent_update_integrity();

create or replace function finance.assert_account_parent_update_integrity()
returns trigger
language plpgsql
set search_path = finance, portfolio, platform, public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.tenant_id <> old.tenant_id or
    new.property_id is distinct from old.property_id or
    new.currency <> old.currency
  ) then
    if exists (
      select 1
      from finance.journal_entries e
      join finance.journals j on j.id = e.journal_id
      where e.account_id = new.id
        and (
          e.tenant_id <> new.tenant_id
          or j.tenant_id <> new.tenant_id
          or new.property_id is distinct from j.property_id
          or new.currency <> j.currency
        )
    ) then
      raise exception 'Cannot update account tenant, property, or currency because existing journal entries would become inconsistent'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists a_assert_account_parent_update_integrity on finance.accounts;
create trigger a_assert_account_parent_update_integrity
before update of tenant_id, property_id, currency on finance.accounts
for each row
execute function finance.assert_account_parent_update_integrity();

-- =============================================================================
-- 4. FIX PERIOD LEAK IN FINANCE.GET_CUSTOMER_LEDGER
-- Re-defines finance.get_customer_ledger so that for property context,
-- periods strictly match p.property_id = v.property_id (NEVER p.property_id IS NULL).
-- =============================================================================
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
            when v.scope_type='property' then j.property_id=v.property_id
            when v.scope_type='building' then j.property_id=(select b.property_id from portfolio.buildings b where b.id=v.building_id)
            when v.scope_type='unit' then j.property_id=(select b.property_id from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v.unit_id)
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

  -- PERIODS ISOLATION FIX:
  -- If scope is tenant: return all tenant periods.
  -- If scope is property: return ONLY p.property_id = v.property_id (NEVER property_id is null).
  -- If scope is building or unit: return ONLY that building/unit's specific property_id.
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'starts_on',p.starts_on,'ends_on',p.ends_on,
    'status',p.status,'closed_at',p.closed_at) order by p.starts_on desc, p.id desc),'[]'::jsonb)
  into v_periods from finance.accounting_periods p
  where p.tenant_id=v.tenant_id
    and (case
          when v.scope_type='tenant' then true
          when v.scope_type='property' then p.property_id=v.property_id
          when v.scope_type='building' then p.property_id=(select b.property_id from portfolio.buildings b where b.id=v.building_id)
          when v.scope_type='unit' then p.property_id=(select b.property_id from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v.unit_id)
          else false end);

  select jsonb_build_object('debit',coalesce(sum(e.amount) filter(where e.side='debit'),0),
    'credit',coalesce(sum(e.amount) filter(where e.side='credit'),0),
    'balanced',coalesce(sum(e.amount) filter(where e.side='debit'),0)=coalesce(sum(e.amount) filter(where e.side='credit'),0))
  into v_trial from finance.journal_entries e join finance.journals j on j.id=e.journal_id
  where j.tenant_id=v.tenant_id and j.status in ('posted','reversed')
    and (not v_is_resident or (e.unit_id=v.unit_id and (not v_is_tenant or e.party_id is null or e.party_id=v_party)))
    and (case
          when v.scope_type='tenant' then true
          when v.scope_type='property' then j.property_id=v.property_id
          when v.scope_type='building' then j.property_id=(select b.property_id from portfolio.buildings b where b.id=v.building_id)
          when v.scope_type='unit' then j.property_id=(select b.property_id from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v.unit_id)
          else false end);

  if p_journal_id is not null then
    select jsonb_build_object('journal',jsonb_build_object('id',j.id,'journal_no',j.journal_no,'occurred_on',j.occurred_on,
      'currency',j.currency,'description',j.description,'source_type',j.source_type,'status',j.status,'posted_at',j.posted_at,
      'entries',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'account_id',e.account_id,'account_code',a.code,'account_name',a.name,
        'side',e.side,'amount',e.amount,'memo',e.memo,'unit_id',e.unit_id,'party_id',e.party_id)
        order by e.created_at,e.id) from finance.journal_entries e join finance.accounts a on a.id=e.account_id where e.journal_id=j.id),'[]'::jsonb)))
    into v_detail from visible_journals j where j.id=p_journal_id;
  end if;

  return jsonb_build_object('total',v_total,'journals',v_journals,'accounts',v_accounts,'periods',v_periods,'trial_balance',v_trial,'detail',v_detail);
end;
$$;

-- =============================================================================
-- 5. DEDICATED PERIOD LISTING RPC: FINANCE.LIST_CUSTOMER_ACCOUNTING_PERIODS
-- Strictly isolates periods by context scope:
-- - Tenant context: all periods of the tenant
-- - Property context: ONLY periods where property_id = context.property_id
-- - Building / Unit contexts: Fail-Closed with 42501
-- Ordered deterministically by starts_on DESC, id DESC
-- =============================================================================
create or replace function finance.list_customer_accounting_periods(
  p_context_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, finance, identity, platform, portfolio, occupancy, app_private
as $$
declare
  v_context record;
  v_periods jsonb;
begin
  -- Resolve context scope (enforces authentication, mfa, active membership, active context, fail-closed on building/unit)
  select * into v_context from app_private.resolve_financial_context_scope(p_context_id);

  -- Role access check: administrative / inspection roles
  if lower(v_context.role_code) not in ('association_admin', 'property_manager', 'president', 'censor') then
    raise exception 'periods_role_denied' using errcode = '42501';
  end if;

  -- Permission check: finance.periods.read
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_context.role_id
      and rp.effect = 'allow'
      and p.code = 'finance.periods.read'
  ) then
    raise exception 'periods_permission_required' using errcode = '42501';
  end if;

  -- Workspace entitlement check: module.accounting
  if v_context.workspace_id is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_context.workspace_id
      and e.entitlement_key = 'module.accounting'
      and e.valid_from <= statement_timestamp()
      and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb
                else e.boolean_value is true end)
  ) then
    raise exception 'periods_entitlement_required' using errcode = '42501';
  end if;

  -- Query periods according to scope
  if v_context.scope_type = 'tenant' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'tenant_id', p.tenant_id,
      'property_id', p.property_id,
      'starts_on', p.starts_on,
      'ends_on', p.ends_on,
      'status', p.status,
      'closed_at', p.closed_at,
      'closed_by', p.closed_by
    ) order by p.starts_on desc, p.id desc), '[]'::jsonb)
    into v_periods
    from finance.accounting_periods p
    where p.tenant_id = v_context.tenant_id;
  elsif v_context.scope_type = 'property' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'tenant_id', p.tenant_id,
      'property_id', p.property_id,
      'starts_on', p.starts_on,
      'ends_on', p.ends_on,
      'status', p.status,
      'closed_at', p.closed_at,
      'closed_by', p.closed_by
    ) order by p.starts_on desc, p.id desc), '[]'::jsonb)
    into v_periods
    from finance.accounting_periods p
    where p.tenant_id = v_context.tenant_id
      and p.property_id = v_context.property_id; -- STRICT EXACT PROPERTY MATCH
  else
    raise exception 'financial_reporting_requires_property_or_association_scope' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'version', 2,
    'scope_type', v_context.scope_type,
    'periods', coalesce(v_periods, '[]'::jsonb)
  );
end;
$$;

-- =============================================================================
-- 6. AUTHORITATIVE REASON REDACTION IN AUDIT AND CLOSE PERIOD RPC
-- =============================================================================
create or replace function app_private.redact_audit_text(p_value text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_text text;
begin
  if p_value is null then
    return null;
  end if;

  -- 1. Trim and remove non-printable control characters
  v_text := trim(regexp_replace(p_value, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));

  -- 2. Case-insensitive sensitive credential and token pattern matching
  if lower(v_text) ~ '(password|passwd|passphrase|secret|token|session|captcha|authorization|cookie|api[ _-]?key|private[ _-]?key|service[ _-]?role|bearer\s+[a-z0-9._~+/-]+=*)' then
    return '[REDACTED]';
  end if;

  -- 3. Length ceiling at 500 characters
  return left(v_text, 500);
end;
$$;

-- Re-define close_accounting_period with authoritative reason redaction
create or replace function finance.close_accounting_period(
  p_context_id uuid,
  p_period_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, finance, identity, platform, portfolio, occupancy, audit, app_private
as $$
declare
  v_context record;
  v_period record;
  v_draft_count bigint;
  v_unbalanced_count bigint;
  v_currencies text[];
  v_all_balanced boolean := true;
  v_snapshot jsonb;
  v_now timestamptz;
  v_cur text;
  v_cur_posted bigint;
  v_cur_debit numeric(20,4);
  v_cur_credit numeric(20,4);
  v_cur_diff numeric(20,4);
  v_cur_balanced boolean;
  v_cur_tb jsonb;
  v_summaries_list jsonb := '[]'::jsonb;
  v_sanitized_reason text;
begin
  -- 1. Central Scope & Entitlement resolution
  select * into v_context from app_private.resolve_financial_context_scope(p_context_id);

  -- 2. Role restriction: ONLY association_admin and property_manager
  if v_context.role_code not in ('association_admin', 'property_manager') then
    raise exception 'period_close_forbidden_for_role: %', v_context.role_code using errcode = '42501';
  end if;

  -- 3. Permission check: finance.periods.close
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_context.role_id and rp.effect = 'allow' and p.code = 'finance.periods.close'
  ) then
    raise exception 'period_close_permission_required' using errcode = '42501';
  end if;

  -- 4. Lock period row FOR UPDATE (prevents concurrent closes)
  select * into v_period
  from finance.accounting_periods
  where id = p_period_id and tenant_id = v_context.tenant_id
  for update;

  if not found then
    raise exception 'accounting_period_not_found' using errcode = 'P0002';
  end if;

  -- 5. Scope check: Property context CANNOT close tenant-wide or other property periods
  if v_context.scope_type = 'property' then
    if v_period.property_id is null or v_period.property_id <> v_context.property_id then
      raise exception 'property_scope_mismatch' using errcode = '42501';
    end if;
  end if;

  -- 6. Idempotency check: Cannot close an already closed period
  if v_period.status = 'closed' then
    raise exception 'period_already_closed' using errcode = '40001';
  end if;

  -- 7. Future period check: cannot close period before ends_on has concluded
  if v_period.ends_on >= current_date then
    raise exception 'period_not_ended: period ends_on (%) has not concluded yet', v_period.ends_on using errcode = '22023';
  end if;

  -- 8. Preceding open periods check
  if exists (
    select 1 from finance.accounting_periods p
    where p.tenant_id = v_context.tenant_id
      and (case when v_context.scope_type = 'property' then p.property_id = v_context.property_id
                when v_period.property_id is not null then p.property_id = v_period.property_id
                else true end)
      and p.ends_on < v_period.starts_on
      and p.status = 'open'
  ) then
    raise exception 'preceding_periods_unclosed' using errcode = '22023';
  end if;

  -- 9. Block if draft journals exist in period
  select count(*) into v_draft_count
  from finance.journals j
  where j.tenant_id = v_context.tenant_id
    and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id
              when v_period.property_id is not null then j.property_id = v_period.property_id
              else true end)
    and j.occurred_on between v_period.starts_on and v_period.ends_on
    and j.status = 'draft';

  if v_draft_count > 0 then
    raise exception 'cannot_close_period_with_draft_journals: % draft journal(s) exist', v_draft_count using errcode = '22023';
  end if;

  -- 10. Block if unbalanced journals exist in period
  select count(*) into v_unbalanced_count
  from (
    select j.id
    from finance.journals j
    join finance.journal_entries e on e.journal_id = j.id
    where j.tenant_id = v_context.tenant_id
      and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id
                when v_period.property_id is not null then j.property_id = v_period.property_id
                else true end)
      and j.occurred_on between v_period.starts_on and v_period.ends_on
    group by j.id
    having count(e.id) < 2 or sum(case when e.side = 'debit' then e.amount else -e.amount end) <> 0
  ) u;

  if v_unbalanced_count > 0 then
    raise exception 'cannot_close_period_with_unbalanced_journals: % unbalanced journal(s) exist', v_unbalanced_count using errcode = '22023';
  end if;

  -- 11. Generate Version 2 Multi-Currency Segregated Snapshot
  v_now := statement_timestamp();

  -- Distinct currencies in period
  select coalesce(array_agg(distinct j.currency::text order by j.currency::text), array[]::text[])
  into v_currencies
  from finance.journals j
  where j.tenant_id = v_context.tenant_id
    and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id
              when v_period.property_id is not null then j.property_id = v_period.property_id
              else true end)
    and j.occurred_on between v_period.starts_on and v_period.ends_on
    and j.status in ('posted', 'reversed');

  -- Build segregated summaries for each currency
  foreach v_cur in array v_currencies
  loop
    select count(distinct j.id) into v_cur_posted
    from finance.journals j
    where j.tenant_id = v_context.tenant_id
      and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id
                when v_period.property_id is not null then j.property_id = v_period.property_id
                else true end)
      and j.occurred_on between v_period.starts_on and v_period.ends_on
      and j.currency = v_cur
      and j.status in ('posted', 'reversed');

    select
      coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0),
      coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0)
    into v_cur_debit, v_cur_credit
    from finance.journals j
    join finance.journal_entries e on e.journal_id = j.id
    where j.tenant_id = v_context.tenant_id
      and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id
                when v_period.property_id is not null then j.property_id = v_period.property_id
                else true end)
      and j.occurred_on between v_period.starts_on and v_period.ends_on
      and j.currency = v_cur
      and j.status in ('posted', 'reversed');

    v_cur_diff := abs(v_cur_debit - v_cur_credit);
    v_cur_balanced := (v_cur_debit = v_cur_credit);
    if not v_cur_balanced then
      v_all_balanced := false;
    end if;

    -- Trial balance entries for this currency
    with entries_agg as (
      select
        e.account_id,
        coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0) as debit,
        coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0) as credit
      from finance.journals j
      join finance.journal_entries e on e.journal_id = j.id
      where j.tenant_id = v_context.tenant_id
        and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id
                  when v_period.property_id is not null then j.property_id = v_period.property_id
                  else true end)
        and j.occurred_on between v_period.starts_on and v_period.ends_on
        and j.currency = v_cur
        and j.status in ('posted', 'reversed')
      group by e.account_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'account_id', a.id,
      'account_code', a.code,
      'account_name', a.name,
      'account_type', a.type::text,
      'debit', ea.debit,
      'credit', ea.credit,
      'net_balance', case when a.type in ('asset', 'expense') then (ea.debit - ea.credit) else (ea.credit - ea.debit) end
    ) order by a.code), '[]'::jsonb)
    into v_cur_tb
    from finance.accounts a
    join entries_agg ea on ea.account_id = a.id
    where a.tenant_id = v_context.tenant_id
      and (case when v_context.scope_type = 'property' then a.property_id = v_context.property_id else true end);

    v_summaries_list := v_summaries_list || jsonb_build_object(
      'currency', v_cur,
      'posted_journals_count', v_cur_posted,
      'total_debit', v_cur_debit,
      'total_credit', v_cur_credit,
      'difference', v_cur_diff,
      'is_balanced', v_cur_balanced,
      'trial_balance', v_cur_tb
    );
  end loop;

  -- 12. Authoritative Redaction of Reason
  if p_reason is not null and trim(p_reason) <> '' then
    v_sanitized_reason := app_private.redact_audit_text(p_reason);
  else
    v_sanitized_reason := 'Accounting period closed with immutable ledger snapshot';
  end if;

  -- Build Version 2 Snapshot JSON
  v_snapshot := jsonb_build_object(
    'version', 2,
    'snapshot_version', 2,
    'close_reason', v_sanitized_reason,
    'period_id', v_period.id,
    'tenant_id', v_period.tenant_id,
    'property_id', v_period.property_id,
    'starts_on', v_period.starts_on,
    'ends_on', v_period.ends_on,
    'closed_at', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'closed_by', auth.uid(),
    'closed_by_role', v_context.role_code,
    'currency_summaries', v_summaries_list,
    'is_balanced', v_all_balanced
  );

  -- Update period row: set closed status and immutable snapshot
  update finance.accounting_periods
  set
    status = 'closed',
    closed_at = v_now,
    closed_by = auth.uid(),
    snapshot_json = v_snapshot
  where id = v_period.id;

  -- Log atomic audit event in audit.events (if this fails, transaction rolls back completely)
  insert into audit.events (
    tenant_id,
    workspace_id,
    action,
    entity_type,
    entity_id,
    actor_id,
    actor_role,
    context_id,
    reason,
    before_state,
    after_state
  ) values (
    v_context.tenant_id,
    v_context.workspace_id,
    'ACCOUNTING_PERIOD_CLOSED',
    'accounting_period',
    v_period.id,
    auth.uid(),
    v_context.role_code,
    p_context_id,
    v_sanitized_reason,
    jsonb_build_object('status', 'open'),
    jsonb_build_object('status', 'closed', 'snapshot_version', 2)
  );

  return jsonb_build_object(
    'version', 2,
    'success', true,
    'period_id', v_period.id,
    'status', 'closed',
    'closed_at', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'closed_by', auth.uid(),
    'snapshot', v_snapshot
  );
end;
$$;

-- Overload for close_accounting_period without explicit reason parameter
create or replace function finance.close_accounting_period(
  p_context_id uuid,
  p_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, finance, identity, platform, portfolio, occupancy, audit, app_private
as $$
begin
  return finance.close_accounting_period(p_context_id, p_period_id, null::text);
end;
$$;

-- =============================================================================
-- 7. SECURITY & ACCESS GRANTS
-- =============================================================================
revoke all on function finance.list_customer_accounting_periods(uuid) from public, anon;
grant execute on function finance.list_customer_accounting_periods(uuid) to authenticated, service_role;

revoke all on function finance.close_accounting_period(uuid, uuid, text) from public, anon;
grant execute on function finance.close_accounting_period(uuid, uuid, text) to authenticated, service_role;

revoke all on function finance.close_accounting_period(uuid, uuid) from public, anon;
grant execute on function finance.close_accounting_period(uuid, uuid) to authenticated, service_role;

revoke all on function finance.assert_accounting_period_property_tenant() from public, anon;
grant execute on function finance.assert_accounting_period_property_tenant() to authenticated, service_role;

revoke all on function finance.assert_journal_parent_update_integrity() from public, anon;
grant execute on function finance.assert_journal_parent_update_integrity() to authenticated, service_role;

revoke all on function finance.assert_account_parent_update_integrity() from public, anon;
grant execute on function finance.assert_account_parent_update_integrity() to authenticated, service_role;

commit;
