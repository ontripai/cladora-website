-- Migration 68: Billing, Charges & Receivables Vertical Slice
-- Scope: Full production billing lifecycle, accounting integration with double-entry balanced journals,
--        role-based security, customer API wrappers, and audit trail.

begin;

-- 1. Add idempotency_key column to billing.invoices if not present
alter table billing.invoices
  add column if not exists idempotency_key text;

create unique index if not exists invoices_tenant_idempotency_idx
  on billing.invoices (tenant_id, idempotency_key)
  where idempotency_key is not null;

-- Composite performance indexes
create index if not exists invoices_tenant_status_due_idx
  on billing.invoices (tenant_id, status, due_on desc);

create index if not exists invoices_tenant_unit_party_idx
  on billing.invoices (tenant_id, unit_id, liable_party_id);

create index if not exists receivables_tenant_invoice_idx
  on billing.receivables (tenant_id, invoice_id);

-- 2. Define permissions and role assignments
insert into identity.permissions (code, resource, action, description)
values
  ('billing.manage', 'billing.invoices', 'manage', 'Create and update draft billing invoices and line items'),
  ('billing.issue', 'billing.invoices', 'issue', 'Issue billing invoices and post balanced accounting journals'),
  ('billing.cancel', 'billing.invoices', 'cancel', 'Cancel and void billing invoices and reverse accounting journals')
on conflict (code) do update set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description;

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'::platform.decision_effect
from identity.roles r
cross join identity.permissions p
where lower(r.code) in ('association_admin', 'property_manager')
  and p.code in ('billing.manage', 'billing.issue', 'billing.cancel')
on conflict (role_id, permission_id) do update set effect = 'allow';

