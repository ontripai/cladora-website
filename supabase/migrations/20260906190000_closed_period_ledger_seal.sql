begin;

set local search_path = finance, platform, portfolio, extensions, public;

-- =============================================================================
-- 1. PREFLIGHT DATA VALIDATION
-- Enforces zero-tolerance for corrupted, overlapping, or inconsistent records.
-- Aborts immediately if unhealthy data exists. No automated deletion or mutation.
-- =============================================================================
do $$
declare
  v_count int;
begin
  -- Check 1a: Overlapping periods for the same property
  select count(*) into v_count
  from finance.accounting_periods p1
  join finance.accounting_periods p2
    on p1.tenant_id = p2.tenant_id
   and p1.property_id = p2.property_id
   and p1.id <> p2.id
   and daterange(p1.starts_on, p1.ends_on, '[]') && daterange(p2.starts_on, p2.ends_on, '[]')
  where p1.property_id is not null;

  if v_count > 0 then
    raise exception 'Migration preflight check failed: % overlapping property accounting periods found', v_count
      using errcode = '23P01';
  end if;

  -- Check 1b: Overlapping tenant-wide periods
  select count(*) into v_count
  from finance.accounting_periods p1
  join finance.accounting_periods p2
    on p1.tenant_id = p2.tenant_id
   and p1.property_id is null
   and p2.property_id is null
   and p1.id <> p2.id
   and daterange(p1.starts_on, p1.ends_on, '[]') && daterange(p2.starts_on, p2.ends_on, '[]');

  if v_count > 0 then
    raise exception 'Migration preflight check failed: % overlapping tenant-wide accounting periods found', v_count
      using errcode = '23P01';
  end if;

  -- Check 1c: Overlapping tenant-wide and property-specific periods for the same tenant
  select count(*) into v_count
  from finance.accounting_periods p1
  join finance.accounting_periods p2
    on p1.tenant_id = p2.tenant_id
   and p1.property_id is null
   and p2.property_id is not null
   and daterange(p1.starts_on, p1.ends_on, '[]') && daterange(p2.starts_on, p2.ends_on, '[]');

  if v_count > 0 then
    raise exception 'Migration preflight check failed: % overlapping tenant-wide vs property periods found', v_count
      using errcode = '23P01';
  end if;

  -- Check 1d: Structural integrity: entry.tenant_id = journal.tenant_id = account.tenant_id
  select count(*) into v_count
  from finance.journal_entries e
  join finance.journals j on j.id = e.journal_id
  join finance.accounts a on a.id = e.account_id
  where e.tenant_id <> j.tenant_id
     or e.tenant_id <> a.tenant_id;

  if v_count > 0 then
    raise exception 'Migration preflight check failed: % cross-tenant journal entry/account records found', v_count
      using errcode = '42501';
  end if;

  -- Check 1e: Structural integrity: account.property_id IS NOT DISTINCT FROM journal.property_id
  select count(*) into v_count
  from finance.journal_entries e
  join finance.journals j on j.id = e.journal_id
  join finance.accounts a on a.id = e.account_id
  where a.property_id is distinct from j.property_id;

  if v_count > 0 then
    raise exception 'Migration preflight check failed: % journal entries where account property does not match journal property found', v_count
      using errcode = '42501';
  end if;

  -- Check 1f: Structural integrity: account.currency = journal.currency
  select count(*) into v_count
  from finance.journal_entries e
  join finance.journals j on j.id = e.journal_id
  join finance.accounts a on a.id = e.account_id
  where a.currency <> j.currency;

  if v_count > 0 then
    raise exception 'Migration preflight check failed: % journal entries with account/journal currency mismatch found', v_count
      using errcode = '42501';
  end if;

  -- Check 1g: Structural integrity: journal property belongs to same tenant
  select count(*) into v_count
  from finance.journals j
  join portfolio.properties p on p.id = j.property_id
  where j.tenant_id <> p.tenant_id;

  if v_count > 0 then
    raise exception 'Migration preflight check failed: % journals where property does not belong to journal tenant found', v_count
      using errcode = '42501';
  end if;

  -- Check 1h: Structural integrity: unit belongs to same tenant and property
  select count(*) into v_count
  from finance.journal_entries e
  join finance.journals j on j.id = e.journal_id
  join portfolio.units u on u.id = e.unit_id
  join portfolio.buildings b on b.id = u.building_id
  where u.tenant_id <> e.tenant_id
     or (j.property_id is not null and b.property_id <> j.property_id);

  if v_count > 0 then
    raise exception 'Migration preflight check failed: % journal entries with cross-property/cross-tenant unit found', v_count
      using errcode = '42501';
  end if;
