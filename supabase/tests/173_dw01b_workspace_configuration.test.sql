begin;
select plan(22);

select ok(exists(
  select 1 from information_schema.columns
  where table_schema = 'platform' and table_name = 'workspace_taxonomy_assignments'
    and column_name = 'configuration_version'
), 'configuration version is stored on the existing taxonomy ledger');
select ok(exists(
  select 1 from information_schema.columns
  where table_schema = 'platform' and table_name = 'workspace_taxonomy_assignments'
    and column_name = 'compatibility_rule_id'
), 'compatibility rule identity is pinned');
select ok(exists(
  select 1 from information_schema.columns
  where table_schema = 'platform' and table_name = 'workspace_taxonomy_assignments'
    and column_name = 'compatibility_rule_version'
), 'compatibility rule version is pinned');
select ok((
  select count(*) = 3
  from information_schema.columns
  where table_schema = 'platform'
    and table_name = 'workspace_taxonomy_assignments'
    and column_name in ('configuration_version', 'compatibility_rule_id', 'compatibility_rule_version')
    and is_nullable = 'NO'
), 'all configuration provenance columns are mandatory');
select ok(exists(
  select 1 from pg_constraint
  where conrelid = 'platform.workspace_taxonomy_assignments'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) = 'UNIQUE (customer_workspace_id, configuration_version)'
), 'workspace configuration versions are unique per workspace');
select has_trigger('platform', 'workspace_taxonomy_assignments',
  'a_assign_workspace_configuration_version', 'server-managed version trigger exists');
select has_function('customer_api', 'get_workspace_configuration_v1',
  array['uuid', 'uuid', 'timestamp with time zone'], 'historical configuration reader exists');
select ok(has_function_privilege('authenticated',
  'customer_api.get_workspace_configuration_v1(uuid,uuid,timestamptz)', 'execute'),
  'authenticated callers may invoke the bounded reader');
select ok(not has_function_privilege('anon',
  'customer_api.get_workspace_configuration_v1(uuid,uuid,timestamptz)', 'execute'),
  'anonymous callers cannot invoke the reader');
select ok(not has_function_privilege('authenticated',
  'app_private.assign_workspace_configuration_version_v1()', 'execute'),
  'server-managed version helper remains private');

do $$
declare
  v_user uuid := '17300000-0000-0000-0000-000000000001';
  v_tenant uuid := '17300000-0000-0000-0000-000000000010';
  v_workspace uuid := '17300000-0000-0000-0000-000000000100';
  v_other_workspace uuid := '17300000-0000-0000-0000-000000000200';
  v_membership uuid := '17300000-0000-0000-0000-000000001000';
  v_context uuid := '17300000-0000-0000-0000-000000010000';
  v_workspace_role uuid := '17300000-0000-0000-0000-000000100000';
  v_base_role uuid;
  v_profile uuid;
  v_model uuid;
  v_rule uuid;
begin
  insert into auth.users(id, email)
    values (v_user, 'dw01b-reader@cladora.test');
  insert into platform.tenants(id, legal_name, registration_number, status)
    values (v_tenant, 'DW-01B tenant', 'RO-DW01B-173', 'active');
  insert into platform.customer_workspaces(
    id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment
  ) values
    (v_workspace, v_tenant, 'ASSOCIATION', 'ACTIVE', 'DW-01B owner', 'PILOT'),
    (v_other_workspace, v_tenant, 'ASSOCIATION', 'ACTIVE', 'Other owner', 'PILOT');

  select id into v_base_role
  from identity.roles
  where code = 'association_admin' and tenant_id is null
  order by id limit 1;
  insert into identity.memberships(
    id, tenant_id, user_id, role_id, status, starts_at
  ) values (
    v_membership, v_tenant, v_user, v_base_role, 'active', statement_timestamp() - interval '3 days'
  );
  insert into identity.context_grants(
    id, tenant_id, membership_id, scope_type, starts_at
  ) values (
    v_context, v_tenant, v_membership, 'tenant', statement_timestamp() - interval '3 days'
  );
  insert into platform.workspace_roles(
    id, tenant_id, customer_workspace_id, code, name, description,
    base_role_id, scope_ceiling, lifecycle_status, valid_from, created_by
  ) values (
    v_workspace_role, v_tenant, v_workspace, 'dw01b_reader', 'DW-01B reader',
    'Native workspace configuration reader', v_base_role, 'workspace',
    'published', statement_timestamp() - interval '3 days', v_user
  );
  insert into platform.workspace_member_roles(
    tenant_id, customer_workspace_id, membership_id, workspace_role_id,
    scope_type, valid_from, assigned_by_user_id, assigned_by_membership_id, reason
  ) values (
    v_tenant, v_workspace, v_membership, v_workspace_role,
    'workspace', statement_timestamp() - interval '3 days', v_user, v_membership,
    'DW-01B native read fixture'
  );

  select id into v_profile from platform.property_profiles
    where code = 'residential_condominium' and version = 1;
  select id into v_model from platform.operating_models
    where code = 'association_managed' and version = 1;
  select id into v_rule
  from platform.property_operating_model_compatibilities
  where property_profile_id = v_profile and operating_model_id = v_model
  order by rule_version desc, id limit 1;

  insert into platform.workspace_taxonomy_assignments(
    tenant_id, customer_workspace_id, property_profile_id, operating_model_id,
    status, valid_from, valid_to, created_by, country_code
  ) values (
    v_tenant, v_workspace, v_profile, v_model, 'superseded',
    statement_timestamp() - interval '2 days',
    statement_timestamp() - interval '1 day', v_user, 'RO'
  );
  insert into platform.workspace_taxonomy_assignments(
    tenant_id, customer_workspace_id, property_profile_id, operating_model_id,
    status, valid_from, created_by, country_code,
    configuration_version, compatibility_rule_id, compatibility_rule_version
  ) values (
    v_tenant, v_workspace, v_profile, v_model, 'active',
    statement_timestamp() - interval '1 day', v_user, 'RO', 999, v_rule, 999
  );
