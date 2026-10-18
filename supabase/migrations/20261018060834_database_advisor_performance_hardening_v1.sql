begin;

-- Evaluate the authenticated user once per statement instead of once per row.
-- The policy role, command and tenant-membership semantics remain unchanged.
alter policy tenant_isolation_policies
  on payments.payment_allocation_policies
  using (tenant_id in (
    select m.tenant_id
    from identity.memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'active'
  ));

alter policy tenant_isolation_beneficiary
  on payments.beneficiary_accounts
  using (tenant_id in (
    select m.tenant_id
    from identity.memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'active'
  ));

alter policy tenant_isolation_provider_accounts
  on payments.provider_accounts
  using (tenant_id in (
    select m.tenant_id
    from identity.memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'active'
  ));

alter policy tenant_isolation_payment_intents
  on payments.payment_intents
  using (tenant_id in (
    select m.tenant_id
    from identity.memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'active'
  ));

alter policy tenant_isolation_webhook_receipts
  on payments.webhook_receipts
  using (tenant_id in (
    select m.tenant_id
    from identity.memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'active'
  ));

alter policy tenant_isolation_settlements
  on payments.settlements
  using (tenant_id in (
    select m.tenant_id
    from identity.memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'active'
  ));

alter policy tenant_isolation_refund_records
  on payments.refund_records
  using (tenant_id in (
    select m.tenant_id
    from identity.memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'active'
  ));

-- The maintenance reader stores a verified context in a transaction-local GUC.
-- Lift the GUC lookup into an initplan while preserving the existing scope checks.
alter policy maintenance_reader_tickets
  on maintenance.tickets
  using (maintenance.can_read_context_target_v1(
    (select nullif(current_setting('cladora.maintenance_read_context_id', true), '')::uuid),
    'maintenance.requests.read', tenant_id, property_id, building_id, unit_id
  ));

alter policy maintenance_reader_orders
  on maintenance.work_orders
  using (
    maintenance.can_read_context_target_v1(
      (select nullif(current_setting('cladora.maintenance_read_context_id', true), '')::uuid),
      'maintenance.requests.read', tenant_id, property_id, building_id, unit_id
    )
    or maintenance.can_read_context_target_v1(
      (select nullif(current_setting('cladora.maintenance_read_context_id', true), '')::uuid),
      'maintenance.work_orders.read', tenant_id, property_id, building_id, unit_id
    )
  );

alter policy maintenance_reader_buildings
  on portfolio.buildings
  using (
    case
      when (select nullif(current_setting('cladora.maintenance_read_context_id', true), '')) is null
        then false
      else exists (
        select 1
        from maintenance.verify_customer_maintenance_actor(
          (select nullif(current_setting('cladora.maintenance_read_context_id', true), '')::uuid),
          null,
          true
        ) v
        where buildings.tenant_id = v.tenant_id
          and (
            maintenance.can_read_context_target_v1(
              (select nullif(current_setting('cladora.maintenance_read_context_id', true), '')::uuid),
              'maintenance.requests.read',
              buildings.tenant_id,
              buildings.property_id,
              buildings.id,
              case when v.scope_type = 'unit' and v.building_id = buildings.id then v.unit_id else null end
            )
            or maintenance.can_read_context_target_v1(
              (select nullif(current_setting('cladora.maintenance_read_context_id', true), '')::uuid),
              'maintenance.work_orders.read',
              buildings.tenant_id,
              buildings.property_id,
              buildings.id,
              case when v.scope_type = 'unit' and v.building_id = buildings.id then v.unit_id else null end
            )
          )
      )
    end
  );

alter policy maintenance_reader_units
  on portfolio.units
  using (
    exists (
      select 1
      from portfolio.buildings b
      where b.id = units.building_id
        and b.tenant_id = units.tenant_id
        and (
          maintenance.can_read_context_target_v1(
            (select nullif(current_setting('cladora.maintenance_read_context_id', true), '')::uuid),
            'maintenance.requests.read',
            units.tenant_id,
            b.property_id,
            b.id,
            units.id
          )
          or maintenance.can_read_context_target_v1(
            (select nullif(current_setting('cladora.maintenance_read_context_id', true), '')::uuid),
            'maintenance.work_orders.read',
            units.tenant_id,
            b.property_id,
            b.id,
            units.id
          )
        )
    )
  );

-- Preserve the union of both authenticated tenant read paths in one policy.
drop policy tenants_platform_workspace_read on platform.tenants;
drop policy tenants_read_active on platform.tenants;
create policy tenants_authenticated_read_v1
  on platform.tenants
  for select
  to authenticated
  using (
    id = (select app_private.active_tenant_id())
    or exists (
      select 1
      from platform.customer_workspaces w
      where w.tenant_id = tenants.id
        and app_private.can_access_platform_workspace(w.id)
    )
  );

-- Keep the canonical foreign-key index names already asserted by pgTAP.
drop index if exists maintenance.vendor_payables_journal_idx;
drop index if exists occupancy.leases_landlord_party_idx;
drop index if exists occupancy.leases_tenant_party_idx;

commit;