end;
$$;

-- =============================================================================
-- 2. GIST EXCLUSION CONSTRAINTS FOR PERIOD OVERLAP PREVENTION
-- Guarantees race-free physical exclusion of overlapping date ranges using GiST.
-- =============================================================================

-- Property-specific periods cannot overlap with other periods of the SAME property:
alter table finance.accounting_periods
drop constraint if exists accounting_periods_property_no_overlap;

alter table finance.accounting_periods
add constraint accounting_periods_property_no_overlap
exclude using gist (
  tenant_id with =,
  property_id with =,
  (daterange(starts_on, ends_on, '[]'::text)) with &&
) where (property_id is not null);

-- Tenant-wide periods cannot overlap with other tenant-wide periods of the SAME tenant:
alter table finance.accounting_periods
drop constraint if exists accounting_periods_tenant_no_overlap;

alter table finance.accounting_periods
add constraint accounting_periods_tenant_no_overlap
exclude using gist (
  tenant_id with =,
  (daterange(starts_on, ends_on, '[]'::text)) with &&
) where (property_id is null);

-- =============================================================================
-- 3. CROSS-SCOPE OVERLAP PREVENTION WITH ROW-LEVEL TENANT SERIALIZATION
-- Enforces policy:
-- 1) Tenant-wide period cannot overlap with ANY period (tenant or property) of the same tenant.
-- 2) Property periods of DIFFERENT properties CAN be concurrent.
-- Locks parent tenant row FOR UPDATE to eliminate concurrent insertion race conditions.
-- =============================================================================
create or replace function finance.assert_accounting_period_no_overlap()
returns trigger
language plpgsql
set search_path = finance, platform, extensions, public
as $$
declare
  v_overlap_count int;
begin
  -- Serialize concurrent period operations for the same tenant
  perform 1
  from platform.tenants
  where id = new.tenant_id
  for update;

  -- Rule A: Tenant-wide period must not overlap with ANY period of the same tenant
  if new.property_id is null then
    select count(*) into v_overlap_count
    from finance.accounting_periods p
    where p.tenant_id = new.tenant_id
      and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and daterange(p.starts_on, p.ends_on, '[]') && daterange(new.starts_on, new.ends_on, '[]');

    if v_overlap_count > 0 then
      raise exception 'Tenant-wide accounting period cannot overlap with any tenant or property period'
        using errcode = '23P01';
    end if;
  else
    -- Rule B: Property-specific period must not overlap with any tenant-wide period of the same tenant
    select count(*) into v_overlap_count
    from finance.accounting_periods p
    where p.tenant_id = new.tenant_id
      and p.property_id is null
      and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and daterange(p.starts_on, p.ends_on, '[]') && daterange(new.starts_on, new.ends_on, '[]');

    if v_overlap_count > 0 then
      raise exception 'Property accounting period cannot overlap with existing tenant-wide period'
        using errcode = '23P01';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assert_accounting_period_no_overlap on finance.accounting_periods;
create trigger trg_assert_accounting_period_no_overlap
before insert or update on finance.accounting_periods
for each row
execute function finance.assert_accounting_period_no_overlap();

-- =============================================================================
-- 4. ROW-LEVEL FOR SHARE LOCKING & PERIOD STATUS VALIDATION
-- Locks covering periods FOR SHARE to coordinate deterministically against
-- close_accounting_period's FOR UPDATE lock. Fails closed if multiple periods match.
-- =============================================================================
create or replace function finance.assert_scope_date_not_in_closed_period(
  p_tenant_id uuid,
  p_property_id uuid,
  p_occurred_on date
)
returns void
language plpgsql
set search_path = finance, platform, extensions, public
as $$
declare
  v_total_matching int;
  v_closed_matching int;
begin
  -- Lock matching periods FOR SHARE until the end of the current transaction.
  -- This shared lock coordinates with close_accounting_period's FOR UPDATE lock:
  -- - If Journal runs first: holds SHARE lock -> Close blocks and waits -> Close unblocks and sees Journal.
  -- - If Close runs first: holds UPDATE lock -> Journal blocks and waits -> Journal unblocks and is rejected.
  select count(*),
         count(*) filter (where status = 'closed')
  into v_total_matching, v_closed_matching
  from finance.accounting_periods
  where tenant_id = p_tenant_id
    and (
      (p_property_id is null and property_id is null)
      or
      (p_property_id is not null and (property_id = p_property_id or property_id is null))
    )
    and daterange(starts_on, ends_on, '[]') @> p_occurred_on
  for share;

  -- Fail-closed if multiple periods match: at most one period may match any journal date
  if v_total_matching > 1 then
    raise exception 'Ambiguous accounting period matching: multiple covering periods found for date %', p_occurred_on
      using errcode = '23P01';
  end if;

  -- Fail-closed if the matching period is closed
  if v_closed_matching > 0 then
    raise exception 'Cannot modify journal or entry in closed accounting period (date: %)', p_occurred_on
      using errcode = '25000';
  end if;