end;
$$;

select is((
  select configuration_version from platform.workspace_taxonomy_assignments
  where customer_workspace_id = '17300000-0000-0000-0000-000000000100'
  order by valid_from limit 1
), 1, 'first historical assignment receives configuration version 1');
select is((
  select configuration_version from platform.workspace_taxonomy_assignments
  where customer_workspace_id = '17300000-0000-0000-0000-000000000100'
  order by valid_from desc limit 1
), 2, 'caller-supplied version is replaced by server-managed version 2');
select ok((
  select bool_and(a.compatibility_rule_id = c.id)
  from platform.workspace_taxonomy_assignments a
  join lateral (
    select x.id from platform.property_operating_model_compatibilities x
    where x.property_profile_id = a.property_profile_id
      and x.operating_model_id = a.operating_model_id
    order by x.rule_version desc, x.id limit 1
  ) c on true
  where a.customer_workspace_id = '17300000-0000-0000-0000-000000000100'
), 'every configuration pins the latest compatibility rule identity at insert');
select ok((
  select bool_and(a.compatibility_rule_version = c.rule_version)
  from platform.workspace_taxonomy_assignments a
  join platform.property_operating_model_compatibilities c
    on c.id = a.compatibility_rule_id
  where a.customer_workspace_id = '17300000-0000-0000-0000-000000000100'
), 'pinned compatibility rule versions match their immutable rule identities');
select ok((
  select count(*) = 2 and count(distinct configuration_version) = 2
    and min(configuration_version) = 1 and max(configuration_version) = 2
  from platform.workspace_taxonomy_assignments
  where customer_workspace_id = '17300000-0000-0000-0000-000000000100'
), 'workspace history is a contiguous two-version ledger');
select throws_ok($$
  update platform.workspace_taxonomy_assignments
  set configuration_version = 20
  where customer_workspace_id = '17300000-0000-0000-0000-000000000100'
    and configuration_version = 2
$$, '42501', 'workspace_taxonomy_assignment_history_immutable',
  'configuration version history cannot be rewritten');
select throws_ok($$
  update platform.workspace_taxonomy_assignments
  set compatibility_rule_version = compatibility_rule_version + 1
  where customer_workspace_id = '17300000-0000-0000-0000-000000000100'
    and configuration_version = 2
$$, '42501', 'workspace_taxonomy_assignment_history_immutable',
  'compatibility provenance cannot be rewritten');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"17300000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select is((customer_api.get_workspace_configuration_v1(
  '17300000-0000-0000-0000-000000010000',
  '17300000-0000-0000-0000-000000000100'
)->'configuration'->>'configuration_version')::integer, 2,
  'current read returns configuration version 2');
select is((customer_api.get_workspace_configuration_v1(
  '17300000-0000-0000-0000-000000010000',
  '17300000-0000-0000-0000-000000000100',
  statement_timestamp() - interval '36 hours'
)->'configuration'->>'configuration_version')::integer, 1,
  'historical read returns the version effective at as_of');
select ok((
  select payload->>'contract' = 'workspace-configuration.v1'
    and (payload->>'classification_only')::boolean
    and not (payload->'compatibility'->>'product_gate')::boolean
    and payload->>'action_authorization' = 'not_evaluated'
  from (select customer_api.get_workspace_configuration_v1(
    '17300000-0000-0000-0000-000000010000',
    '17300000-0000-0000-0000-000000000100'
  ) payload) q
), 'reader states the classification, product-gate, and authorization boundary');
select throws_ok($$
  select customer_api.get_workspace_configuration_v1(
    '17300000-0000-0000-0000-000000010000',
    '17300000-0000-0000-0000-000000000100',
    statement_timestamp() + interval '1 minute')
$$, '22023', 'workspace_configuration_future_as_of',
  'future as_of reads are rejected');
select throws_ok($$
  select customer_api.get_workspace_configuration_v1(
    '17300000-0000-0000-0000-000000010000',
    '17300000-0000-0000-0000-000000000200')
$$, '42501', 'workspace_native_context_access_denied',
  'a native context cannot read an unrelated workspace');

select * from finish();
rollback;