-- 3. Enhanced billing.get_customer_billing: Supports draft invoices, status filtering, and dynamic read_only
create or replace function billing.get_customer_billing(
  p_context_id uuid,
  p_query text default null::text,
  p_status text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_invoice_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'billing', 'identity', 'platform', 'portfolio', 'occupancy', 'finance'
as $function$
declare
  v record;
  v_workspace uuid;
  v_party uuid;
  v_is_resident boolean;
  v_is_tenant boolean;
  v_total bigint;
  v_rows jsonb;
  v_summary jsonb;
  v_aging jsonb;
  v_lines jsonb;
  v_journal jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid_pagination' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('draft', 'issued', 'partially_paid', 'paid', 'void', 'credited', 'overdue') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code, r.name as role_name, t.legal_name as tenant_name
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(v.role_code) not in ('association_admin', 'property_manager', 'president', 'censor', 'owner', 'tenant_resident') then
    raise exception 'billing_role_denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code = 'billing.receivables.read'
  ) then
    raise exception 'billing_permission_required' using errcode = '42501';
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.billing'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'billing_entitlement_required' using errcode = '42501';
  end if;

  v_is_resident := lower(v.role_code) in ('owner', 'tenant_resident');
  v_is_tenant := lower(v.role_code) = 'tenant_resident';

  if v_is_resident then
    if v.scope_type <> 'unit' then raise exception 'resident_unit_context_required' using errcode = '42501'; end if;
    select mp.party_id into v_party
    from identity.membership_parties mp
    where mp.membership_id = v.membership_key and mp.tenant_id = v.tenant_id;
    if v_party is null then raise exception 'resident_party_mapping_required' using errcode = '42501'; end if;
    if not v_is_tenant and not exists (
      select 1 from portfolio.ownerships o
      where o.tenant_id = v.tenant_id and o.unit_id = v.unit_id and o.party_id = v_party
        and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date)
    ) then
      raise exception 'ownership_required' using errcode = '42501';
    end if;
    if v_is_tenant and not exists (
      select 1 from occupancy.leases l
      where l.tenant_id = v.tenant_id and l.unit_id = v.unit_id and l.tenant_party_id = v_party
        and l.status = 'active' and l.starts_on <= current_date and (l.ends_on is null or l.ends_on > current_date)
    ) then
      raise exception 'active_lease_required' using errcode = '42501';
    end if;
  end if;

  -- Visible invoices: LEFT JOIN with receivables so draft invoices are visible!
  with visible as (
    select
      i.*,
      coalesce(r.original_amount, i.total) as original_amount,
      coalesce(r.paid_amount, 0) as paid_amount,
      coalesce(r.credited_amount, 0) as credited_amount,
      case
        when i.status = 'draft' then i.total
        when i.status in ('void', 'credited') then 0
        else greatest(coalesce(r.original_amount, i.total) - coalesce(r.paid_amount, 0) - coalesce(r.credited_amount, 0), 0)
      end as outstanding_amount,
      j.journal_no,
      p.name as property_name,
      u.code as unit_code,
      pt.legal_name as liable_party_name
    from billing.invoices i
    left join billing.receivables r on r.invoice_id = i.id and r.tenant_id = i.tenant_id
    left join finance.journals j on j.id = i.journal_id and j.tenant_id = i.tenant_id
    left join portfolio.properties p on p.id = i.property_id
    left join portfolio.units u on u.id = i.unit_id
    left join portfolio.parties pt on pt.id = i.liable_party_id
    where i.tenant_id = v.tenant_id
      and (v.scope_type = 'tenant'
        or i.property_id = v.property_id
        or i.property_id = (select b.property_id from portfolio.buildings b where b.id = v.building_id and b.tenant_id = v.tenant_id)
        or (v.scope_type = 'unit' and i.unit_id = v.unit_id))
      and (not v_is_resident or (i.unit_id = v.unit_id and (not v_is_tenant or i.liable_party_id = v_party)))
      and (not v_is_resident or i.status <> 'draft') -- Draft bills only visible to management
  ),
  filtered as (
    select * from visible x
    where (p_invoice_id is null or x.id = p_invoice_id)
      and (p_status is null
        or (p_status = 'overdue' and x.due_on < current_date and x.outstanding_amount > 0 and x.status = 'issued')
        or (p_status <> 'overdue' and x.status::text = p_status))
      and (p_from is null or coalesce(x.issued_on, x.period_start) >= p_from)
      and (p_to is null or coalesce(x.issued_on, x.period_end) <= p_to)
      and (p_query is null or length(trim(p_query)) = 0
        or x.invoice_no::text ilike '%' || trim(p_query) || '%'
        or x.unit_code ilike '%' || trim(p_query) || '%'
        or x.liable_party_name ilike '%' || trim(p_query) || '%'
        or exists (select 1 from billing.invoice_lines l where l.invoice_id = x.id and l.description ilike '%' || trim(p_query) || '%'))
  ),
  page as (
    select *, count(*) over() as total_count
    from filtered
    order by coalesce(due_on, period_end) desc, invoice_no desc
    limit p_limit offset p_offset
  )
  select
    coalesce(max(total_count), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'invoice_no', invoice_no,
      'property_id', property_id,
      'property_name', property_name,
      'unit_id', unit_id,
      'unit_code', unit_code,
      'liable_party_id', liable_party_id,
      'liable_party_name', liable_party_name,
      'period_start', period_start,
      'period_end', period_end,
      'issued_on', issued_on,
      'due_on', due_on,
      'currency', currency,
      'subtotal', subtotal,
      'tax_total', tax_total,
      'total', total,
      'status', status,
      'original_amount', original_amount,
      'paid_amount', paid_amount,
      'credited_amount', credited_amount,
      'outstanding_amount', outstanding_amount,
      'overdue', (status = 'issued' and due_on < current_date and outstanding_amount > 0),
      'journal_id', journal_id,
      'journal_no', journal_no
    ) order by coalesce(due_on, period_end) desc, invoice_no desc), '[]'::jsonb)
  into v_total, v_rows
  from page;

  -- Summary grouping per currency
  with scoped as (
    select
      i.currency,
      i.status,
      i.total,
      i.due_on,
      coalesce(r.paid_amount, 0) as paid_amount,
      case
        when i.status = 'draft' then i.total
        when i.status in ('void', 'credited') then 0
        else greatest(coalesce(r.original_amount, i.total) - coalesce(r.paid_amount, 0) - coalesce(r.credited_amount, 0), 0)
      end as outstanding
    from billing.invoices i
    left join billing.receivables r on r.invoice_id = i.id and r.tenant_id = i.tenant_id
    where i.tenant_id = v.tenant_id
      and (v.scope_type = 'tenant'
        or i.property_id = v.property_id
        or i.property_id = (select b.property_id from portfolio.buildings b where b.id = v.building_id and b.tenant_id = v.tenant_id)
        or (v.scope_type = 'unit' and i.unit_id = v.unit_id))
      and (not v_is_resident or (i.unit_id = v.unit_id and (not v_is_tenant or i.liable_party_id = v_party)))
      and (not v_is_resident or i.status <> 'draft')
  ),
  grouped as (
    select
      currency,
      coalesce(sum(total) filter(where status not in ('draft', 'void', 'credited')), 0) as invoice_total,
      coalesce(sum(paid_amount), 0) as paid_total,
      coalesce(sum(outstanding) filter(where status not in ('draft', 'void', 'credited')), 0) as outstanding_total,
      coalesce(sum(outstanding) filter(where status = 'issued' and due_on < current_date), 0) as overdue_total,
      count(*) filter(where status not in ('draft', 'void', 'credited')) as invoice_count,
      count(*) filter(where status = 'draft') as draft_count,
      count(*) filter(where status = 'issued') as issued_count,
      count(*) filter(where status = 'partially_paid') as partially_paid_count,
      count(*) filter(where status = 'paid') as paid_count,
      count(*) filter(where status = 'issued' and due_on < current_date and outstanding > 0) as overdue_count,
      count(*) filter(where status in ('void', 'credited')) as void_count
    from scoped
    group by currency
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'currency', currency,
    'invoice_total', invoice_total,
    'paid_total', paid_total,
    'outstanding_total', outstanding_total,
    'overdue_total', overdue_total,
    'invoice_count', invoice_count,
    'draft_count', draft_count,
    'issued_count', issued_count,
    'partially_paid_count', partially_paid_count,
    'paid_count', paid_count,
    'overdue_count', overdue_count,
    'void_count', void_count
  ) order by currency), '[]'::jsonb)
  into v_summary
  from grouped;

  -- Aging calculation per currency
  with scoped as (
    select
      i.currency,
      i.due_on,
      greatest(coalesce(r.original_amount, i.total) - coalesce(r.paid_amount, 0) - coalesce(r.credited_amount, 0), 0) as outstanding
    from billing.invoices i
    join billing.receivables r on r.invoice_id = i.id and r.tenant_id = i.tenant_id
    where i.tenant_id = v.tenant_id
      and (v.scope_type = 'tenant'
        or i.property_id = v.property_id
        or i.property_id = (select b.property_id from portfolio.buildings b where b.id = v.building_id and b.tenant_id = v.tenant_id)
        or (v.scope_type = 'unit' and i.unit_id = v.unit_id))
      and (not v_is_resident or (i.unit_id = v.unit_id and (not v_is_tenant or i.liable_party_id = v_party)))
      and i.status not in ('draft', 'void', 'credited')
  ),
  grouped as (
    select
      currency,
      coalesce(sum(outstanding) filter(where due_on is null or due_on >= current_date), 0) as current_amount,
      coalesce(sum(outstanding) filter(where current_date - due_on between 1 and 30), 0) as days_1_30,
      coalesce(sum(outstanding) filter(where current_date - due_on between 31 and 60), 0) as days_31_60,
      coalesce(sum(outstanding) filter(where current_date - due_on between 61 and 90), 0) as days_61_90,
      coalesce(sum(outstanding) filter(where current_date - due_on > 90), 0) as days_90_plus
    from scoped
    group by currency
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'currency', currency,
    'current', current_amount,
    'days_1_30', days_1_30,
    'days_31_60', days_31_60,
    'days_61_90', days_61_90,
    'days_90_plus', days_90_plus
  ) order by currency), '[]'::jsonb)
  into v_aging
  from grouped;

  -- Specific invoice details if requested
  if p_invoice_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'description', l.description,
      'quantity', l.quantity,
      'unit_price', l.unit_price,
      'tax_rate', l.tax_rate,
      'line_subtotal', l.line_subtotal,
      'line_tax', l.line_tax,
      'category_id', l.category_id
    ) order by l.created_at, l.id), '[]'::jsonb)
    into v_lines
    from billing.invoice_lines l
    join billing.invoices i on i.id = l.invoice_id
    where l.invoice_id = p_invoice_id and i.tenant_id = v.tenant_id
      and (v.scope_type = 'tenant' or i.property_id = v.property_id
        or i.property_id = (select b.property_id from portfolio.buildings b where b.id = v.building_id)
        or (v.scope_type = 'unit' and i.unit_id = v.unit_id))
      and (not v_is_resident or (i.unit_id = v.unit_id and (not v_is_tenant or i.liable_party_id = v_party)));

    select jsonb_build_object(
      'id', j.id,
      'journal_no', j.journal_no,
      'status', j.status,
      'occurred_on', j.occurred_on,
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id,
          'account_id', e.account_id,
          'account_code', a.code,
          'account_name', a.name,
          'side', e.side,
          'amount', e.amount
        ) order by e.created_at, e.id)
        from finance.journal_entries e
        join finance.accounts a on a.id = e.account_id
        where e.journal_id = j.id
      ), '[]'::jsonb)
    )
    into v_journal
    from billing.invoices i
    join finance.journals j on j.id = i.journal_id and j.tenant_id = i.tenant_id
    where i.id = p_invoice_id and i.tenant_id = v.tenant_id
      and (v.scope_type = 'tenant' or i.property_id = v.property_id
        or i.property_id = (select b.property_id from portfolio.buildings b where b.id = v.building_id)
        or (v.scope_type = 'unit' and i.unit_id = v.unit_id))
      and (not v_is_resident or (i.unit_id = v.unit_id and (not v_is_tenant or i.liable_party_id = v_party)));
  end if;

  return jsonb_build_object(
    'context', jsonb_build_object('id', v.id, 'tenant_name', v.tenant_name, 'role_code', v.role_code, 'scope_type', v.scope_type),
    'total', coalesce(v_total, 0),
    'invoices', coalesce(v_rows, '[]'::jsonb),
    'summary', coalesce(v_summary, '[]'::jsonb),
    'aging', coalesce(v_aging, '[]'::jsonb),
    'lines', coalesce(v_lines, '[]'::jsonb),
    'journal', v_journal,
    'limit', p_limit,
    'offset', p_offset,
    'read_only', (lower(v.role_code) in ('president', 'censor', 'owner', 'tenant_resident')),
    'generated_at', statement_timestamp()
  );
