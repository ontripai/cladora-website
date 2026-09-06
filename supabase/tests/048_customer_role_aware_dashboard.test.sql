begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(38);

-- 1. Contract & Function Interface Introspection
select ok(to_regprocedure('platform.get_customer_dashboard(uuid)') is not null, 'dashboard RPC exists');
select ok((select prorettype = 'jsonb'::regtype from pg_proc where oid = 'platform.get_customer_dashboard(uuid)'::regprocedure), 'RPC returns jsonb');
select ok((select provolatile = 's' from pg_proc where oid = 'platform.get_customer_dashboard(uuid)'::regprocedure), 'RPC is stable');
select ok((select prosecdef from pg_proc where oid = 'platform.get_customer_dashboard(uuid)'::regprocedure), 'RPC is security definer');

-- 2. Privileges & Anon Revocation
select ok(has_function_privilege('authenticated', 'platform.get_customer_dashboard(uuid)', 'EXECUTE'), 'authenticated may request dashboard');
select ok(not has_function_privilege('anon', 'platform.get_customer_dashboard(uuid)', 'EXECUTE'), 'anon cannot execute dashboard RPC');
select ok(not has_function_privilege('public', 'platform.get_customer_dashboard(uuid)', 'EXECUTE'), 'public cannot execute dashboard RPC');

