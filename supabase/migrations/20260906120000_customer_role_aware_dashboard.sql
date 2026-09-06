begin;

create or replace function platform.get_customer_dashboard(p_context_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,maintenance,billing,communications,occupancy
as $$
declare
  v record;
  v_workspace uuid;
  v_party_id uuid;
  v_ownership_id uuid;
  v_lease_id uuid;
  v_entitlements jsonb;
  v_permissions jsonb;
  v_modules jsonb;
  v_persona text;
  v_sections jsonb;
  v_capabilities jsonb;
  v_kpis jsonb;
begin
  -- 1. Authentication requirement
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Customer MFA verification
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- 3. Context grant, active membership, tenant and role resolution
  select
    g.id,
    g.membership_id,
    g.tenant_id,
    g.scope_type,
    g.property_id,
    g.building_id,
    g.unit_id,
    m.id as membership_key,
    m.role_id,
    lower(r.code) as role_code,
    r.name as role_name,
    t.legal_name as tenant_name
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp()
    and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- 4. Fail-closed check: only 6 canonical roles permitted
  if v.role_code not in ('association_admin', 'property_manager', 'president', 'censor', 'owner', 'tenant_resident') then
    raise exception 'unknown_role' using errcode = '42501';
  end if;

  -- 5. Active workspace check (fail-closed if no active workspace exists)
  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id
    and w.lifecycle_status = 'ACTIVE'
  order by w.id
  limit 1;

  if v_workspace is null then
    raise exception 'workspace_inactive' using errcode = '42501';
  end if;

  -- 6. Server-authoritative entitlements and permissions extraction with full override semantics
  select coalesce(jsonb_agg(e.entitlement_key order by e.entitlement_key), '[]'::jsonb)
  into v_entitlements
  from platform.workspace_entitlements e
  where e.customer_workspace_id = v_workspace
    and e.valid_from <= statement_timestamp()
    and (e.valid_until is null or e.valid_until > statement_timestamp())
    and (
      case
        when e.override_value_json is not null
         and e.override_expires_at > statement_timestamp()
        then e.override_value_json = 'true'::jsonb
        else e.boolean_value is true
      end
    );

  select coalesce(jsonb_agg(distinct p.code order by p.code), '[]'::jsonb)
  into v_permissions
  from identity.role_permissions rp
  join identity.permissions p on p.id = rp.permission_id
  where rp.role_id = v.role_id and rp.effect = 'allow';

  -- 7. Server-authoritative module visibility derivation (intersection of permission + active entitlement)
  select coalesce(jsonb_agg(m order by m), '[]'::jsonb)
  into v_modules
  from (
    select 'dashboard' as m
    union
    select 'accounting' where (v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.accounting')
    union
    select 'billing' where (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing')
    union
    select 'payments' where (v_permissions ? 'payments.reconciliation.read') and (v_entitlements ? 'module.payments')
    union
    select 'utilities' where (v_permissions ? 'utilities.metering.read') and (v_entitlements ? 'module.utilities')
    union
    select 'maintenance' where (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance')
    union
    select 'procurement' where (v_permissions ? 'maintenance.procurement.read') and (v_entitlements ? 'module.maintenance')
    union
    select 'governance' where (v_permissions ? 'governance.meetings.read') and (v_entitlements ? 'module.governance')
    union
    select 'communications' where (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications')
    union
    select 'documents' where (v_permissions ? 'documents.vault.read') and (v_entitlements ? 'module.documents')
    union
    select 'occupancy' where (v_permissions ? 'occupancy.registry.read') and (v_entitlements ? 'module.occupancy')
    union
    select 'security' where (v_permissions ? 'security.access.read') and (v_entitlements ? 'module.security')
    union
    select 'audit' where (v_permissions ? 'audit.events.read')
  ) t;

  -- 8. Deep Resident Validation (owner and tenant_resident)
  if v.role_code in ('owner', 'tenant_resident') then
    -- 8.1 Unit context requirement: scope_type must be unit and unit_id not null
    if v.scope_type <> 'unit' or v.unit_id is null then
      raise exception 'unit_context_required' using errcode = '42501';
    end if;

    -- 8.2 Party mapping requirement
    select mp.party_id into v_party_id
    from identity.membership_parties mp
    where mp.membership_id = v.membership_key
      and mp.tenant_id = v.tenant_id;

    if v_party_id is null then
      raise exception 'resident_party_mapping_required' using errcode = '42501';
    end if;

    -- 8.3 Owner validation: active ownership record
    if v.role_code = 'owner' then
      select o.id into v_ownership_id
      from portfolio.ownerships o
      where o.tenant_id = v.tenant_id
        and o.unit_id = v.unit_id
        and o.party_id = v_party_id
        and o.valid_from <= current_date
        and (o.valid_to is null or o.valid_to > current_date)
      limit 1;

      if v_ownership_id is null then
        raise exception 'ownership_required' using errcode = '42501';
      end if;

    -- 8.4 Tenant-resident validation: active lease
    elsif v.role_code = 'tenant_resident' then
      select l.id into v_lease_id
      from occupancy.leases l
      where l.tenant_id = v.tenant_id
        and l.unit_id = v.unit_id
        and l.tenant_party_id = v_party_id
        and l.status = 'active'
        and l.starts_on <= current_date
        and (l.ends_on is null or l.ends_on > current_date)
      limit 1;

      if v_lease_id is null then
        raise exception 'active_lease_required' using errcode = '42501';
      end if;
    end if;
  end if;

  -- 9. Role-aware Persona matrix, sections, capabilities, and isolated KPIs
  if v.role_code in ('association_admin', 'property_manager') then
    v_persona := v.role_code;
    v_sections := '[]'::jsonb;
    v_capabilities := '[]'::jsonb;

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_sections := v_sections || jsonb_build_array('operations');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_operations');
    end if;

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_sections := v_sections || jsonb_build_array('financials');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financials');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := jsonb_build_object(
      'properties', (select count(*) from portfolio.properties p where p.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or p.id = v.property_id or p.id = (select b.property_id from portfolio.buildings b where b.id = v.building_id) or p.id = (select b.property_id from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.id = v.unit_id))),
      'buildings', (select count(*) from portfolio.buildings b where b.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or b.id = v.building_id or b.id = (select u.building_id from portfolio.units u where u.id = v.unit_id))),
      'units', (select count(*) from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or u.building_id = v.building_id or u.id = v.unit_id)),
      'open_work_orders', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (v.scope_type = 'tenant' or w.property_id = v.property_id or w.building_id = v.building_id or w.unit_id = v.unit_id)),
      'unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null),
      'outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id or u.id = v.unit_id))
    );

  elsif v.role_code = 'president' then
    v_persona := 'president';
    v_sections := '[]'::jsonb;
    v_capabilities := jsonb_build_array('is_read_only');

    if (v_permissions ? 'governance.meetings.read') and (v_entitlements ? 'module.governance') then
      v_sections := v_sections || jsonb_build_array('governance');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_governance');
    end if;

    if (v_permissions ? 'billing.receivables.read' or v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.billing' or v_entitlements ? 'module.accounting') then
      v_sections := v_sections || jsonb_build_array('financial_summary');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financial_summary');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := jsonb_build_object(
      'buildings', (select count(*) from portfolio.buildings b where b.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or b.id = v.building_id)),
      'units', (select count(*) from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or u.building_id = v.building_id)),
      'open_work_orders', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (v.scope_type = 'tenant' or w.property_id = v.property_id or w.building_id = v.building_id)),
      'unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null),
      'outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id)),
      'pending_approvals', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status in ('submitted', 'in_review') and (v.scope_type = 'tenant' or w.property_id = v.property_id or w.building_id = v.building_id))
    );

  elsif v.role_code = 'censor' then
    v_persona := 'censor';
    v_sections := '[]'::jsonb;
    v_capabilities := jsonb_build_array('is_read_only');

    if (v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.accounting') then
      v_sections := v_sections || jsonb_build_array('financial_controls');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financial_controls');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := jsonb_build_object(
      'outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id)),
      'open_work_orders', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (v.scope_type = 'tenant' or w.property_id = v.property_id or w.building_id = v.building_id)),
      'unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null),
      'financial_records', (select count(*) from billing.invoices i where i.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id))
    );

  elsif v.role_code = 'owner' then
    v_persona := 'owner';
    v_sections := '[]'::jsonb;
    v_capabilities := '[]'::jsonb;

    v_sections := v_sections || jsonb_build_array('my_units');
    v_capabilities := v_capabilities || jsonb_build_array('can_view_my_units');

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_sections := v_sections || jsonb_build_array('my_financials');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_financials');
    end if;

    -- Strict unit-only isolation: unit_id matches the validated ownership unit!
    v_kpis := jsonb_build_object(
      'my_units_count', (select count(*) from portfolio.ownerships o where o.tenant_id = v.tenant_id and o.unit_id = v.unit_id and o.party_id = v_party_id and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date)),
      'outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id where rc.tenant_id = v.tenant_id and i.unit_id = v.unit_id),
      'unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null),
      'my_open_requests', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.unit_id = v.unit_id and w.status not in ('completed','verified','cancelled'))
    );

  elsif v.role_code = 'tenant_resident' then
    v_persona := 'tenant_resident';
    v_sections := jsonb_build_array('my_residence');
    v_capabilities := jsonb_build_array('can_view_my_residence');

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_sections := v_sections || jsonb_build_array('my_expenses');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_expenses');
    end if;

    if (v_permissions ? 'utilities.metering.read') and (v_entitlements ? 'module.utilities') then
      v_sections := v_sections || jsonb_build_array('my_consumption');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_consumption');
    end if;

    -- Strict unit & tenant party isolation!
    v_kpis := jsonb_build_object(
      'outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id where rc.tenant_id = v.tenant_id and i.unit_id = v.unit_id and (i.liable_party_id is null or i.liable_party_id = v_party_id)),
      'my_open_tickets', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.unit_id = v.unit_id and w.status not in ('completed','verified','cancelled')),
      'unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null)
    );
  end if;

  -- 10. Explicit versioned response construction
  return jsonb_build_object(
    'version', 1,
    'persona', v_persona,
    'contextId', v.id,
    'context', jsonb_build_object(
      'id', v.id,
      'tenant_id', v.tenant_id,
      'tenant_name', v.tenant_name,
      'role_code', v.role_code,
      'role_name', v.role_name,
      'scope_type', v.scope_type,
      'property_id', v.property_id,
      'building_id', v.building_id,
      'unit_id', v.unit_id
    ),
    'workspace_id', v_workspace,
    'permissions', v_permissions,
    'entitlements', v_entitlements,
    'modules', v_modules,
    'capabilities', v_capabilities,
    'sections', v_sections,
    'kpis', v_kpis,
    'generated_at', statement_timestamp()
  );
end $$;

revoke all on function platform.get_customer_dashboard(uuid) from public, anon;
grant execute on function platform.get_customer_dashboard(uuid) to authenticated, service_role;

commit;