end $function$;

-- 4. billing.create_bill RPC
create or replace function billing.create_bill(
  p_context_id uuid,
  p_property_id uuid,
  p_unit_id uuid,
  p_liable_party_id uuid,
  p_period_start date,
  p_period_end date,
  p_due_on date,
  p_currency text default 'RON',
  p_lines jsonb default '[]'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'billing', 'identity', 'platform', 'portfolio', 'finance', 'occupancy', 'audit'
as $function$
declare
  v record;
  v_workspace uuid;
  v_invoice_id uuid;
  v_invoice_no bigint;
  v_currency char(3);
  v_subtotal numeric(20,4) := 0;
  v_tax_total numeric(20,4) := 0;
  v_item jsonb;
  v_desc text;
  v_qty numeric(20,8);
  v_price numeric(20,4);
  v_tax_rate numeric(9,6);
  v_line_subtotal numeric(20,4);
  v_line_tax numeric(20,4);
  v_existing record;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code, t.id as tenant_id
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'billing_mutation_role_denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code = 'billing.manage'
  ) then
    raise exception 'billing_permission_required' using errcode = '42501';
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.billing'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'billing_entitlement_required' using errcode = '42501';
  end if;

  -- Idempotency check: if already created with same key, return existing
  if p_idempotency_key is not null then
    select * into v_existing
    from billing.invoices
    where tenant_id = v.tenant_id and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'id', v_existing.id,
        'invoice_no', v_existing.invoice_no,
        'status', v_existing.status,
        'total', v_existing.total,
        'currency', v_existing.currency,
        'idempotent_replay', true
      );
    end if;
  end if;

  -- Scope validations
  if not exists (select 1 from portfolio.properties where id = p_property_id and tenant_id = v.tenant_id) then
    raise exception 'property_not_found_or_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.tenant_id = v.tenant_id and b.property_id = p_property_id
  ) then
    raise exception 'unit_not_found_or_property_mismatch' using errcode = '42501';
  end if;

  if not exists (select 1 from portfolio.parties where id = p_liable_party_id and tenant_id = v.tenant_id) then
    raise exception 'party_not_found_or_access_denied' using errcode = '42501';
  end if;

  if v.scope_type = 'property' and v.property_id <> p_property_id then
    raise exception 'property_context_scope_denied' using errcode = '42501';
  end if;
  if v.scope_type = 'unit' and v.unit_id <> p_unit_id then
    raise exception 'unit_context_scope_denied' using errcode = '42501';
  end if;

  -- Dates and period validation
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'invalid_billing_period' using errcode = '22023';
  end if;
  if p_due_on is not null and p_due_on < p_period_start then
    raise exception 'due_date_before_period_start' using errcode = '22023';
  end if;

  v_currency := upper(trim(coalesce(p_currency, 'RON')));
  if length(v_currency) <> 3 then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'invoice_lines_required' using errcode = '22023';
  end if;

  -- First pass: validate all line items and calculate subtotal/tax
  for v_item in select * from jsonb_array_elements(p_lines) loop
    v_desc := trim(coalesce(v_item->>'description', ''));
    if length(v_desc) = 0 then raise exception 'line_description_required' using errcode = '22023'; end if;

    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    v_price := (v_item->>'unit_price')::numeric;
    v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);

    if v_qty is null or v_qty <= 0 then raise exception 'invalid_line_quantity' using errcode = '22023'; end if;
    if v_price is null or v_price <= 0 then raise exception 'invalid_line_price' using errcode = '22023'; end if;
    if v_tax_rate is null or v_tax_rate < 0 then raise exception 'invalid_line_tax_rate' using errcode = '22023'; end if;

    v_line_subtotal := round(v_qty * v_price, 4);
    v_line_tax := round(v_line_subtotal * v_tax_rate, 4);
    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax;
  end loop;

  if v_subtotal <= 0 then
    raise exception 'invoice_total_must_be_positive' using errcode = '22023';
  end if;

  -- Insert invoice in draft status
  insert into billing.invoices (
    tenant_id, property_id, unit_id, liable_party_id,
    period_start, period_end, due_on, currency,
    subtotal, tax_total, status, idempotency_key
  ) values (
    v.tenant_id, p_property_id, p_unit_id, p_liable_party_id,
    p_period_start, p_period_end, p_due_on, v_currency,
    v_subtotal, v_tax_total, 'draft', p_idempotency_key
  ) returning id, invoice_no into v_invoice_id, v_invoice_no;

  -- Second pass: insert line items
  for v_item in select * from jsonb_array_elements(p_lines) loop
    v_desc := trim(v_item->>'description');
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    v_price := (v_item->>'unit_price')::numeric;
    v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);
    v_line_subtotal := round(v_qty * v_price, 4);
    v_line_tax := round(v_line_subtotal * v_tax_rate, 4);

    insert into billing.invoice_lines (
      tenant_id, invoice_id, category_id, description,
      quantity, unit_price, tax_rate, line_subtotal, line_tax
    ) values (
      v.tenant_id, v_invoice_id, (v_item->>'category_id')::uuid, v_desc,
      v_qty, v_price, v_tax_rate, v_line_subtotal, v_line_tax
    );
  end loop;

  -- Audit log
  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BILL_CREATED', 'billing.invoice', v_invoice_id,
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'invoice_no', v_invoice_no,
      'unit_id', p_unit_id,
      'liable_party_id', p_liable_party_id,
      'total', v_subtotal + v_tax_total,
      'currency', v_currency
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'id', v_invoice_id,
    'invoice_no', v_invoice_no,
    'status', 'draft',
    'subtotal', v_subtotal,
    'tax_total', v_tax_total,
    'total', v_subtotal + v_tax_total,
    'currency', v_currency,
    'created_at', statement_timestamp()
  );
