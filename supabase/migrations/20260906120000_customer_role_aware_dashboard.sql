begin;

create or replace function platform.get_customer_dashboard(p_context_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,maintenance,billing,communications
as $$
declare
  v record;
  v_workspace uuid;
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

  -- 6. Server-authoritative entitlements and permissions extraction
  select coalesce(jsonb_agg(e.entitlement_key order by e.entitlement_key), '[]'::jsonb)
  into v_entitlements
  from platform.workspace_entitlements e
  where e.customer_workspace_id = v_workspace
    and e.valid_from <= statement_timestamp()
    and (e.valid_until is null or e.valid_until > statement_timestamp());

  select coalesce(jsonb_agg(distinct p.code order by p.code), '[]'::jsonb)
  into v_permissions
  from identity.role_permissions rp
  join identity.permissions p on p.id = rp.permission_id
  where rp.role_id = v.role_id and rp.effect = 'allow';

  -- 7. Server-authoritative module visibility derivation (no client or API guessing)
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

  -- 8. Role-aware Persona matrix, sections, capabilities, and isolated KPIs
  if v.role_code in ('association_admin', 'property_manager') then
    v_persona := v.role_code;
    v_sections := jsonb_build_array('operations', 'financials', 'maintenance', 'communications', 'documents', 'modules')
      || (case when v_permissions ? 'audit.events.read' then jsonb_build_array('audit') else '[]'::jsonb end);
    v_capabilities := jsonb_build_array('can_view_operations', 'can_view_financials', 'can_view_accounting', 'can_view_maintenance', 'can_manage_work_orders', 'can_view_communications', 'can_view_documents')
      || (case when v_permissions ? 'audit.events.read' then jsonb_build_array('can_view_audit') else '[]'::jsonb end);

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
    v_sections := jsonb_build_array('governance', 'financial_summary', 'contracts', 'operations_summary')
      || (case when v_permissions ? 'audit.events.read' then jsonb_build_array('audit') else '[]'::jsonb end);
    v_capabilities := jsonb_build_array('can_view_governance', 'can_view_financial_summary', 'can_view_contracts', 'can_view_operations_summary', 'is_read_only')
      || (case when v_permissions ? 'audit.events.read' then jsonb_build_array('can_view_audit') else '[]'::jsonb end);

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
    v_sections := jsonb_build_array('financial_controls', 'control_documents', 'discrepancies')
      || (case when v_permissions ? 'audit.events.read' then jsonb_build_array('audit_trail') else '[]'::jsonb end);
    v_capabilities := jsonb_build_array('can_view_financial_controls', 'can_view_documents', 'is_read_only')
      || (case when v_permissions ? 'audit.events.read' then jsonb_build_array('can_view_audit') else '[]'::jsonb end);

    v_kpis := jsonb_build_object(
      'outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id)),
      'open_work_orders', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (v.scope_type = 'tenant' or w.property_id = v.property_id or w.building_id = v.building_id)),
      'unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null),
      'financial_records', (select count(*) from billing.invoices i where i.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id))
    );

  elsif v.role_code = 'owner' then
    v_persona := 'owner';
    v_sections := jsonb_build_array('my_units', 'my_financials', 'my_documents', 'my_voting', 'service_requests');
    v_capabilities := jsonb_build_array('can_view_my_units', 'can_view_my_financials', 'can_view_my_documents', 'can_view_my_voting', 'can_view_service_requests');

    v_kpis := jsonb_build_object(
      'my_units_count', (select count(*) from portfolio.units u where u.tenant_id = v.tenant_id and (case when v.scope_type = 'unit' then u.id = v.unit_id else (u.id = v.unit_id or (v.scope_type = 'property' and u.building_id in (select b.id from portfolio.buildings b where b.property_id = v.property_id))) end)),
      'outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id where rc.tenant_id = v.tenant_id and (case when v.scope_type = 'unit' then i.unit_id = v.unit_id else (i.unit_id = v.unit_id or (v.scope_type = 'property' and i.property_id = v.property_id)) end)),
      'unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null),
      'my_open_requests', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (case when v.scope_type = 'unit' then w.unit_id = v.unit_id else (w.unit_id = v.unit_id or (v.scope_type = 'property' and w.property_id = v.property_id)) end))
    );

  elsif v.role_code = 'tenant_resident' then
    v_persona := 'tenant_resident';
    v_sections := jsonb_build_array('my_residence', 'my_expenses', 'my_payments', 'my_consumption', 'my_tickets', 'resident_notices');
    v_capabilities := jsonb_build_array('can_view_my_residence', 'can_view_my_expenses', 'can_view_my_payments', 'can_view_my_consumption', 'can_view_my_tickets', 'can_view_resident_notices');

    v_kpis := jsonb_build_object(
      'outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id where rc.tenant_id = v.tenant_id and (case when v.unit_id is not null then i.unit_id = v.unit_id else false end)),
      'my_open_tickets', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (case when v.unit_id is not null then w.unit_id = v.unit_id else false end)),
      'unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null)
    );
  end if;

  -- 9. Explicit versioned response construction
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
