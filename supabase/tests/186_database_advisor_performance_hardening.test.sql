begin;
select plan(12);

select is((
  select count(*)::integer
  from pg_policies
  where (schemaname, tablename, policyname) in (
    ('payments','payment_allocation_policies','tenant_isolation_policies'),
    ('payments','beneficiary_accounts','tenant_isolation_beneficiary'),
    ('payments','provider_accounts','tenant_isolation_provider_accounts'),
    ('payments','payment_intents','tenant_isolation_payment_intents'),
    ('payments','webhook_receipts','tenant_isolation_webhook_receipts'),
    ('payments','settlements','tenant_isolation_settlements'),
    ('payments','refund_records','tenant_isolation_refund_records')
  )
    and qual ~ '(?is)select.+auth[.]uid'
), 7, 'payment policies evaluate auth.uid through an initplan');

select is((
  select count(*)::integer
  from pg_policies
  where (schemaname, tablename, policyname) in (
    ('payments','payment_allocation_policies','tenant_isolation_policies'),
    ('payments','beneficiary_accounts','tenant_isolation_beneficiary'),
    ('payments','provider_accounts','tenant_isolation_provider_accounts'),
    ('payments','payment_intents','tenant_isolation_payment_intents'),
    ('payments','webhook_receipts','tenant_isolation_webhook_receipts'),
    ('payments','settlements','tenant_isolation_settlements'),
    ('payments','refund_records','tenant_isolation_refund_records')
  )
    and cmd = 'ALL'
    and roles = array['authenticated']::name[]
), 7, 'payment policy roles and commands are unchanged');

select is((
  select count(*)::integer
  from pg_policies
  where (schemaname, tablename, policyname) in (
    ('maintenance','tickets','maintenance_reader_tickets'),
    ('maintenance','work_orders','maintenance_reader_orders'),
    ('portfolio','buildings','maintenance_reader_buildings'),
    ('portfolio','units','maintenance_reader_units')
  )
    and qual ~ '(?is)select.+current_setting'
), 4, 'maintenance policies evaluate the verified context GUC through an initplan');

select is((
  select count(*)::integer
  from pg_policies
  where (schemaname, tablename, policyname) in (
    ('maintenance','tickets','maintenance_reader_tickets'),
    ('maintenance','work_orders','maintenance_reader_orders'),
    ('portfolio','buildings','maintenance_reader_buildings'),
    ('portfolio','units','maintenance_reader_units')
  )
    and cmd = 'SELECT'
    and roles = array['cladora_rpc_owner']::name[]
), 4, 'maintenance reader policy roles and commands are unchanged');

select is((
  select count(*)::integer
  from pg_policies
  where schemaname = 'platform'
    and tablename = 'tenants'
    and policyname in ('service_tenants_all','tenants_authenticated_read_v1')
), 2, 'tenant table keeps one authenticated read policy plus its service policy');

select is((
  select count(*)::integer
  from pg_policies
  where schemaname = 'platform'
    and tablename = 'tenants'
    and policyname in ('tenants_platform_workspace_read','tenants_read_active')
), 0, 'overlapping authenticated tenant policies are removed');

select ok(exists(
  select 1
  from pg_policies
  where schemaname = 'platform'
    and tablename = 'tenants'
    and policyname = 'tenants_authenticated_read_v1'
    and cmd = 'SELECT'
    and roles = array['authenticated']::name[]
), 'merged tenant policy keeps authenticated SELECT scope');

select ok(exists(
  select 1
  from pg_policies
  where schemaname = 'platform'
    and tablename = 'tenants'
    and policyname = 'tenants_authenticated_read_v1'
    and qual like '%active_tenant_id%'
), 'merged tenant policy keeps active-tenant access');

select ok(exists(
  select 1
  from pg_policies
  where schemaname = 'platform'
    and tablename = 'tenants'
    and policyname = 'tenants_authenticated_read_v1'
    and qual like '%can_access_platform_workspace%'
), 'merged tenant policy keeps platform-workspace access');

select is((
  select count(*)::integer
  from unnest(array[
    'maintenance.vendor_payables_journal_idx',
    'occupancy.leases_landlord_party_idx',
    'occupancy.leases_tenant_party_idx'
  ]) index_name
  where to_regclass(index_name) is not null
), 0, 'redundant duplicate indexes are removed');

select is((
  select count(*)::integer
  from unnest(array[
    'maintenance.vendor_payables_journal_id_idx',
    'occupancy.leases_landlord_party_id_idx',
    'occupancy.leases_tenant_party_id_idx'
  ]) index_name
  where to_regclass(index_name) is not null
), 3, 'canonical foreign-key indexes remain present');

select is((
  select count(*)::integer
  from pg_index i
  where i.indexrelid = any(array[
    'maintenance.vendor_payables_journal_id_idx'::regclass,
    'occupancy.leases_landlord_party_id_idx'::regclass,
    'occupancy.leases_tenant_party_id_idx'::regclass
  ])
    and i.indisvalid
), 3, 'canonical foreign-key indexes remain valid');

select * from finish();
rollback;