end $function$;

-- 5. billing.update_bill RPC
create or replace function billing.update_bill(
  p_context_id uuid,
  p_invoice_id uuid,
  p_due_on date default null,
  p_period_start date default null,
  p_period_end date default null,
  p_liable_party_id uuid default null,
  p_lines jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'billing', 'identity', 'platform', 'portfolio', 'finance', 'occupancy', 'audit'
as $function$
declare
  v record;
  v_workspace uuid;
  inv record;
  v_subtotal numeric(20,4) := 0;
  v_tax_total numeric(20,4) := 0;
  v_item jsonb;
  v_desc text;
  v_qty numeric(20,8);
  v_price numeric(20,4);
  v_tax_rate numeric(9,6);
  v_line_subtotal numeric(20,4);
  v_line_tax numeric(20,4);
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code, t.id as tenant_id
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'billing_mutation_role_denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code = 'billing.manage'
  ) then
    raise exception 'billing_permission_required' using errcode = '42501';
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.billing'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'billing_entitlement_required' using errcode = '42501';
  end if;

  select * into inv
  from billing.invoices
  where id = p_invoice_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'invoice_not_found' using errcode = 'P0002';
  end if;

  if inv.status <> 'draft' then
    raise exception 'cannot_update_non_draft_bill' using errcode = '42501';
  end if;

  if v.scope_type = 'property' and v.property_id <> inv.property_id then
    raise exception 'property_context_scope_denied' using errcode = '42501';
  end if;
  if v.scope_type = 'unit' and v.unit_id <> inv.unit_id then
    raise exception 'unit_context_scope_denied' using errcode = '42501';
  end if;

  if p_liable_party_id is not null and not exists (
    select 1 from portfolio.parties where id = p_liable_party_id and tenant_id = v.tenant_id
  ) then
    raise exception 'party_not_found_or_access_denied' using errcode = '42501';
  end if;

  if p_period_start is not null and p_period_end is not null and p_period_end <= p_period_start then
    raise exception 'invalid_billing_period' using errcode = '22023';
  end if;

  -- If lines provided, replace lines and update subtotal/tax
  if p_lines is not null then
    if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
      raise exception 'invoice_lines_required' using errcode = '22023';
    end if;

    for v_item in select * from jsonb_array_elements(p_lines) loop
      v_desc := trim(coalesce(v_item->>'description', ''));
      if length(v_desc) = 0 then raise exception 'line_description_required' using errcode = '22023'; end if;
      v_qty := coalesce((v_item->>'quantity')::numeric, 1);
      v_price := (v_item->>'unit_price')::numeric;
      v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);

      if v_qty is null or v_qty <= 0 then raise exception 'invalid_line_quantity' using errcode = '22023'; end if;
      if v_price is null or v_price <= 0 then raise exception 'invalid_line_price' using errcode = '22023'; end if;
      if v_tax_rate is null or v_tax_rate < 0 then raise exception 'invalid_line_tax_rate' using errcode = '22023'; end if;

      v_line_subtotal := round(v_qty * v_price, 4);
      v_line_tax := round(v_line_subtotal * v_tax_rate, 4);
      v_subtotal := v_subtotal + v_line_subtotal;
      v_tax_total := v_tax_total + v_line_tax;
    end loop;

    if v_subtotal <= 0 then raise exception 'invoice_total_must_be_positive' using errcode = '22023'; end if;

    delete from billing.invoice_lines where invoice_id = inv.id;

    for v_item in select * from jsonb_array_elements(p_lines) loop
      v_desc := trim(v_item->>'description');
      v_qty := coalesce((v_item->>'quantity')::numeric, 1);
      v_price := (v_item->>'unit_price')::numeric;
      v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);
      v_line_subtotal := round(v_qty * v_price, 4);
      v_line_tax := round(v_line_subtotal * v_tax_rate, 4);

      insert into billing.invoice_lines (
        tenant_id, invoice_id, category_id, description,
        quantity, unit_price, tax_rate, line_subtotal, line_tax
      ) values (
        v.tenant_id, inv.id, (v_item->>'category_id')::uuid, v_desc,
        v_qty, v_price, v_tax_rate, v_line_subtotal, v_line_tax
      );
    end loop;

    update billing.invoices
    set subtotal = v_subtotal,
        tax_total = v_tax_total,
        due_on = coalesce(p_due_on, due_on),
        period_start = coalesce(p_period_start, period_start),
        period_end = coalesce(p_period_end, period_end),
        liable_party_id = coalesce(p_liable_party_id, liable_party_id),
        updated_at = statement_timestamp()
    where id = inv.id;
  else
    update billing.invoices
    set due_on = coalesce(p_due_on, due_on),
        period_start = coalesce(p_period_start, period_start),
        period_end = coalesce(p_period_end, period_end),
        liable_party_id = coalesce(p_liable_party_id, liable_party_id),
        updated_at = statement_timestamp()
    where id = inv.id;
  end if;

  -- Audit log
  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BILL_UPDATED', 'billing.invoice', inv.id,
    jsonb_build_object('invoice_id', inv.id, 'invoice_no', inv.invoice_no),
    statement_timestamp()
  );

  return jsonb_build_object(
    'id', inv.id,
    'invoice_no', inv.invoice_no,
    'status', 'draft',
    'updated_at', statement_timestamp()
  );
