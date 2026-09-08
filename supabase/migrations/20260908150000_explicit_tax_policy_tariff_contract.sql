-- Migration 72: Explicit Tax Policy & Tariff Contract Hardening
-- Scope: Remove implicit 19% default from public contract, enforce explicit non-null tax_rate,
--        range validation (0 <= tax_rate <= 1), tariff immutability after billing,
--        deterministic error contract (tax_rate_required, tax_rate_out_of_range),
--        and error-only compatibility overload for omitted tax_rate argument.
-- Forward-only: Migration 71 remains untouched. Zero customer/fixture DML.

begin;

-- =============================================================================
-- 1. Table Schema Hardening: Drop Column Default & Enforce Constraint
-- =============================================================================

alter table utilities.tariffs
  alter column tax_rate drop default;

alter table utilities.tariffs
  alter column tax_rate set not null;

-- Ensure check constraint on range 0 <= tax_rate <= 1
alter table utilities.tariffs
  drop constraint if exists tariffs_tax_rate_check;

alter table utilities.tariffs
  add constraint tariffs_tax_rate_check
  check (tax_rate >= 0 and tax_rate <= 1);

-- =============================================================================
-- 2. Tariff Immutability After Billing Linkage
-- =============================================================================

create or replace function utilities.protect_tariff_immutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, utilities
as $$
begin
  if tg_op = 'UPDATE' then
    if (
      OLD.unit_rate is distinct from NEW.unit_rate or
      OLD.tax_rate is distinct from NEW.tax_rate or
      OLD.fixed_charge is distinct from NEW.fixed_charge or
      OLD.currency is distinct from NEW.currency or
      OLD.service_type is distinct from NEW.service_type or
      OLD.property_id is distinct from NEW.property_id or
      OLD.valid_from is distinct from NEW.valid_from
    ) then
      if exists (
        select 1 from utilities.consumption_periods
        where tariff_id = OLD.id
      ) then
        raise exception 'tariff_immutable_after_billing' using errcode = '42501';
      end if;
    end if;
  elsif tg_op = 'DELETE' then
    if exists (
      select 1 from utilities.consumption_periods
      where tariff_id = OLD.id
    ) then
      raise exception 'tariff_immutable_after_billing' using errcode = '42501';
    end if;
    return OLD;
  end if;

  return NEW;
end;
$$;

drop trigger if exists tariffs_protect_immutability on utilities.tariffs;
create trigger tariffs_protect_immutability
  before update or delete on utilities.tariffs
  for each row
  execute function utilities.protect_tariff_immutability();

-- =============================================================================
-- 3. Drop Obsolete Routine Signatures with Default 0.19
-- =============================================================================

drop function if exists customer_api.create_tariff_v1(uuid,uuid,text,text,text,numeric,numeric,numeric,text,date,date,text);
drop function if exists utilities.create_tariff(uuid,uuid,utilities.service_type,text,text,numeric,numeric,numeric,text,date,date,text);
drop function if exists customer_api.create_tariff_v1(uuid,uuid,text,text,text,numeric);
drop function if exists utilities.create_tariff(uuid,uuid,utilities.service_type,text,text,numeric);

-- =============================================================================
-- 4. Recreate Domain Function: utilities.create_tariff (Explicit Required Tax Rate)
-- =============================================================================

