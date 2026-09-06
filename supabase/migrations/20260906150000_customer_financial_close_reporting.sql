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

-- 4. RPC: finance.get_close_readiness
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
  v_workspace uuid;
  v_period record;
  v_draft_count bigint;
  v_posted_count bigint;
  v_total_debit numeric(20,4);
  v_total_credit numeric(20,4);
  v_unbalanced_count bigint;
  v_currencies text[];
  v_blocking_reasons text[];
  v_warnings text[];
  v_can_close boolean;
begin
  -- 1. Authentication check
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. MFA enforcement
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- 3. Context & Membership validation
  select g.*, m.id as membership_key, m.role_id, lower(r.code) as role_code, r.name as role_name, t.legal_name as tenant_name
  into v_context
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

  -- 4. Persona Role check
  if v_context.role_code not in ('association_admin', 'property_manager', 'president', 'censor') then
    raise exception 'periods_role_denied' using errcode = '42501';
  end if;

  -- 5. Permission check
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_context.role_id and rp.effect = 'allow' and p.code = 'finance.periods.read'
  ) then
    raise exception 'periods_permission_required' using errcode = '42501';
  end if;

  -- 6. Active workspace & Entitlement check
  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v_context.tenant_id and w.lifecycle_status = 'ACTIVE'
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

  -- 7. Fetch Target Period
  select * into v_period
  from finance.accounting_periods
  where id = p_period_id and tenant_id = v_context.tenant_id;

  if not found then
    raise exception 'accounting_period_not_found' using errcode = 'P0002';
  end if;

  -- Scope check: Property-scoped context must match period property
  if v_context.scope_type <> 'tenant' and v_context.property_id is not null and v_period.property_id is not null and v_period.property_id <> v_context.property_id then
    raise exception 'property_scope_mismatch' using errcode = '42501';
  end if;

  -- 8. Compute Ledger Statistics in Period
  select
    coalesce(count(*) filter (where status = 'draft'), 0),
    coalesce(count(*) filter (where status = 'posted'), 0)
  into v_draft_count, v_posted_count
  from finance.journals j
  where j.tenant_id = v_context.tenant_id
    and (v_period.property_id is null or j.property_id is null or j.property_id = v_period.property_id)
    and j.occurred_on between v_period.starts_on and v_period.ends_on;

  select
    coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0),
    coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0)
  into v_total_debit, v_total_credit
  from finance.journals j
  join finance.journal_entries e on e.journal_id = j.id
  where j.tenant_id = v_context.tenant_id
    and (v_period.property_id is null or j.property_id is null or j.property_id = v_period.property_id)
    and j.occurred_on between v_period.starts_on and v_period.ends_on
    and j.status = 'posted';

  -- Check unbalanced journals (draft or posted)
  select count(*) into v_unbalanced_count
  from (
    select j.id
    from finance.journals j
    join finance.journal_entries e on e.journal_id = j.id
    where j.tenant_id = v_context.tenant_id
      and (v_period.property_id is null or j.property_id is null or j.property_id = v_period.property_id)
      and j.occurred_on between v_period.starts_on and v_period.ends_on
    group by j.id
    having count(e.id) < 2 or sum(case when e.side = 'debit' then e.amount else -e.amount end) <> 0
  ) u;

  -- Currencies present in period
  select coalesce(array_agg(distinct j.currency::text), array[]::text[]) into v_currencies
  from finance.journals j
  where j.tenant_id = v_context.tenant_id
    and (v_period.property_id is null or j.property_id is null or j.property_id = v_period.property_id)
    and j.occurred_on between v_period.starts_on and v_period.ends_on;

  -- 9. Evaluate Warnings and Blocking Reasons
  v_blocking_reasons := array[]::text[];
  v_warnings := array[]::text[];

  if v_period.status = 'closed' then
    v_blocking_reasons := array_append(v_blocking_reasons, 'period_already_closed');
  end if;

  if v_draft_count > 0 then
    v_blocking_reasons := array_append(v_blocking_reasons, 'draft_journals_exist');
    v_warnings := array_append(v_warnings, format('%s draft journal(s) require posting or voiding before close', v_draft_count));
  end if;

  if v_unbalanced_count > 0 then
    v_blocking_reasons := array_append(v_blocking_reasons, 'unbalanced_journals_exist');
    v_warnings := array_append(v_warnings, format('%s journal(s) are unbalanced', v_unbalanced_count));
  end if;

  if cardinality(v_currencies) > 1 then
    v_warnings := array_append(v_warnings, 'multiple_currencies_detected_in_period');
  end if;

  v_can_close := (v_period.status = 'open' and v_draft_count = 0 and v_unbalanced_count = 0);

  return jsonb_build_object(
    'version', 1,
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
    'total_debit', v_total_debit,
    'total_credit', v_total_credit,
    'is_balanced', (v_total_debit = v_total_credit and v_unbalanced_count = 0),
    'difference', abs(v_total_debit - v_total_credit),
    'currencies', to_jsonb(v_currencies),
    'warnings', to_jsonb(v_warnings),
    'can_close', v_can_close,
    'blocking_reasons', to_jsonb(v_blocking_reasons),
    'generated_at', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- 5. RPC: finance.get_customer_financial_report
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
  v_workspace uuid;
  v_currency char(3);
  v_rows jsonb;
  v_totals jsonb;
  v_is_balanced boolean;
  v_difference numeric(20,4);
  v_other_currencies text[];
begin
  -- 1. Authentication
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. MFA policy
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- 3. Validate Inputs
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

  -- 4. Context & Membership verification
  select g.*, m.id as membership_key, m.role_id, lower(r.code) as role_code, r.name as role_name, t.legal_name as tenant_name
  into v_context
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

  -- 5. Role Whitelist (association_admin, property_manager, president, censor ONLY)
  if v_context.role_code not in ('association_admin', 'property_manager', 'president', 'censor') then
    raise exception 'reports_role_denied' using errcode = '42501';
  end if;

  -- 6. Permission Check
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_context.role_id and rp.effect = 'allow' and p.code = 'finance.reports.read'
  ) then
    raise exception 'reports_permission_required' using errcode = '42501';
  end if;

  -- 7. Active workspace & Accounting Entitlement Check
  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v_context.tenant_id and w.lifecycle_status = 'ACTIVE'
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

  -- Detect if journals exist in other currencies for warning
  select coalesce(array_agg(distinct j.currency::text), array[]::text[]) into v_other_currencies
  from finance.journals j
  where j.tenant_id = v_context.tenant_id
    and (v_context.property_id is null or j.property_id is null or j.property_id = v_context.property_id)
    and j.occurred_on between p_from and p_to
    and j.status = 'posted'
    and j.currency <> v_currency;

  -- 8. Generate Report According to p_report_type
  if p_report_type = 'trial_balance' then
    with entries_agg as (
      select
        e.account_id,
        coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0) as debit,
        coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0) as credit
      from finance.journals j
      join finance.journal_entries e on e.journal_id = j.id
      where j.tenant_id = v_context.tenant_id
        and (v_context.property_id is null or j.property_id is null or j.property_id = v_context.property_id)
        and j.occurred_on between p_from and p_to
        and j.currency = v_currency
        and j.status = 'posted'
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
        and (v_context.property_id is null or a.property_id is null or a.property_id = v_context.property_id)
      order by a.code
    )
    select
      coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb),
      jsonb_build_object(
        'total_debit', coalesce(sum(r.debit), 0),
        'total_credit', coalesce(sum(r.credit), 0)
      )
    into v_rows, v_totals
    from rows_data r;

    v_difference := abs(coalesce((v_totals->>'total_debit')::numeric, 0) - coalesce((v_totals->>'total_credit')::numeric, 0));
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
        and (v_context.property_id is null or j.property_id is null or j.property_id = v_context.property_id)
        and j.occurred_on between p_from and p_to
        and j.currency = v_currency
        and j.status = 'posted'
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
        and (v_context.property_id is null or a.property_id is null or a.property_id = v_context.property_id)
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
    -- Cumulative balance as of p_to
    with entries_agg as (
      select
        e.account_id,
        coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0) as debit,
        coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0) as credit
      from finance.journals j
      join finance.journal_entries e on e.journal_id = j.id
      where j.tenant_id = v_context.tenant_id
        and (v_context.property_id is null or j.property_id is null or j.property_id = v_context.property_id)
        and j.occurred_on <= p_to
        and j.currency = v_currency
        and j.status = 'posted'
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
        and (v_context.property_id is null or a.property_id is null or a.property_id = v_context.property_id)
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
        and (v_context.property_id is null or a.property_id is null or a.property_id = v_context.property_id)
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
    'property_id', v_context.property_id,
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