end $function$;

-- 6. billing.issue_bill RPC: Validates open period, posts balanced journal, generates receivable
create or replace function billing.issue_bill(
  p_context_id uuid,
  p_invoice_id uuid,
  p_issued_on date default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'billing', 'identity', 'platform', 'portfolio', 'finance', 'occupancy', 'audit'
as $function$
declare
  v record;
  v_workspace uuid;
  inv record;
  v_issued_on date;
  v_lines_subtotal numeric(20,4);
  v_lines_tax numeric(20,4);
  v_ar_account_id uuid;
  v_rev_account_id uuid;
  v_journal_id uuid;
  v_journal_no bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code, t.id as tenant_id
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'billing_mutation_role_denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code = 'billing.issue'
  ) then
    raise exception 'billing_permission_required' using errcode = '42501';
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.billing'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'billing_entitlement_required' using errcode = '42501';
  end if;

  select * into inv
  from billing.invoices
  where id = p_invoice_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'invoice_not_found' using errcode = 'P0002';
  end if;

  -- Idempotent check
  if inv.status = 'issued' and inv.journal_id is not null then
    return jsonb_build_object(
      'id', inv.id,
      'invoice_no', inv.invoice_no,
      'status', 'issued',
      'journal_id', inv.journal_id,
      'total', inv.total,
      'currency', inv.currency,
      'idempotent_replay', true
    );
  end if;

  if inv.status <> 'draft' then
    raise exception 'cannot_issue_non_draft_bill' using errcode = '42501';
  end if;

  if v.scope_type = 'property' and v.property_id <> inv.property_id then
    raise exception 'property_context_scope_denied' using errcode = '42501';
  end if;
  if v.scope_type = 'unit' and v.unit_id <> inv.unit_id then
    raise exception 'unit_context_scope_denied' using errcode = '42501';
  end if;

  -- Verify line items exist and sum matches invoice totals
  select coalesce(sum(line_subtotal), 0), coalesce(sum(line_tax), 0)
  into v_lines_subtotal, v_lines_tax
  from billing.invoice_lines
  where invoice_id = inv.id;

  if v_lines_subtotal <> inv.subtotal or v_lines_tax <> inv.tax_total or (v_lines_subtotal + v_lines_tax <= 0) then
    raise exception 'invoice_totals_do_not_match_lines' using errcode = '22023';
  end if;

  v_issued_on := coalesce(p_issued_on, current_date);

  -- 1. ENFORCE OPEN FINANCIAL PERIOD: Rejects if closed!
  perform finance.assert_scope_date_not_in_closed_period(inv.tenant_id, inv.property_id, v_issued_on);

  -- 2. Resolve Chart of Accounts: Receivable (Asset) and Revenue (Income)
  select id into v_ar_account_id
  from finance.accounts
  where tenant_id = inv.tenant_id and type = 'asset' and status = 'active'
    and (property_id is null or property_id = inv.property_id)
    and (code = '4111' or code like '411%' or is_control_account = true)
  order by case when code = '4111' then 0 else 1 end, code
  limit 1;

  if v_ar_account_id is null then
    select id into v_ar_account_id
    from finance.accounts
    where tenant_id = inv.tenant_id and type = 'asset' and status = 'active'
      and (property_id is null or property_id = inv.property_id)
    order by code limit 1;
  end if;

  if v_ar_account_id is null then
    raise exception 'receivable_account_not_found' using errcode = 'P0002';
  end if;

  select id into v_rev_account_id
  from finance.accounts
  where tenant_id = inv.tenant_id and type = 'income' and status = 'active'
    and (property_id is null or property_id = inv.property_id)
    and (code = '704' or code like '70%' or code like '7%')
  order by case when code = '704' then 0 else 1 end, code
  limit 1;

  if v_rev_account_id is null then
    select id into v_rev_account_id
    from finance.accounts
    where tenant_id = inv.tenant_id and type = 'income' and status = 'active'
      and (property_id is null or property_id = inv.property_id)
    order by code limit 1;
  end if;

  if v_rev_account_id is null then
    raise exception 'revenue_account_not_found' using errcode = 'P0002';
  end if;

  -- 3. Create Draft Journal in finance.journals
  insert into finance.journals (
    tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status
  ) values (
    inv.tenant_id, inv.property_id, v_issued_on, inv.currency,
    'Bill issued: Invoice #' || inv.invoice_no,
    'billing.invoice', inv.id, 'draft'
  ) returning id, journal_no into v_journal_id, v_journal_no;

  -- 4. Insert Balanced Journal Entries
  -- Debit Accounts Receivable
  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    inv.tenant_id, v_journal_id, v_ar_account_id, inv.unit_id, inv.liable_party_id,
    'debit', inv.total, 'Invoice #' || inv.invoice_no || ' receivable'
  );

  -- Credit Revenue
  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    inv.tenant_id, v_journal_id, v_rev_account_id, inv.unit_id, inv.liable_party_id,
    'credit', inv.total, 'Invoice #' || inv.invoice_no || ' revenue'
  );

  -- 5. Post Journal (Triggers verify double-entry balance and open period)
  update finance.journals
  set status = 'posted',
      posted_at = statement_timestamp(),
      posted_by = auth.uid()
  where id = v_journal_id;

  -- 6. Transition Invoice to Issued
  update billing.invoices
  set status = 'issued',
      issued_on = v_issued_on,
      journal_id = v_journal_id,
      issued_snapshot = jsonb_build_object(
        'invoice_id', inv.id,
        'invoice_no', inv.invoice_no,
        'subtotal', inv.subtotal,
        'tax_total', inv.tax_total,
        'total', inv.total,
        'currency', inv.currency,
        'issued_on', v_issued_on,
        'due_on', inv.due_on,
        'journal_id', v_journal_id,
        'journal_no', v_journal_no
      )
  where id = inv.id;

  -- 7. Insert/Update Receivables Tracking
  insert into billing.receivables (
    tenant_id, invoice_id, original_amount, paid_amount, credited_amount
  ) values (
    inv.tenant_id, inv.id, inv.total, 0, 0
  ) on conflict (invoice_id) do update set
    original_amount = excluded.original_amount;

  -- 8. Audit Event
  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    inv.tenant_id, auth.uid(), v.role_code, 'BILL_ISSUED', 'billing.invoice', inv.id,
    jsonb_build_object(
      'invoice_id', inv.id,
      'invoice_no', inv.invoice_no,
      'total', inv.total,
      'currency', inv.currency,
      'journal_id', v_journal_id,
      'journal_no', v_journal_no
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'id', inv.id,
    'invoice_no', inv.invoice_no,
    'status', 'issued',
    'issued_on', v_issued_on,
    'total', inv.total,
    'currency', inv.currency,
    'journal_id', v_journal_id,
    'journal_no', v_journal_no,
    'issued_at', statement_timestamp()
  );