end;
$$;

-- =============================================================================
-- 5. JOURNAL TRIGGER: INSERT, UPDATE, DELETE COVERAGE & BOTH OLD/NEW CHECKS
-- =============================================================================
create or replace function finance.assert_journal_not_in_closed_period()
returns trigger
language plpgsql
set search_path = finance, portfolio, platform, public
as $$
declare
  v_p_tenant_id uuid;
begin
  if tg_op = 'INSERT' then
    -- Verify property belongs to journal tenant
    if new.property_id is not null then
      select tenant_id into v_p_tenant_id from portfolio.properties where id = new.property_id;
      if v_p_tenant_id is null or v_p_tenant_id <> new.tenant_id then
        raise exception 'Cross-tenant property denied: property % does not belong to tenant %', new.property_id, new.tenant_id
          using errcode = '42501';
      end if;
    end if;

    perform finance.assert_scope_date_not_in_closed_period(new.tenant_id, new.property_id, new.occurred_on);
    return new;

  elsif tg_op = 'DELETE' then
    -- Verify OLD scope/date was not in a closed period
    perform finance.assert_scope_date_not_in_closed_period(old.tenant_id, old.property_id, old.occurred_on);
    return old;

  elsif tg_op = 'UPDATE' then
    -- Verify OLD scope/date was not in a closed period
    perform finance.assert_scope_date_not_in_closed_period(old.tenant_id, old.property_id, old.occurred_on);

    -- Verify property belongs to journal tenant on NEW
    if new.property_id is not null then
      select tenant_id into v_p_tenant_id from portfolio.properties where id = new.property_id;
      if v_p_tenant_id is null or v_p_tenant_id <> new.tenant_id then
        raise exception 'Cross-tenant property denied: property % does not belong to tenant %', new.property_id, new.tenant_id
          using errcode = '42501';
      end if;
    end if;

    -- Verify NEW scope/date is not in a closed period
    perform finance.assert_scope_date_not_in_closed_period(new.tenant_id, new.property_id, new.occurred_on);
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_assert_journal_not_in_closed_period on finance.journals;
create trigger trg_assert_journal_not_in_closed_period
before insert or update or delete on finance.journals
for each row
execute function finance.assert_journal_not_in_closed_period();

-- =============================================================================
-- 6. ENTRY TRIGGER: PREVENTS MUTATING ENTRIES IN CLOSED PERIOD JOURNALS
-- Checks both OLD and NEW parent journals on UPDATE and DELETE.
-- =============================================================================
create or replace function finance.assert_journal_entry_closed_period()
returns trigger
language plpgsql
set search_path = finance, platform, public
as $$
declare
  v_j_old record;
  v_j_new record;
begin
  if tg_op = 'INSERT' then
    select tenant_id, property_id, occurred_on
    into v_j_new
    from finance.journals
    where id = new.journal_id;

    if found then
      perform finance.assert_scope_date_not_in_closed_period(v_j_new.tenant_id, v_j_new.property_id, v_j_new.occurred_on);
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    select tenant_id, property_id, occurred_on
    into v_j_old
    from finance.journals
    where id = old.journal_id;

    if found then
      perform finance.assert_scope_date_not_in_closed_period(v_j_old.tenant_id, v_j_old.property_id, v_j_old.occurred_on);
    end if;
    return old;

  elsif tg_op = 'UPDATE' then
    -- Check old parent journal
    select tenant_id, property_id, occurred_on
    into v_j_old
    from finance.journals
    where id = old.journal_id;

    if found then
      perform finance.assert_scope_date_not_in_closed_period(v_j_old.tenant_id, v_j_old.property_id, v_j_old.occurred_on);
    end if;

    -- If journal_id changed or updating entry, check new parent journal as well
    if new.journal_id <> old.journal_id then
      select tenant_id, property_id, occurred_on
      into v_j_new
      from finance.journals
      where id = new.journal_id;

      if found then
        perform finance.assert_scope_date_not_in_closed_period(v_j_new.tenant_id, v_j_new.property_id, v_j_new.occurred_on);
      end if;
    end if;

    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_assert_journal_entry_closed_period on finance.journal_entries;
