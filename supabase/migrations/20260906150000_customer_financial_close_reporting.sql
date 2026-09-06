begin;

-- 1. Create Financial Management Permissions
insert into identity.permissions (code, resource, action, description)
values
  ('finance.periods.read', 'finance.periods', 'read', 'Read customer accounting periods and close readiness within authorized context'),
  ('finance.periods.close', 'finance.periods', 'close', 'Execute immutable accounting period close within authorized context'),
  ('finance.reports.read', 'finance.reports', 'read', 'Read customer financial management reports within authorized context')
on conflict (code) do update
set resource = excluded.resource, action = excluded.action, description = excluded.description;

-- 2. Grant permissions strictly according to Persona Matrix
-- Reports Read and Periods Read: association_admin, property_manager, president, censor
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r cross join identity.permissions p
where lower(r.code) in ('association_admin', 'property_manager', 'president', 'censor')
  and p.code in ('finance.periods.read', 'finance.reports.read')
on conflict (role_id, permission_id) do update set effect = 'allow';

-- Periods Close: ONLY association_admin and property_manager (NEVER president, censor, owner, tenant_resident)
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r cross join identity.permissions p
where lower(r.code) in ('association_admin', 'property_manager')
  and p.code = 'finance.periods.close'
on conflict (role_id, permission_id) do update set effect = 'allow';

-- 3. Adjust accounting_periods table to track actor
alter table finance.accounting_periods
  add column if not exists closed_by uuid references auth.users(id) on delete restrict;

create index if not exists accounting_periods_closed_by_idx on finance.accounting_periods(closed_by);

-- 4. Scope Resolver Helper: app_private.resolve_financial_context_scope
create or replace function app_private.resolve_financial_context_scope(
  p_context_id uuid
)
returns table (
  context_id uuid,
  tenant_id uuid,
  workspace_id uuid,
  scope_type text,
  property_id uuid,
  membership_id uuid,
  user_id uuid,
  role_id uuid,
  role_code text,
  role_name text,
  tenant_name text
)
language plpgsql
security definer
set search_path = pg_catalog, identity, platform, portfolio, occupancy, app_private
as $$
declare
  v_grant record;
  v_workspace uuid;
begin
  -- 1. Authentication check
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. MFA AAL2 enforcement
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- 3. Context & Membership lookup
  select
    g.id as grant_id,
    g.tenant_id as grant_tenant_id,
    g.scope_type as grant_scope_type,
    g.property_id as grant_property_id,
    m.id as membership_id,
    m.user_id,
    m.role_id,
    lower(r.code) as role_code,
    r.name as role_name,
    t.legal_name as tenant_name
  into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- 4. Scope-Type Validation
  -- Building and Unit scopes are strictly Fail-Closed in this phase
  if v_grant.grant_scope_type in ('building', 'unit') then
    raise exception 'financial_reporting_requires_property_or_association_scope' using errcode = '42501';
  end if;

  if v_grant.grant_scope_type not in ('tenant', 'property') then
    raise exception 'financial_scope_invalid: %', v_grant.grant_scope_type using errcode = '42501';
  end if;

  -- For Property scope: property_id must be non-null and belong to tenant
  if v_grant.grant_scope_type = 'property' then
    if v_grant.grant_property_id is null then
      raise exception 'property_context_missing_property_id' using errcode = '42501';
    end if;

    if not exists (
      select 1 from portfolio.properties p
      where p.id = v_grant.grant_property_id
        and p.tenant_id = v_grant.grant_tenant_id
        and p.status = 'active'
    ) then
      raise exception 'property_not_found_or_inactive' using errcode = '42501';
    end if;
  end if;

  -- 5. Active Workspace & Entitlement
  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v_grant.grant_tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.accounting'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
           then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'accounting_module_not_entitled' using errcode = '42501';
  end if;

  return query select
    v_grant.grant_id,
    v_grant.grant_tenant_id,
    v_workspace,
    v_grant.grant_scope_type::text,
    v_grant.grant_property_id,
    v_grant.membership_id,
    v_grant.user_id,
    v_grant.role_id,
    v_grant.role_code,
    v_grant.role_name,
    v_grant.tenant_name;