-- 3. Security Checks & Invariant Introspection
select ok(position('auth.uid() is null' in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'authentication requirement checked');
select ok(position('app_private.customer_mfa_required()' in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'MFA requirement checked');
select ok(position($n$coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2'$n$ in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'AAL2 verified for MFA users');
select ok(position($n$'association_admin', 'property_manager', 'president', 'censor', 'owner', 'tenant_resident'$n$ in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'canonical roles strictly enforced');
select ok(position($n$raise exception 'unknown_role'$n$ in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'unknown role fails closed');
select ok(position($n$w.lifecycle_status = 'ACTIVE'$n$ in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'workspace lifecycle active check enforced');
select ok(position($n$raise exception 'workspace_inactive'$n$ in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'inactive workspace fails closed');
select ok(position('p.tenant_id = v.tenant_id' in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'tenant isolation enforced');
select ok(position('my_units' in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'owner persona sections isolated');
select ok(position('my_residence' in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'tenant resident persona sections isolated');
select ok(position('financial_controls' in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'censor financial controls sections present');
select ok(position('operations_summary' in pg_get_functiondef('platform.get_customer_dashboard(uuid)'::regprocedure)) > 0, 'president governance sections present');

-- 4. Functional Test Fixtures (2 Tenants, 6 Canonical Roles + Unknown Role + Inactive Workspace)
do $$
begin
  -- Users
  insert into auth.users(id, email) values
    ('48000000-0000-0000-0000-000000000001', 'admin-048@cladora.test'),
    ('48000000-0000-0000-0000-000000000002', 'president-048@cladora.test'),
    ('48000000-0000-0000-0000-000000000003', 'censor-048@cladora.test'),
    ('48000000-0000-0000-0000-000000000004', 'owner-048@cladora.test'),
    ('48000000-0000-0000-0000-000000000005', 'tenant-048@cladora.test'),
    ('48000000-0000-0000-0000-000000000006', 'unknown-048@cladora.test'),
    ('48000000-0000-0000-0000-000000000007', 'cross-tenant-048@cladora.test');

  -- Tenants
  insert into platform.tenants(id, legal_name, registration_number, status) values
    ('48100000-0000-0000-0000-000000000001', 'Tenant Alpha', 'CLD-048-A', 'active'),
    ('48100000-0000-0000-0000-000000000002', 'Tenant Beta', 'CLD-048-B', 'active');

  -- Workspaces (Tenant 1 ACTIVE, Tenant 2 INACTIVE)
  insert into platform.customer_workspaces(id, tenant_id, code, name, lifecycle_status) values
    ('48150000-0000-0000-0000-000000000001', '48100000-0000-0000-0000-000000000001', 'ws-alpha', 'Workspace Alpha', 'ACTIVE'),
    ('48150000-0000-0000-0000-000000000002', '48100000-0000-0000-0000-000000000002', 'ws-beta', 'Workspace Beta', 'SUSPENDED');

  -- Roles
  insert into identity.roles(id, tenant_id, code, name) values
    ('48200000-0000-0000-0000-000000000001', '48100000-0000-0000-0000-000000000001', 'association_admin', 'Association Administrator'),
    ('48200000-0000-0000-0000-000000000002', '48100000-0000-0000-0000-000000000001', 'president', 'President'),
    ('48200000-0000-0000-0000-000000000003', '48100000-0000-0000-0000-000000000001', 'censor', 'Censor'),
    ('48200000-0000-0000-0000-000000000004', '48100000-0000-0000-0000-000000000001', 'owner', 'Owner'),
    ('48200000-0000-0000-0000-000000000005', '48100000-0000-0000-0000-000000000001', 'tenant_resident', 'Tenant Resident'),
    ('48200000-0000-0000-0000-000000000006', '48100000-0000-0000-0000-000000000001', 'contractor', 'External Contractor'),
    ('48200000-0000-0000-0000-000000000007', '48100000-0000-0000-0000-000000000002', 'association_admin', 'Beta Admin');

  -- Memberships
  insert into identity.memberships(id, tenant_id, user_id, role_id, status, starts_at) values
    ('48300000-0000-0000-0000-000000000001', '48100000-0000-0000-0000-000000000001', '48000000-0000-0000-0000-000000000001', '48200000-0000-0000-0000-000000000001', 'active', statement_timestamp() - interval '1 day'),
    ('48300000-0000-0000-0000-000000000002', '48100000-0000-0000-0000-000000000001', '48000000-0000-0000-0000-000000000002', '48200000-0000-0000-0000-000000000002', 'active', statement_timestamp() - interval '1 day'),
    ('48300000-0000-0000-0000-000000000003', '48100000-0000-0000-0000-000000000001', '48000000-0000-0000-0000-000000000003', '48200000-0000-0000-0000-000000000003', 'active', statement_timestamp() - interval '1 day'),
    ('48300000-0000-0000-0000-000000000004', '48100000-0000-0000-0000-000000000001', '48000000-0000-0000-0000-000000000004', '48200000-0000-0000-0000-000000000004', 'active', statement_timestamp() - interval '1 day'),
    ('48300000-0000-0000-0000-000000000005', '48100000-0000-0000-0000-000000000001', '48000000-0000-0000-0000-000000000005', '48200000-0000-0000-0000-000000000005', 'active', statement_timestamp() - interval '1 day'),
    ('48300000-0000-0000-0000-000000000006', '48100000-0000-0000-0000-000000000001', '48000000-0000-0000-0000-000000000006', '48200000-0000-0000-0000-000000000006', 'active', statement_timestamp() - interval '1 day'),
    ('48300000-0000-0000-0000-000000000007', '48100000-0000-0000-0000-000000000002', '48000000-0000-0000-0000-000000000007', '48200000-0000-0000-0000-000000000007', 'active', statement_timestamp() - interval '1 day');

  -- Properties & Units
  insert into portfolio.properties(id, tenant_id, type, name, status) values
    ('48500000-0000-0000-0000-000000000001', '48100000-0000-0000-0000-000000000001', 'condominium', 'Property Alpha', 'active'),
    ('48500000-0000-0000-0000-000000000002', '48100000-0000-0000-0000-000000000002', 'condominium', 'Property Beta', 'active');

  insert into portfolio.buildings(id, tenant_id, property_id, code, name) values
    ('48600000-0000-0000-0000-000000000001', '48100000-0000-0000-0000-000000000001', '48500000-0000-0000-0000-000000000001', 'BLD-A', 'Building A');

  insert into portfolio.units(id, tenant_id, building_id, code, status) values
    ('48700000-0000-0000-0000-000000000001', '48100000-0000-0000-0000-000000000001', '48600000-0000-0000-0000-000000000001', 'U-101', 'active'),
    ('48700000-0000-0000-0000-000000000002', '48100000-0000-0000-0000-000000000001', '48600000-0000-0000-0000-000000000001', 'U-102', 'active');

  -- Context Grants
  insert into identity.context_grants(id, membership_id, tenant_id, scope_type, property_id, starts_at) values
    ('48400000-0000-0000-0000-000000000001', '48300000-0000-0000-0000-000000000001', '48100000-0000-0000-0000-000000000001', 'tenant', '48500000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day'),
    ('48400000-0000-0000-0000-000000000002', '48300000-0000-0000-0000-000000000002', '48100000-0000-0000-0000-000000000001', 'property', '48500000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day'),
    ('48400000-0000-0000-0000-000000000003', '48300000-0000-0000-0000-000000000003', '48100000-0000-0000-0000-000000000001', 'property', '48500000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day');

  insert into identity.context_grants(id, membership_id, tenant_id, scope_type, unit_id, starts_at) values
    ('48400000-0000-0000-0000-000000000004', '48300000-0000-0000-0000-000000000004', '48100000-0000-0000-0000-000000000001', 'unit', '48700000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day'),
    ('48400000-0000-0000-0000-000000000005', '48300000-0000-0000-0000-000000000005', '48100000-0000-0000-0000-000000000001', 'unit', '48700000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day'),
    ('48400000-0000-0000-0000-000000000006', '48300000-0000-0000-0000-000000000006', '48100000-0000-0000-0000-000000000001', 'unit', '48700000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day'),
    ('48400000-0000-0000-0000-000000000007', '48300000-0000-0000-0000-000000000007', '48100000-0000-0000-0000-000000000002', 'tenant', null, statement_timestamp() - interval '1 day');

  -- Expired context grant for actor 1
  insert into identity.context_grants(id, membership_id, tenant_id, scope_type, starts_at, ends_at) values
    ('48400000-0000-0000-0000-000000000099', '48300000-0000-0000-0000-000000000001', '48100000-0000-0000-0000-000000000001', 'tenant', statement_timestamp() - interval '10 days', statement_timestamp() - interval '1 day');
end $$;

-- Set auth context to association_admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"48000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

-- 5. Functional Execution for Canonical Roles
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000001') ->> 'persona' = 'association_admin', 'association_admin returns correct persona');
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000001') -> 'sections' ? 'operations', 'association_admin receives operations section');
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000001') -> 'kpis' ? 'properties', 'association_admin receives properties KPI');

-- Switch to president
select set_config('request.jwt.claims', '{"sub":"48000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000002') ->> 'persona' = 'president', 'president returns correct persona');
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000002') -> 'sections' ? 'governance', 'president receives governance section');
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000002') -> 'capabilities' ? 'is_read_only', 'president capability includes is_read_only');

-- Switch to censor
select set_config('request.jwt.claims', '{"sub":"48000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000003') ->> 'persona' = 'censor', 'censor returns correct persona');
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000003') -> 'sections' ? 'financial_controls', 'censor receives financial controls section');
select ok(not (platform.get_customer_dashboard('48400000-0000-0000-0000-000000000003') -> 'sections' ? 'operations'), 'censor never receives operations section');

-- Switch to owner
select set_config('request.jwt.claims', '{"sub":"48000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal1"}', true);
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000004') ->> 'persona' = 'owner', 'owner returns correct persona');
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000004') -> 'sections' ? 'my_units', 'owner receives my_units section');
select ok(not (platform.get_customer_dashboard('48400000-0000-0000-0000-000000000004') -> 'sections' ? 'audit'), 'owner never receives audit section');
select ok(not (platform.get_customer_dashboard('48400000-0000-0000-0000-000000000004') -> 'kpis' ? 'properties'), 'owner never receives entire complex properties count');

-- Switch to tenant_resident
select set_config('request.jwt.claims', '{"sub":"48000000-0000-0000-0000-000000000005","role":"authenticated","aal":"aal1"}', true);
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000005') ->> 'persona' = 'tenant_resident', 'tenant_resident returns correct persona');
select ok(platform.get_customer_dashboard('48400000-0000-0000-0000-000000000005') -> 'sections' ? 'my_residence', 'tenant_resident receives my_residence section');
select ok(not (platform.get_customer_dashboard('48400000-0000-0000-0000-000000000005') -> 'sections' ? 'audit'), 'tenant_resident never receives audit section');

-- 6. Fail-Closed Assertions
-- Unknown / non-canonical role rejection
select set_config('request.jwt.claims', '{"sub":"48000000-0000-0000-0000-000000000006","role":"authenticated","aal":"aal1"}', true);
select throws_like($$select platform.get_customer_dashboard('48400000-0000-0000-0000-000000000006')$$, '%unknown_role%', 'non-canonical role rejected');

-- Expired context rejection
select set_config('request.jwt.claims', '{"sub":"48000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select throws_like($$select platform.get_customer_dashboard('48400000-0000-0000-0000-000000000099')$$, '%customer_context_access_denied%', 'expired context rejected');

-- Inactive / suspended workspace rejection
select set_config('request.jwt.claims', '{"sub":"48000000-0000-0000-0000-000000000007","role":"authenticated","aal":"aal2"}', true);
select throws_like($$select platform.get_customer_dashboard('48400000-0000-0000-0000-000000000007')$$, '%workspace_inactive%', 'inactive workspace rejected');

select * from finish();
rollback;