create or replace function utilities.create_tariff(
  p_context_id uuid,
  p_property_id uuid,
  p_service_type utilities.service_type,
  p_tariff_code text,
  p_name text,
  p_unit_rate numeric,
  p_tax_rate numeric,                 -- Explicit required, no default!
  p_fixed_charge numeric default 0,
  p_currency text default 'RON',
  p_valid_from date default current_date,
  p_valid_to date default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_tariff_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- Deterministic Tax Policy Validation: Explicit non-null and in range [0, 1]
  if p_tax_rate is null then
    raise exception 'tax_rate_required' using errcode = '22004';
  end if;

  if p_tax_rate < 0 or p_tax_rate > 1 then
    raise exception 'tax_rate_out_of_range' using errcode = '22003';
  end if;

  if p_unit_rate is null or p_unit_rate < 0 then
    raise exception 'invalid_unit_rate' using errcode = '22003';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  insert into utilities.tariffs (
    tenant_id, property_id, service_type, tariff_code, name,
    unit_rate, fixed_charge, tax_rate, currency, valid_from, valid_to, description
  ) values (
    v.tenant_id, p_property_id, p_service_type, upper(trim(p_tariff_code)), p_name,
    p_unit_rate, coalesce(p_fixed_charge, 0), p_tax_rate, upper(trim(coalesce(p_currency, 'RON'))),
    coalesce(p_valid_from, current_date), p_valid_to, p_description
  ) returning id into v_tariff_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'TARIFF_CREATED', 'tariff', v_tariff_id,
    'Tariff created with explicit tax policy',
    jsonb_build_object(
      'tariff_id', v_tariff_id,
      'tariff_code', upper(trim(p_tariff_code)),
      'unit_rate', p_unit_rate,
      'tax_rate', p_tax_rate,
      'fixed_charge', coalesce(p_fixed_charge, 0)
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'tariff_id', v_tariff_id,
    'tariff_code', upper(trim(p_tariff_code)),
    'unit_rate', p_unit_rate,
    'tax_rate', p_tax_rate
  );
end;
$$;

-- Optional error-only compatibility overload: Calling utilities.create_tariff without tax_rate
create or replace function utilities.create_tariff(
  p_context_id uuid,
  p_property_id uuid,
  p_service_type utilities.service_type,
  p_tariff_code text,
  p_name text,
  p_unit_rate numeric
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'tax_rate_required' using errcode = '22004';
end;
$$;

-- =============================================================================
-- 5. Recreate Gateway Wrapper: customer_api.create_tariff_v1
-- =============================================================================

create or replace function customer_api.create_tariff_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_service_type text,
  p_tariff_code text,
  p_name text,
  p_unit_rate numeric,
  p_tax_rate numeric,                 -- Explicit required, no default!
  p_fixed_charge numeric default 0,
  p_currency text default 'RON',
  p_valid_from date default current_date,
  p_valid_to date default null,
  p_description text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.create_tariff(
    p_context_id, p_property_id, p_service_type::utilities.service_type, p_tariff_code,
    p_name, p_unit_rate, p_tax_rate, p_fixed_charge, p_currency, p_valid_from, p_valid_to, p_description
  );
end;
$$;

-- Optional error-only compatibility overload: Calling customer_api.create_tariff_v1 without tax_rate
create or replace function customer_api.create_tariff_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_service_type text,
  p_tariff_code text,
  p_name text,
  p_unit_rate numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'tax_rate_required' using errcode = '22004';
end;
$$;

-- =============================================================================
-- 6. Explicit Routine Grants & Execution Permissions
-- =============================================================================

revoke all on function utilities.create_tariff(uuid,uuid,utilities.service_type,text,text,numeric,numeric,numeric,text,date,date,text) from public, anon;
grant execute on function utilities.create_tariff(uuid,uuid,utilities.service_type,text,text,numeric,numeric,numeric,text,date,date,text) to authenticated;

revoke all on function utilities.create_tariff(uuid,uuid,utilities.service_type,text,text,numeric) from public, anon;
grant execute on function utilities.create_tariff(uuid,uuid,utilities.service_type,text,text,numeric) to authenticated;

revoke all on function customer_api.create_tariff_v1(uuid,uuid,text,text,text,numeric,numeric,numeric,text,date,date,text) from public, anon;
grant execute on function customer_api.create_tariff_v1(uuid,uuid,text,text,text,numeric,numeric,numeric,text,date,date,text) to authenticated;

revoke all on function customer_api.create_tariff_v1(uuid,uuid,text,text,text,numeric) from public, anon;
grant execute on function customer_api.create_tariff_v1(uuid,uuid,text,text,text,numeric) to authenticated;

commit;