end;
$$;

-- 5. RPC: finance.get_close_readiness
create or replace function finance.get_close_readiness(
  p_context_id uuid,
  p_period_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, finance, identity, platform, portfolio, occupancy, audit, app_private
as $$
declare
  v_context record;
  v_period record;
  v_draft_count bigint;
  v_posted_count bigint;
  v_unbalanced_count bigint;
  v_currencies text[];
  v_currency_summaries jsonb;
  v_blocking_reasons text[];
  v_warnings text[];
  v_can_close boolean;
  v_has_unclosed_preceding boolean;
  v_all_currencies_balanced boolean;
begin
  -- 1. Central Scope & Entitlement resolution
  select * into v_context from app_private.resolve_financial_context_scope(p_context_id);

  -- 2. Persona Role check
  if v_context.role_code not in ('association_admin', 'property_manager', 'president', 'censor') then
    raise exception 'periods_role_denied' using errcode = '42501';
  end if;

  -- 3. Permission check
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_context.role_id and rp.effect = 'allow' and p.code = 'finance.periods.read'
  ) then
    raise exception 'periods_permission_required' using errcode = '42501';
  end if;

  -- 4. Target period verification
  select * into v_period
  from finance.accounting_periods
  where id = p_period_id and tenant_id = v_context.tenant_id;

  if not found then
    raise exception 'accounting_period_not_found' using errcode = 'P0002';
  end if;

  -- 5. Scope check: Property context CANNOT read tenant-wide or other property periods
  if v_context.scope_type = 'property' then
    if v_period.property_id is null or v_period.property_id <> v_context.property_id then
      raise exception 'property_scope_mismatch' using errcode = '42501';
    end if;
  end if;

  -- 6. Check preceding open periods
  select exists (
    select 1 from finance.accounting_periods p
    where p.tenant_id = v_context.tenant_id
      and (case when v_context.scope_type = 'property' then p.property_id = v_context.property_id
                when v_period.property_id is not null then p.property_id = v_period.property_id
                else true end)
      and p.ends_on < v_period.starts_on
      and p.status = 'open'
  ) into v_has_unclosed_preceding;

  -- 7. Ledger statistics (using canonical j.status in ('posted', 'reversed') contract)
  select
    coalesce(count(*) filter (where j.status = 'draft'), 0),
    coalesce(count(*) filter (where j.status in ('posted', 'reversed')), 0)
  into v_draft_count, v_posted_count
  from finance.journals j
  where j.tenant_id = v_context.tenant_id
    and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id
              when v_period.property_id is not null then j.property_id = v_period.property_id
              else true end)
    and j.occurred_on between v_period.starts_on and v_period.ends_on;

  -- Check unbalanced journals (draft, posted or reversed)
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

  -- Currencies present in period
  select coalesce(array_agg(distinct j.currency::text order by j.currency::text), array[]::text[])
  into v_currencies
  from finance.journals j
  where j.tenant_id = v_context.tenant_id
    and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id
              when v_period.property_id is not null then j.property_id = v_period.property_id
              else true end)
    and j.occurred_on between v_period.starts_on and v_period.ends_on;

  -- Per-currency summary
  with cur_stats as (
    select
      j.currency::text as currency,
      count(distinct j.id) filter (where j.status in ('posted', 'reversed')) as posted_count,
      count(distinct j.id) filter (where j.status = 'draft') as draft_count,
      coalesce(sum(case when e.side = 'debit' and j.status in ('posted', 'reversed') then e.amount else 0 end), 0) as total_debit,
      coalesce(sum(case when e.side = 'credit' and j.status in ('posted', 'reversed') then e.amount else 0 end), 0) as total_credit
    from finance.journals j
    join finance.journal_entries e on e.journal_id = j.id
    where j.tenant_id = v_context.tenant_id
      and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id
                when v_period.property_id is not null then j.property_id = v_period.property_id
                else true end)
      and j.occurred_on between v_period.starts_on and v_period.ends_on
    group by j.currency
    order by j.currency asc
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'currency', cs.currency,
      'posted_journals_count', cs.posted_count,
      'draft_journals_count', cs.draft_count,
      'total_debit', cs.total_debit,
      'total_credit', cs.total_credit,
      'difference', abs(cs.total_debit - cs.total_credit),
      'is_balanced', (cs.total_debit = cs.total_credit)
    )), '[]'::jsonb),
    coalesce(bool_and(cs.total_debit = cs.total_credit), true)
  into v_currency_summaries, v_all_currencies_balanced
  from cur_stats cs;

  -- 8. Evaluate Warnings and Blocking Reasons
  v_blocking_reasons := array[]::text[];
  v_warnings := array[]::text[];

  if v_period.status = 'closed' then
    v_blocking_reasons := array_append(v_blocking_reasons, 'period_already_closed');
  end if;

  if v_period.ends_on >= current_date then
    v_blocking_reasons := array_append(v_blocking_reasons, 'period_not_ended');
    v_warnings := array_append(v_warnings, format('Accounting period ends on %s and cannot be closed before that date has passed', v_period.ends_on));
  end if;

  if v_has_unclosed_preceding then
    v_blocking_reasons := array_append(v_blocking_reasons, 'preceding_periods_unclosed');
    v_warnings := array_append(v_warnings, 'Preceding accounting periods remain open and must be closed sequentially');
  end if;

  if v_draft_count > 0 then
    v_blocking_reasons := array_append(v_blocking_reasons, 'draft_journals_exist');
    v_warnings := array_append(v_warnings, format('%s draft journal(s) require posting or voiding before close', v_draft_count));
  end if;

  if v_unbalanced_count > 0 then
    v_blocking_reasons := array_append(v_blocking_reasons, 'unbalanced_journals_exist');
    v_warnings := array_append(v_warnings, format('%s journal(s) are unbalanced', v_unbalanced_count));
  end if;

  if not coalesce(v_all_currencies_balanced, true) then
    v_blocking_reasons := array_append(v_blocking_reasons, 'currencies_unbalanced');
  end if;

  if cardinality(v_currencies) > 1 then
    v_warnings := array_append(v_warnings, 'multiple_currencies_detected_in_period');
  end if;

  v_can_close := (
    v_period.status = 'open'
    and v_period.ends_on < current_date
    and not v_has_unclosed_preceding
    and v_draft_count = 0
    and v_unbalanced_count = 0
    and coalesce(v_all_currencies_balanced, true)
  );

  return jsonb_build_object(
    'version', 2,
    'period', jsonb_build_object(
      'id', v_period.id,
      'tenant_id', v_period.tenant_id,
      'property_id', v_period.property_id,
      'starts_on', v_period.starts_on,
      'ends_on', v_period.ends_on,
      'status', v_period.status,
      'closed_at', v_period.closed_at,
      'closed_by', v_period.closed_by,
      'snapshot_json', v_period.snapshot_json
    ),
    'tenant_id', v_context.tenant_id,
    'property_id', v_period.property_id,
    'scope_type', v_context.scope_type,
    'status', v_period.status,
    'draft_journals_count', v_draft_count,
    'unbalanced_journals_count', v_unbalanced_count,
    'posted_journals_count', v_posted_count,
    'currencies', to_jsonb(v_currencies),
    'currency_summaries', v_currency_summaries,
    'is_balanced', coalesce(v_all_currencies_balanced, true),
    'warnings', to_jsonb(v_warnings),
    'can_close', v_can_close,
    'blocking_reasons', to_jsonb(v_blocking_reasons),
    'generated_at', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- 6. RPC: finance.get_customer_financial_report
create or replace function finance.get_customer_financial_report(
  p_context_id uuid,
  p_report_type text,
  p_from date,
  p_to date,
  p_currency text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, finance, identity, platform, portfolio, occupancy, audit, app_private
as $$
declare
  v_context record;
  v_currency char(3);
  v_rows jsonb;
  v_totals jsonb;
  v_is_balanced boolean;
  v_difference numeric(20,4);
  v_other_currencies text[];
begin
  -- 1. Central Scope & Entitlement resolution
  select * into v_context from app_private.resolve_financial_context_scope(p_context_id);

  -- 2. Validate Inputs
  if p_report_type not in ('trial_balance', 'profit_and_loss', 'balance_sheet') then
    raise exception 'invalid_report_type: %', p_report_type using errcode = '22023';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid_date_range' using errcode = '22023';
  end if;

  if p_currency is null or length(trim(p_currency)) <> 3 then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;
  v_currency := upper(trim(p_currency));

  -- 3. Role Whitelist
  if v_context.role_code not in ('association_admin', 'property_manager', 'president', 'censor') then
    raise exception 'reports_role_denied' using errcode = '42501';
  end if;

  -- 4. Permission Check
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_context.role_id and rp.effect = 'allow' and p.code = 'finance.reports.read'
  ) then
    raise exception 'reports_permission_required' using errcode = '42501';
  end if;

  -- 5. Detect other currencies in period (for warning banner, strictly no cross-currency aggregation)
  select coalesce(array_agg(distinct j.currency::text order by j.currency::text), array[]::text[])
  into v_other_currencies
  from finance.journals j
  where j.tenant_id = v_context.tenant_id
    and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id else true end)
    and j.occurred_on between p_from and p_to
    and j.currency <> v_currency
    and j.status in ('posted', 'reversed');

  -- 6. Generate Report based on Romanian standard plan of accounts
  -- Note: j.status in ('posted', 'reversed') per canonical ledger contract
  if p_report_type = 'trial_balance' then
    with entries_agg as (
      select
        e.account_id,
        coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0) as debit,
        coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0) as credit
      from finance.journals j
      join finance.journal_entries e on e.journal_id = j.id
      where j.tenant_id = v_context.tenant_id
        and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id else true end)
        and j.occurred_on between p_from and p_to
        and j.currency = v_currency
        and j.status in ('posted', 'reversed')
      group by e.account_id
    ),
    rows_data as (
      select
        a.id as account_id,
        a.code as account_code,
        a.name as account_name,
        a.type::text as account_type,
        ea.debit,
        ea.credit,
        case
          when a.type in ('asset', 'expense') then (ea.debit - ea.credit)
          else (ea.credit - ea.debit)
        end as net_balance
      from finance.accounts a
      join entries_agg ea on ea.account_id = a.id
      where a.tenant_id = v_context.tenant_id
        and (case when v_context.scope_type = 'property' then a.property_id = v_context.property_id else true end)
      order by a.code asc
    )
    select
      coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb),
      jsonb_build_object(
        'total_debit', coalesce(sum(r.debit), 0),
        'total_credit', coalesce(sum(r.credit), 0),
        'is_balanced', (coalesce(sum(r.debit), 0) = coalesce(sum(r.credit), 0)),
        'difference', abs(coalesce(sum(r.debit), 0) - coalesce(sum(r.credit), 0))
      )
    into v_rows, v_totals
    from rows_data r;

    v_difference := abs((v_totals->>'total_debit')::numeric - (v_totals->>'total_credit')::numeric);
    v_is_balanced := (v_difference = 0);

  elsif p_report_type = 'profit_and_loss' then
    with entries_agg as (
      select
        e.account_id,
        coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0) as debit,
        coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0) as credit
      from finance.journals j
      join finance.journal_entries e on e.journal_id = j.id
      where j.tenant_id = v_context.tenant_id
        and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id else true end)
        and j.occurred_on between p_from and p_to
        and j.currency = v_currency
        and j.status in ('posted', 'reversed')
      group by e.account_id
    ),
    rows_data as (
      select
        a.id as account_id,
        a.code as account_code,
        a.name as account_name,
        a.type::text as account_type,
        ea.debit,
        ea.credit,
        case
          when a.type = 'income' then (ea.credit - ea.debit)
          when a.type = 'expense' then (ea.debit - ea.credit)
          else 0
        end as amount
      from finance.accounts a
      join entries_agg ea on ea.account_id = a.id
      where a.tenant_id = v_context.tenant_id
        and a.type in ('income', 'expense')
        and (case when v_context.scope_type = 'property' then a.property_id = v_context.property_id else true end)
      order by a.type desc, a.code asc
    )
    select
      coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb),
      jsonb_build_object(
        'total_income', coalesce(sum(r.amount) filter (where r.account_type = 'income'), 0),
        'total_expense', coalesce(sum(r.amount) filter (where r.account_type = 'expense'), 0),
        'net_profit_loss', coalesce(sum(r.amount) filter (where r.account_type = 'income'), 0) - coalesce(sum(r.amount) filter (where r.account_type = 'expense'), 0)
      )
    into v_rows, v_totals
    from rows_data r;

    v_difference := 0;
    v_is_balanced := true;

  elsif p_report_type = 'balance_sheet' then
    with entries_agg as (
      select
        e.account_id,
        coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0) as debit,
        coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0) as credit
      from finance.journals j
      join finance.journal_entries e on e.journal_id = j.id
      where j.tenant_id = v_context.tenant_id
        and (case when v_context.scope_type = 'property' then j.property_id = v_context.property_id else true end)
        and j.occurred_on <= p_to
        and j.currency = v_currency
        and j.status in ('posted', 'reversed')
      group by e.account_id
    ),
    bs_accounts as (
      select
        a.id as account_id,
        a.code as account_code,
        a.name as account_name,
        a.type::text as account_type,
        ea.debit,
        ea.credit,
        case
          when a.type = 'asset' then (ea.debit - ea.credit)
          when a.type in ('liability', 'equity') then (ea.credit - ea.debit)
          else 0
        end as amount
      from finance.accounts a
      join entries_agg ea on ea.account_id = a.id
      where a.tenant_id = v_context.tenant_id
        and a.type in ('asset', 'liability', 'equity')
        and (case when v_context.scope_type = 'property' then a.property_id = v_context.property_id else true end)
      order by a.type asc, a.code asc
    ),
    retained_earnings as (
      select
        coalesce(sum(case when a.type = 'income' then (ea.credit - ea.debit) else 0 end), 0) -
        coalesce(sum(case when a.type = 'expense' then (ea.debit - ea.credit) else 0 end), 0) as net_retained
      from finance.accounts a
      join entries_agg ea on ea.account_id = a.id
      where a.tenant_id = v_context.tenant_id
        and a.type in ('income', 'expense')
        and (case when v_context.scope_type = 'property' then a.property_id = v_context.property_id else true end)
    )
    select
      coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb),
      jsonb_build_object(
        'total_assets', coalesce(sum(r.amount) filter (where r.account_type = 'asset'), 0),
        'total_liabilities', coalesce(sum(r.amount) filter (where r.account_type = 'liability'), 0),
        'equity_base', coalesce(sum(r.amount) filter (where r.account_type = 'equity'), 0),
        'retained_earnings', (select net_retained from retained_earnings),
        'total_equity', coalesce(sum(r.amount) filter (where r.account_type = 'equity'), 0) + (select net_retained from retained_earnings)
      )
    into v_rows, v_totals
    from bs_accounts r;

    v_difference := abs(
      (v_totals->>'total_assets')::numeric -
      ((v_totals->>'total_liabilities')::numeric + (v_totals->>'total_equity')::numeric)
    );
    v_is_balanced := (v_difference = 0);
  end if;

  return jsonb_build_object(
    'version', 1,
    'report_type', p_report_type,
    'tenant_id', v_context.tenant_id,
    'property_id', case when v_context.scope_type = 'property' then v_context.property_id else null end,
    'currency', v_currency,
    'from', p_from,
    'to', p_to,
    'rows', v_rows,
    'totals', v_totals,
    'is_balanced', v_is_balanced,
    'difference', v_difference,
    'other_currencies_in_period', to_jsonb(v_other_currencies),
    'generated_at', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- 7. RPC: finance.close_accounting_period
drop function if exists finance.close_accounting_period(uuid, uuid);

create or replace function finance.close_accounting_period(
  p_context_id uuid,
  p_period_id uuid,
  p_reason text default null
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
  v_currency_summaries jsonb;
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
  -- Fail-closed explicitly on president, censor, owner, tenant_resident, and unknown roles
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

  -- 10. Block if unbalanced journals exist in period (status draft, posted or reversed)
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

  -- Build Version 2 Snapshot JSON
  v_snapshot := jsonb_build_object(
    'version', 2,
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

  -- 12. Atomic update of period status and snapshot
  update finance.accounting_periods
  set status = 'closed',
      closed_at = v_now,
      closed_by = auth.uid(),
      snapshot_json = v_snapshot
  where id = p_period_id;

  -- 13. Record audit event in audit.events (same atomic transaction)
  v_sanitized_reason := coalesce(nullif(trim(p_reason), ''), 'Accounting period closed with immutable ledger snapshot');
  if length(v_sanitized_reason) > 500 then
    v_sanitized_reason := substring(v_sanitized_reason from 1 for 500);
  end if;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason,
    before_snapshot, after_snapshot, occurred_at
  ) values (
    v_context.tenant_id,
    auth.uid(),
    v_context.role_code,
    'ACCOUNTING_PERIOD_CLOSED',
    'accounting_period',
    p_period_id,
    v_sanitized_reason,
    jsonb_build_object('id', p_period_id, 'status', 'open', 'ends_on', v_period.ends_on),
    jsonb_build_object(
      'id', p_period_id,
      'status', 'closed',
      'closed_at', v_now,
      'closed_by', auth.uid(),
      'context_id', p_context_id,
      'property_id', v_period.property_id,
      'workspace_id', v_context.workspace_id,
      'starts_on', v_period.starts_on,
      'ends_on', v_period.ends_on,
      'snapshot_version', 2,
      'currencies', to_jsonb(v_currencies)
    ),
    v_now
  );

  return jsonb_build_object(
    'version', 2,
    'success', true,
    'period_id', p_period_id,
    'status', 'closed',
    'closed_at', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'closed_by', auth.uid(),
    'snapshot', v_snapshot
  );
end;
$$;

-- 2-argument overload for backwards compatibility and callers without reason
create or replace function finance.close_accounting_period(
  p_context_id uuid,
  p_period_id uuid
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, finance, platform, identity, audit, app_private
as $$
  select finance.close_accounting_period(p_context_id, p_period_id, null::text);
$$;

-- 8. Secure Privileges
revoke all on function app_private.resolve_financial_context_scope(uuid) from public, anon;
revoke all on function finance.get_close_readiness(uuid, uuid) from public, anon;
revoke all on function finance.get_customer_financial_report(uuid, text, date, date, text) from public, anon;
revoke all on function finance.close_accounting_period(uuid, uuid) from public, anon;
revoke all on function finance.close_accounting_period(uuid, uuid, text) from public, anon;

grant execute on function app_private.resolve_financial_context_scope(uuid) to authenticated, service_role;
grant execute on function finance.get_close_readiness(uuid, uuid) to authenticated, service_role;
grant execute on function finance.get_customer_financial_report(uuid, text, date, date, text) to authenticated, service_role;
grant execute on function finance.close_accounting_period(uuid, uuid) to authenticated, service_role;
grant execute on function finance.close_accounting_period(uuid, uuid, text) to authenticated, service_role;

commit;