-- 6. RPC: finance.close_accounting_period
create or replace function finance.close_accounting_period(
  p_context_id uuid,
  p_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, finance, identity, platform, portfolio, occupancy, audit, app_private
as $$
declare
  v_context record;
  v_workspace uuid;
  v_period record;
  v_draft_count bigint;
  v_unbalanced_count bigint;
  v_posted_count bigint;
  v_total_debit numeric(20,4);
  v_total_credit numeric(20,4);
  v_currencies text[];
  v_tb_snapshot jsonb;
  v_snapshot jsonb;
  v_now timestamptz;
begin
  -- 1. Authentication check
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. MFA AAL2 enforcement
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- 3. Context & Membership verification
  select g.*, m.id as membership_key, m.role_id, lower(r.code) as role_code, r.name as role_name, t.legal_name as tenant_name
  into v_context
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

  -- 4. Role restriction: ONLY association_admin and property_manager
  -- Fail-closed explicitly on president, censor, owner, tenant_resident, and unknown roles
  if v_context.role_code not in ('association_admin', 'property_manager') then
    raise exception 'period_close_forbidden_for_role: %', v_context.role_code using errcode = '42501';
  end if;

  -- 5. Permission check: finance.periods.close
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_context.role_id and rp.effect = 'allow' and p.code = 'finance.periods.close'
  ) then
    raise exception 'period_close_permission_required' using errcode = '42501';
  end if;

  -- 6. Active workspace & Accounting Entitlement check
  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v_context.tenant_id and w.lifecycle_status = 'ACTIVE'
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

  -- 7. Lock period row FOR UPDATE (prevents concurrent closes)
  select * into v_period
  from finance.accounting_periods
  where id = p_period_id and tenant_id = v_context.tenant_id
  for update;

  if not found then
    raise exception 'accounting_period_not_found' using errcode = 'P0002';
  end if;

  -- Scope check: Property-scoped context must match period property
  if v_context.scope_type <> 'tenant' and v_context.property_id is not null and v_period.property_id is not null and v_period.property_id <> v_context.property_id then
    raise exception 'property_scope_mismatch' using errcode = '42501';
  end if;

  -- Idempotency check: Cannot close an already closed period
  if v_period.status = 'closed' then
    raise exception 'period_already_closed' using errcode = '40001';
  end if;

  -- 8. Block if draft journals exist in period
  select count(*) into v_draft_count
  from finance.journals j
  where j.tenant_id = v_context.tenant_id
    and (v_period.property_id is null or j.property_id is null or j.property_id = v_period.property_id)
    and j.occurred_on between v_period.starts_on and v_period.ends_on
    and j.status = 'draft';

  if v_draft_count > 0 then
    raise exception 'cannot_close_period_with_draft_journals: % draft journal(s) exist', v_draft_count using errcode = '22023';
  end if;

  -- 9. Block if unbalanced journals exist in period
  select count(*) into v_unbalanced_count
  from (
    select j.id
    from finance.journals j
    join finance.journal_entries e on e.journal_id = j.id
    where j.tenant_id = v_context.tenant_id
      and (v_period.property_id is null or j.property_id is null or j.property_id = v_period.property_id)
      and j.occurred_on between v_period.starts_on and v_period.ends_on
    group by j.id
    having count(e.id) < 2 or sum(case when e.side = 'debit' then e.amount else -e.amount end) <> 0
  ) u;

  if v_unbalanced_count > 0 then
    raise exception 'cannot_close_period_with_unbalanced_journals: % unbalanced journal(s) exist', v_unbalanced_count using errcode = '22023';
  end if;

  -- 10. Generate immutable period snapshot
  v_now := statement_timestamp();

  select
    coalesce(count(*), 0)
  into v_posted_count
  from finance.journals j
  where j.tenant_id = v_context.tenant_id
    and (v_period.property_id is null or j.property_id is null or j.property_id = v_period.property_id)
    and j.occurred_on between v_period.starts_on and v_period.ends_on
    and j.status = 'posted';

  select
    coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0),
    coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0)
  into v_total_debit, v_total_credit
  from finance.journals j
  join finance.journal_entries e on e.journal_id = j.id
  where j.tenant_id = v_context.tenant_id
    and (v_period.property_id is null or j.property_id is null or j.property_id = v_period.property_id)
    and j.occurred_on between v_period.starts_on and v_period.ends_on
    and j.status = 'posted';

  select coalesce(array_agg(distinct j.currency::text), array[]::text[]) into v_currencies
  from finance.journals j
  where j.tenant_id = v_context.tenant_id
    and (v_period.property_id is null or j.property_id is null or j.property_id = v_period.property_id)
    and j.occurred_on between v_period.starts_on and v_period.ends_on;

  -- Snapshot of trial balance at period close
  with entries_agg as (
    select
      e.account_id,
      coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0) as debit,
      coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0) as credit
    from finance.journals j
    join finance.journal_entries e on e.journal_id = j.id
    where j.tenant_id = v_context.tenant_id
      and (v_period.property_id is null or j.property_id is null or j.property_id = v_period.property_id)
      and j.occurred_on between v_period.starts_on and v_period.ends_on
      and j.status = 'posted'
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
  into v_tb_snapshot
  from finance.accounts a
  join entries_agg ea on ea.account_id = a.id
  where a.tenant_id = v_context.tenant_id;

  v_snapshot := jsonb_build_object(
    'period_id', v_period.id,
    'tenant_id', v_period.tenant_id,
    'property_id', v_period.property_id,
    'starts_on', v_period.starts_on,
    'ends_on', v_period.ends_on,
    'closed_at', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'closed_by', auth.uid(),
    'closed_by_role', v_context.role_code,
    'summary', jsonb_build_object(
      'posted_journals_count', v_posted_count,
      'total_debit', v_total_debit,
      'total_credit', v_total_credit,
      'is_balanced', (v_total_debit = v_total_credit),
      'currencies', to_jsonb(v_currencies)
    ),
    'trial_balance', v_tb_snapshot
  );

  -- 11. Atomic update of period status and snapshot
  update finance.accounting_periods
  set status = 'closed',
      closed_at = v_now,
      closed_by = auth.uid(),
      snapshot_json = v_snapshot
  where id = p_period_id;

  -- 12. Record audit event in audit.events
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
    'Accounting period closed with immutable ledger snapshot',
    jsonb_build_object('id', p_period_id, 'status', 'open'),
    jsonb_build_object('id', p_period_id, 'status', 'closed', 'closed_at', v_now, 'closed_by', auth.uid()),
    v_now
  );

  return jsonb_build_object(
    'version', 1,
    'success', true,
    'period_id', p_period_id,
    'status', 'closed',
    'closed_at', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'closed_by', auth.uid(),
    'snapshot', v_snapshot
  );
end;
$$;

-- 7. Secure Privileges
revoke all on function finance.get_close_readiness(uuid, uuid) from public, anon;
revoke all on function finance.get_customer_financial_report(uuid, text, date, date, text) from public, anon;
revoke all on function finance.close_accounting_period(uuid, uuid) from public, anon;

grant execute on function finance.get_close_readiness(uuid, uuid) to authenticated, service_role;
grant execute on function finance.get_customer_financial_report(uuid, text, date, date, text) to authenticated, service_role;
grant execute on function finance.close_accounting_period(uuid, uuid) to authenticated, service_role;

commit;
