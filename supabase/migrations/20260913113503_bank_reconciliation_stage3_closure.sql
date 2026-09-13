begin;

-- CLADORA-P2-BANK-003: fail-closed Stage 3 reconciliation finalization.
-- This guard is attached to the canonical session table so every current and
-- future finalization entry point is subject to the same accounting boundary.

create unique index if not exists reconciliation_sessions_reconciled_period_uidx
  on payments.reconciliation_sessions (tenant_id, bank_account_id, period_start, period_end)
  where status = 'reconciled';

create or replace function app_private.guard_bank_reconciliation_finalization_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, payments
as $$
declare
  v_opening numeric(20,4) := 0;
  v_credits numeric(20,4) := 0;
  v_debits numeric(20,4) := 0;
  v_calculated_closing numeric(20,4);
begin
  if new.status <> 'reconciled' then
    return new;
  end if;

  if new.period_end < new.period_start then
    raise exception 'invalid_reconciliation_period' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from payments.bank_accounts a
    where a.id = new.bank_account_id
      and a.tenant_id = new.tenant_id
  ) then
    raise exception 'bank_account_not_found' using errcode = '22023';
  end if;

  -- Serialize all finalizers that cover the same committed bank rows. The
  -- partial unique index above elects exactly one winner for an identical
  -- tenant/account/period when a period contains no transactions to lock.
  perform bt.id
  from payments.bank_transactions bt
  where bt.tenant_id = new.tenant_id
    and bt.bank_account_id = new.bank_account_id
    and bt.booked_on between new.period_start and new.period_end
  order by bt.id
  for update;

  if exists (
    select 1
    from payments.reconciliation_matches rm
    join payments.bank_transactions bt on bt.id = rm.bank_transaction_id
    where rm.tenant_id = new.tenant_id
      and bt.tenant_id = new.tenant_id
      and bt.bank_account_id = new.bank_account_id
      and bt.booked_on between new.period_start and new.period_end
      and rm.status = 'suggested'
  ) then
    raise exception 'reconciliation_match_approval_pending' using errcode = '55000';
  end if;

  if exists (
    select 1
    from payments.reconciliation_exceptions re
    join payments.bank_transactions bt on bt.id = re.bank_transaction_id
    where re.tenant_id = new.tenant_id
      and bt.tenant_id = new.tenant_id
      and bt.bank_account_id = new.bank_account_id
      and bt.booked_on between new.period_start and new.period_end
      and re.status in ('open', 'pending_approval')
  ) then
    raise exception 'reconciliation_exception_unresolved' using errcode = '55000';
  end if;

  if exists (
    select 1
    from payments.bank_transactions bt
    where bt.tenant_id = new.tenant_id
      and bt.bank_account_id = new.bank_account_id
      and bt.booked_on between new.period_start and new.period_end
      and bt.direction = 'credit'
      and coalesce((
        select sum(rm.matched_amount)
        from payments.reconciliation_matches rm
        where rm.tenant_id = new.tenant_id
          and rm.bank_transaction_id = bt.id
          and rm.status = 'confirmed'
      ), 0) < bt.amount
  ) then
    raise exception 'reconciliation_unmatched_credit_remaining' using errcode = '55000';
  end if;

  select rs.closing_balance
  into v_opening
  from payments.reconciliation_sessions rs
  where rs.tenant_id = new.tenant_id
    and rs.bank_account_id = new.bank_account_id
    and rs.status = 'reconciled'
    and rs.id <> new.id
  order by rs.period_end desc, rs.created_at desc
  limit 1;

  v_opening := coalesce(v_opening, 0);

  select
    coalesce(sum(bt.amount) filter (where bt.direction = 'credit'), 0),
    coalesce(sum(bt.amount) filter (where bt.direction = 'debit'), 0)
  into v_credits, v_debits
  from payments.bank_transactions bt
  where bt.tenant_id = new.tenant_id
    and bt.bank_account_id = new.bank_account_id
    and bt.booked_on between new.period_start and new.period_end;

  v_calculated_closing := v_opening + v_credits - v_debits;
  if abs(new.closing_balance - v_calculated_closing) <> 0 then
    raise exception 'reconciliation_difference_must_be_zero' using errcode = '22023';
  end if;

  -- Canonical values cannot be supplied inconsistently through a new entry
  -- point. The guard always derives them from the immutable bank register.
  new.opening_balance := v_opening;
  new.total_credits := v_credits;
  new.total_debits := v_debits;
  new.difference := 0;
  return new;
end $$;

revoke all on function app_private.guard_bank_reconciliation_finalization_v1() from public, anon, authenticated;

drop trigger if exists guard_bank_reconciliation_finalization on payments.reconciliation_sessions;
create trigger guard_bank_reconciliation_finalization
before insert or update on payments.reconciliation_sessions
for each row execute function app_private.guard_bank_reconciliation_finalization_v1();

commit;