create trigger trg_assert_journal_entry_closed_period
before insert or update or delete on finance.journal_entries
for each row
execute function finance.assert_journal_entry_closed_period();

-- =============================================================================
-- 7. STRUCTURAL CONSISTENCY ENFORCEMENT ON JOURNAL ENTRIES
-- Enforces:
-- 1) entry.tenant_id = journal.tenant_id = account.tenant_id
-- 2) account.property_id IS NOT DISTINCT FROM journal.property_id
-- 3) account.currency = journal.currency
-- 4) Property belongs to same tenant
-- 5) Unit belongs to same tenant and journal property
-- =============================================================================
create or replace function finance.assert_journal_entry_integrity()
returns trigger
language plpgsql
set search_path = finance, portfolio, platform, public
as $$
declare
  v_j record;
  v_a record;
  v_u record;
begin
  select id, tenant_id, property_id, currency, status, occurred_on
  into v_j
  from finance.journals
  where id = new.journal_id;

  if not found then
    raise exception 'Journal % not found', new.journal_id
      using errcode = '23503';
  end if;

  select id, tenant_id, property_id, currency, is_active
  into v_a
  from finance.accounts
  where id = new.account_id;

  if not found then
    raise exception 'Account % not found', new.account_id
      using errcode = '23503';
  end if;

  -- 1. entry.tenant_id = journal.tenant_id = account.tenant_id
  if new.tenant_id <> v_j.tenant_id or new.tenant_id <> v_a.tenant_id then
    raise exception 'Cross-tenant journal entry denied: tenant mismatch between entry (%), journal (%), and account (%)',
      new.tenant_id, v_j.tenant_id, v_a.tenant_id
      using errcode = '42501';
  end if;

  -- 2. account.property_id IS NOT DISTINCT FROM journal.property_id
  if v_a.property_id is distinct from v_j.property_id then
    raise exception 'Cross-property journal entry denied: account property (%) does not match journal property (%)',
      v_a.property_id, v_j.property_id
      using errcode = '42501';
  end if;

  -- 3. account.currency = journal.currency
  if v_a.currency <> v_j.currency then
    raise exception 'Journal currency mismatch: account currency (%) does not match journal currency (%)',
      v_a.currency, v_j.currency
      using errcode = '42501';
  end if;

  -- 4. If unit_id is provided, unit must belong to journal tenant and property
  if new.unit_id is not null then
    select u.id, u.tenant_id, b.property_id
    into v_u
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = new.unit_id;

    if not found then
      raise exception 'Unit % not found', new.unit_id
        using errcode = '23503';
    end if;

    if v_u.tenant_id <> new.tenant_id then
      raise exception 'Cross-tenant unit entry denied: unit tenant (%) does not match entry tenant (%)',
        v_u.tenant_id, new.tenant_id
        using errcode = '42501';
    end if;

    if v_j.property_id is not null and v_u.property_id <> v_j.property_id then
      raise exception 'Cross-property unit entry denied: unit property (%) does not match journal property (%)',
        v_u.property_id, v_j.property_id
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assert_journal_entry_integrity on finance.journal_entries;
create trigger trg_assert_journal_entry_integrity
before insert or update on finance.journal_entries
for each row
execute function finance.assert_journal_entry_integrity();

-- =============================================================================
-- 8. DETERMINISTIC CURRENCY SORTING IN GET_CLOSE_READINESS
-- Re-defines finance.get_close_readiness with explicit ORDER BY cs.currency ASC
-- directly within jsonb_agg(...).
-- =============================================================================
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

  -- Per-currency summary with deterministic ordering
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
    ) order by cs.currency asc), '[]'::jsonb),
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
  end if;

  if v_has_unclosed_preceding then
    v_blocking_reasons := array_append(v_blocking_reasons, 'preceding_periods_unclosed');
  end if;

  if v_draft_count > 0 then
    v_blocking_reasons := array_append(v_blocking_reasons, 'has_draft_journals');
  end if;

  if v_unbalanced_count > 0 then
    v_blocking_reasons := array_append(v_blocking_reasons, 'has_unbalanced_journals');
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

-- =============================================================================
-- 9. PERMISSIONS & GRANTS
-- =============================================================================
revoke all on function finance.assert_scope_date_not_in_closed_period(uuid, uuid, date) from public, anon;
grant execute on function finance.assert_scope_date_not_in_closed_period(uuid, uuid, date) to authenticated, service_role;

revoke all on function finance.get_close_readiness(uuid, uuid) from public, anon;
grant execute on function finance.get_close_readiness(uuid, uuid) to authenticated, service_role;

commit;