end $function$;

-- 7. billing.cancel_bill RPC: Void draft bill or void issued bill with reversal journal
create or replace function billing.cancel_bill(
  p_context_id uuid,
  p_invoice_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'billing', 'identity', 'platform', 'portfolio', 'finance', 'occupancy', 'audit'
as $function$
declare
  v record;
  v_workspace uuid;
  inv record;
  rec record;
  v_reversal_journal_id uuid;
  v_reversal_journal_no bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code, t.id as tenant_id
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'billing_mutation_role_denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code = 'billing.cancel'
  ) then
    raise exception 'billing_permission_required' using errcode = '42501';
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.billing'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'billing_entitlement_required' using errcode = '42501';
  end if;

  select * into inv
  from billing.invoices
  where id = p_invoice_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'invoice_not_found' using errcode = 'P0002';
  end if;

  if inv.status in ('void', 'credited') then
    return jsonb_build_object('id', inv.id, 'invoice_no', inv.invoice_no, 'status', inv.status, 'already_void', true);
  end if;

  if inv.status = 'paid' then
    raise exception 'cannot_cancel_paid_invoice' using errcode = '42501';
  end if;

  if v.scope_type = 'property' and v.property_id <> inv.property_id then
    raise exception 'property_context_scope_denied' using errcode = '42501';
  end if;
  if v.scope_type = 'unit' and v.unit_id <> inv.unit_id then
    raise exception 'unit_context_scope_denied' using errcode = '42501';
  end if;

  if inv.status = 'draft' then
    update billing.invoices
    set status = 'void', updated_at = statement_timestamp()
    where id = inv.id;
  elsif inv.status in ('issued', 'partially_paid') then
    select * into rec
    from billing.receivables
    where invoice_id = inv.id
    for update;

    if found and rec.paid_amount > 0 then
      raise exception 'cannot_cancel_invoice_with_payments' using errcode = '42501';
    end if;

    -- Verify current date is not in a closed period for accounting reversal
    perform finance.assert_scope_date_not_in_closed_period(inv.tenant_id, inv.property_id, current_date);

    -- Post reversal journal if original journal exists
    if inv.journal_id is not null then
      -- 1. Create draft journal with reversal_of_id NULL to satisfy check (reversal_of_id is null or status='reversed')
      insert into finance.journals (
        tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status, reversal_of_id
      ) values (
        inv.tenant_id, inv.property_id, current_date, inv.currency,
        'Cancellation reversal for Invoice #' || inv.invoice_no,
        'billing.invoice_reversal', inv.id, 'draft', null
      ) returning id, journal_no into v_reversal_journal_id, v_reversal_journal_no;

      -- 2. Insert opposite entries to balance out
      insert into finance.journal_entries (tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo)
      select e.tenant_id, v_reversal_journal_id, e.account_id, e.unit_id, e.party_id,
             case when e.side = 'debit' then 'credit'::finance.entry_side else 'debit'::finance.entry_side end,
             e.amount, 'Reversal of entry ' || e.id
      from finance.journal_entries e
      where e.journal_id = inv.journal_id;

      -- 3. Post as reversed with reversal_of_id linked
      update finance.journals
      set status = 'reversed',
          reversal_of_id = inv.journal_id,
          posted_at = statement_timestamp(),
          posted_by = auth.uid()
      where id = v_reversal_journal_id;
    end if;

    -- Mark receivable as credited so balance is 0
    update billing.receivables
    set credited_amount = original_amount, updated_at = statement_timestamp()
    where invoice_id = inv.id;

    update billing.invoices
    set status = 'void', updated_at = statement_timestamp()
    where id = inv.id;
  end if;

  -- Audit log
  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
  ) values (
    inv.tenant_id, auth.uid(), v.role_code, 'BILL_CANCELLED', 'billing.invoice', inv.id, p_reason,
    jsonb_build_object('invoice_id', inv.id, 'invoice_no', inv.invoice_no, 'previous_status', inv.status, 'status', 'void'),
    statement_timestamp()
  );

  return jsonb_build_object(
    'id', inv.id,
    'invoice_no', inv.invoice_no,
    'status', 'void',
    'reversal_journal_id', v_reversal_journal_id,
    'cancelled_at', statement_timestamp()
  );
