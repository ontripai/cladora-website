-- Prevent owner and tenant contexts from exposing general ledger details via direct RPC.
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
    'invoices', case when v_is_resident then
      (select coalesce(jsonb_agg(item - 'journal_id' - 'journal_no'), '[]'::jsonb)
       from jsonb_array_elements(coalesce(v_rows, '[]'::jsonb)) as item)
      else coalesce(v_rows, '[]'::jsonb) end,
    'summary', coalesce(v_summary, '[]'::jsonb),
    'aging', coalesce(v_aging, '[]'::jsonb),
    'lines', coalesce(v_lines, '[]'::jsonb),
    'journal', case when v_is_resident then null else v_journal end,
    'limit', p_limit,
    'offset', p_offset,
    'read_only', true,
    'generated_at', statement_timestamp()
  );
end $function$;