end $function$;

-- 8. Customer API Gateway Wrappers (SECURITY INVOKER, search_path = pg_catalog)
create or replace function customer_api.create_bill_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_unit_id uuid,
  p_liable_party_id uuid,
  p_period_start date,
  p_period_end date,
  p_due_on date,
  p_currency text default 'RON',
  p_lines jsonb default '[]'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return billing.create_bill(
    p_context_id, p_property_id, p_unit_id, p_liable_party_id,
    p_period_start, p_period_end, p_due_on, p_currency, p_lines, p_idempotency_key
  );
end;
$function$;

create or replace function customer_api.update_bill_v1(
  p_context_id uuid,
  p_invoice_id uuid,
  p_due_on date default null,
  p_period_start date default null,
  p_period_end date default null,
  p_liable_party_id uuid default null,
  p_lines jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return billing.update_bill(
    p_context_id, p_invoice_id, p_due_on, p_period_start, p_period_end, p_liable_party_id, p_lines
  );
end;
$function$;

create or replace function customer_api.issue_bill_v1(
  p_context_id uuid,
  p_invoice_id uuid,
  p_issued_on date default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return billing.issue_bill(
    p_context_id, p_invoice_id, p_issued_on, p_idempotency_key
  );
end;
$function$;

create or replace function customer_api.cancel_bill_v1(
  p_context_id uuid,
  p_invoice_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return billing.cancel_bill(
    p_context_id, p_invoice_id, p_reason
  );
end;
$function$;

-- 9. Grants and Revokes
revoke all on function billing.create_bill(uuid, uuid, uuid, uuid, date, date, date, text, jsonb, text) from public;
revoke all on function billing.create_bill(uuid, uuid, uuid, uuid, date, date, date, text, jsonb, text) from anon;
grant execute on function billing.create_bill(uuid, uuid, uuid, uuid, date, date, date, text, jsonb, text) to authenticated;

revoke all on function billing.update_bill(uuid, uuid, date, date, date, uuid, jsonb) from public;
revoke all on function billing.update_bill(uuid, uuid, date, date, date, uuid, jsonb) from anon;
grant execute on function billing.update_bill(uuid, uuid, date, date, date, uuid, jsonb) to authenticated;

revoke all on function billing.issue_bill(uuid, uuid, date, text) from public;
revoke all on function billing.issue_bill(uuid, uuid, date, text) from anon;
grant execute on function billing.issue_bill(uuid, uuid, date, text) to authenticated;

revoke all on function billing.cancel_bill(uuid, uuid, text) from public;
revoke all on function billing.cancel_bill(uuid, uuid, text) from anon;
grant execute on function billing.cancel_bill(uuid, uuid, text) to authenticated;

revoke all on function customer_api.create_bill_v1(uuid, uuid, uuid, uuid, date, date, date, text, jsonb, text) from public;
revoke all on function customer_api.create_bill_v1(uuid, uuid, uuid, uuid, date, date, date, text, jsonb, text) from anon;
grant execute on function customer_api.create_bill_v1(uuid, uuid, uuid, uuid, date, date, date, text, jsonb, text) to authenticated;

revoke all on function customer_api.update_bill_v1(uuid, uuid, date, date, date, uuid, jsonb) from public;
revoke all on function customer_api.update_bill_v1(uuid, uuid, date, date, date, uuid, jsonb) from anon;
grant execute on function customer_api.update_bill_v1(uuid, uuid, date, date, date, uuid, jsonb) to authenticated;

revoke all on function customer_api.issue_bill_v1(uuid, uuid, date, text) from public;
revoke all on function customer_api.issue_bill_v1(uuid, uuid, date, text) from anon;
grant execute on function customer_api.issue_bill_v1(uuid, uuid, date, text) to authenticated;

revoke all on function customer_api.cancel_bill_v1(uuid, uuid, text) from public;
revoke all on function customer_api.cancel_bill_v1(uuid, uuid, text) from anon;
grant execute on function customer_api.cancel_bill_v1(uuid, uuid, text) to authenticated;

commit;
