import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import pg from 'pg';

const connectionString = process.env.SERVICE_ROLE_GRAPH_ISOLATION_TEST_DATABASE_URL;
if (!connectionString || process.env.SERVICE_ROLE_GRAPH_ISOLATION_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable SERVICE role-graph PostgreSQL target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  || target.pathname !== '/postgres') {
  throw new Error('Local disposable PostgreSQL /postgres target required');
}

const s3Name = '20261018163000_service_subject_link_role_bound_pool_privileged_v1.sql';
const s4Name = '20261018170000_communications_service_role_acl_shutdown_v1.sql';
const s3 = readFileSync(new URL(`../supabase/migrations/${s3Name}`, import.meta.url), 'utf8');
const s4 = readFileSync(new URL(`../supabase/migrations/${s4Name}`, import.meta.url), 'utf8');
const migrations = readdirSync(new URL('../supabase/migrations', import.meta.url))
  .filter(name => name.endsWith('.sql')).sort();

assert.equal(migrations.length, 287);
const s3Index = migrations.indexOf(s3Name);
assert.ok(s3Index >= 0);
assert.equal(migrations[s3Index + 1], s4Name);
assert.match(s3, /create function app_private\.core_platform_service_subject_link_role_safety_valid_v1\(\)/i);
assert.match(s3, /create table app_private\.service_subject_link_step_su_02_receipt_v1/i);
assert.match(s4, /service_subject_link_step_su_02_receipt_missing_or_untrusted/i);
assert.match(s4, /revoke all privileges on table\s+communications\.private_conversations,\s+communications\.private_participants,\s+communications\.private_messages,\s+communications\.private_message_documents\s+from service_role/i);
assert.equal(existsSync(new URL(
  '../src/app/api/customer/v1/services/requests/[id]/subject-links/route.ts', import.meta.url,
)), false, 'S5 route must remain absent');

const runtimeRole = 'cladora_service_subject_link_runtime';
const executorRole = 'cladora_service_subject_link_executor';
const ownerRole = 'cladora_service_subject_link_owner';
const protectedRoles = [runtimeRole, executorRole, ownerRole];
const protectedRoleSql = protectedRoles.map(role => `'${role}'`).join(',');

const expectedOwnedFunctions = [
  ['communications.resolve_private_message_currentness_v2(uuid,uuid,uuid,uuid,bigint)', true, 's'],
  ['communications.resolve_private_message_request_audience_current_v2(uuid,uuid,uuid,uuid,bigint,uuid,bigint)', true, 'v'],
  ['app_private.execute_service_request_message_link_v2(text,uuid,uuid,uuid,uuid,bigint,uuid,bigint)', true, 'v'],
  ['app_private.core_platform_service_subject_link_scope_allowed_v1(uuid,uuid)', true, 's'],
  ['app_private.core_platform_service_subject_link_binding_allowed_v1(uuid,uuid)', true, 's'],
  ['app_private.core_platform_service_subject_link_authority_allowed_v1()', true, 's'],
  ['app_private.core_platform_service_subject_link_identity_allowed_v1(text,uuid,uuid)', true, 's'],
  ['app_private.core_platform_service_subject_link_ledger_allowed_v1(uuid,uuid,text,uuid)', true, 's'],
  ['app_private.core_platform_service_subject_link_role_safety_valid_v1()', false, 's'],
  ['app_private.assert_service_subject_link_role_safety_v1()', false, 's'],
  ['app_private.acquire_service_subject_link_role_safety_lease_v1()', false, 'v'],
  ['app_private.finalize_service_subject_link_role_membership_v1()', false, 'v'],
];
const expectedFunctionValues = expectedOwnedFunctions.map(([signature, securityDefiner, volatility]) =>
  `('${signature}'::text,${securityDefiner},'${volatility}'::\"char\")`).join(',');

const protectedRelations = [
  ['communications', 'private_conversations'],
  ['communications', 'private_messages'],
  ['communications', 'private_participants'],
  ['identity', 'membership_parties'],
  ['service_catalog', 'offerings'],
  ['portfolio', 'parties'],
  ['portfolio', 'units'],
  ['portfolio', 'buildings'],
  ['maintenance', 'vendor_portal_memberships'],
  ['maintenance', 'vendors'],
  ['platform', 'workspace_property_bindings'],
  ['platform', 'customer_workspaces'],
  ['platform', 'workspace_entitlements'],
  ['service_catalog', 'requests'],
  ['service_catalog', 'request_subject_links'],
  ['identity', 'context_grants'],
  ['identity', 'memberships'],
  ['platform', 'module_definitions'],
  ['app_private', 'canonical_authority_revision_v1'],
  ['platform', 'idempotency_keys'],
  ['audit', 'events'],
  ['platform', 'outbox_events'],
];
const protectedRelationValues = protectedRelations
  .map(([schema, relation]) => `('${schema}'::text,'${relation}'::text)`).join(',');

const pool = new pg.Pool({ connectionString, max: 1 });
const client = await pool.connect();
let checks = 0;
let catalogFingerprint;
let policyFingerprint;

async function check(name, operation) {
  await operation();
  checks += 1;
  console.log(`ok ${checks} - ${name}`);
}

async function exactSafetyValue(databaseClient) {
  try {
    await databaseClient.query(`set session authorization ${runtimeRole}`);
    await databaseClient.query(`set role ${executorRole}`);
    return (await databaseClient.query(
      'select app_private.core_platform_service_subject_link_role_safety_valid_v1() value',
    )).rows[0]?.value;
  } finally {
    await databaseClient.query('reset role').catch(() => undefined);
    await databaseClient.query('reset session authorization').catch(() => undefined);
  }
}

async function verifyCatalog(databaseClient) {
  const roles = (await databaseClient.query(`select rolname,rolcanlogin,rolinherit,rolsuper,
      rolbypassrls,rolcreatedb,rolcreaterole,rolreplication
    from pg_roles where rolname like 'cladora_service_subject_link_%'
    order by rolname`)).rows;
  assert.deepEqual(roles, [
    { rolname: executorRole, rolcanlogin: false, rolinherit: false, rolsuper: false,
      rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false },
    { rolname: ownerRole, rolcanlogin: false, rolinherit: false, rolsuper: false,
      rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false },
    { rolname: runtimeRole, rolcanlogin: true, rolinherit: false, rolsuper: false,
      rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false },
  ]);

  const edges = (await databaseClient.query(`select granted.rolname granted_role,
      member.rolname member_role,m.admin_option,m.inherit_option,m.set_option
    from pg_auth_members m join pg_roles granted on granted.oid=m.roleid
    join pg_roles member on member.oid=m.member
    where granted.rolname in (${protectedRoleSql}) or member.rolname in (${protectedRoleSql})
    order by granted.rolname,member.rolname`)).rows;
  assert.deepEqual(edges, [{
    granted_role: executorRole, member_role: runtimeRole,
    admin_option: false, inherit_option: false, set_option: true,
  }]);

  const closure = (await databaseClient.query(`with recursive connected(oid) as (
      select oid from pg_roles where rolname in (${protectedRoleSql})
      union
      select case when membership.member=connected.oid then membership.roleid
        else membership.member end
      from connected join pg_auth_members membership
        on membership.member=connected.oid or membership.roleid=connected.oid
    )
    select role.rolname,role.rolsuper,role.rolbypassrls
    from connected join pg_roles role on role.oid=connected.oid order by role.rolname`)).rows;
  assert.deepEqual(closure, [
    { rolname: executorRole, rolsuper: false, rolbypassrls: false },
    { rolname: ownerRole, rolsuper: false, rolbypassrls: false },
    { rolname: runtimeRole, rolsuper: false, rolbypassrls: false },
  ], 'recursive role closure must exclude CE, service_role, postgres and every owner role');

  const ownership = (await databaseClient.query(`with role_ids as (
      select oid,rolname from pg_roles where rolname in (${protectedRoleSql})
    ), ownership(owner_name,object_kind) as (
      select r.rolname,'database' from pg_database o join role_ids r on r.oid=o.datdba
      union all select r.rolname,'schema' from pg_namespace o join role_ids r on r.oid=o.nspowner
      union all select r.rolname,'relation' from pg_class o join role_ids r on r.oid=o.relowner
      union all select r.rolname,'function' from pg_proc o join role_ids r on r.oid=o.proowner
      union all select r.rolname,'type' from pg_type o join role_ids r on r.oid=o.typowner
      union all select r.rolname,'operator' from pg_operator o join role_ids r on r.oid=o.oprowner
      union all select r.rolname,'conversion' from pg_conversion o join role_ids r on r.oid=o.conowner
      union all select r.rolname,'collation' from pg_collation o join role_ids r on r.oid=o.collowner
      union all select r.rolname,'text_search_config' from pg_ts_config o join role_ids r on r.oid=o.cfgowner
      union all select r.rolname,'text_search_dictionary' from pg_ts_dict o join role_ids r on r.oid=o.dictowner
      union all select r.rolname,'foreign_data_wrapper' from pg_foreign_data_wrapper o join role_ids r on r.oid=o.fdwowner
      union all select r.rolname,'foreign_server' from pg_foreign_server o join role_ids r on r.oid=o.srvowner
      union all select r.rolname,'event_trigger' from pg_event_trigger o join role_ids r on r.oid=o.evtowner
      union all select r.rolname,'publication' from pg_publication o join role_ids r on r.oid=o.pubowner
    )
    select owner_name,object_kind,count(*)::integer object_count from ownership
    group by owner_name,object_kind order by owner_name,object_kind`)).rows;
  assert.deepEqual(ownership, [{
    owner_name: ownerRole, object_kind: 'function', object_count: 12,
  }], 'runtime/executor own nothing and package owner owns functions only');

  const runtimeAclCount = Number((await databaseClient.query(`with runtime as (
      select oid from pg_roles where rolname='${runtimeRole}'
    ), acl_lines as (
      select privilege.grantee from pg_database object
        cross join lateral aclexplode(object.datacl) privilege
      union all select privilege.grantee from pg_namespace object
        cross join lateral aclexplode(object.nspacl) privilege
      union all select privilege.grantee from pg_class object
        cross join lateral aclexplode(object.relacl) privilege
      union all select privilege.grantee from pg_attribute object
        cross join lateral aclexplode(object.attacl) privilege
      union all select privilege.grantee from pg_proc object
        cross join lateral aclexplode(object.proacl) privilege
      union all select privilege.grantee from pg_type object
        cross join lateral aclexplode(object.typacl) privilege
      union all select privilege.grantee from pg_default_acl object
        cross join lateral aclexplode(object.defaclacl) privilege
    ) select count(*)::integer value from acl_lines,runtime where grantee=runtime.oid`)).rows[0].value);
  assert.equal(runtimeAclCount, 0, 'runtime must have zero direct ACL entries');

  const functionInventory = (await databaseClient.query(`with expected(signature,security_definer,volatility) as (values
      ${expectedFunctionValues}
    ), resolved as (
      select signature,to_regprocedure(signature) oid,security_definer,volatility from expected
    ), actual as (
      select function.oid,function.prosecdef,function.provolatile,function.proconfig,
        owner.rolname owner_name
      from pg_proc function join pg_roles owner on owner.oid=function.proowner
    ) select
      (select count(*)::integer from resolved where oid is not null) resolved_count,
      (select count(*)::integer from actual where owner_name='${ownerRole}') owner_count,
      (select count(*)::integer from resolved join actual using(oid)
        where owner_name='${ownerRole}' and prosecdef=security_definer
          and provolatile=volatility and proconfig=array['search_path=pg_catalog']::text[]) valid_count,
      (select count(*)::integer from actual where owner_name='${ownerRole}'
        and oid not in (select oid from resolved where oid is not null)) unexpected_count`)).rows[0];
  assert.deepEqual(functionInventory, {
    resolved_count: 12, owner_count: 12, valid_count: 12, unexpected_count: 0,
  }, 'package functions must have exact owner, security mode, volatility and search_path');

  const forbiddenDirectExecute = Number((await databaseClient.query(`with protected(signature) as (values
      ${expectedOwnedFunctions.map(([signature]) => `('${signature}'::text)`).join(',')}
    ), callers(role_oid) as (
      select 0::oid
      union all select oid from pg_roles where rolname in (
        'anon','authenticated','service_role','${runtimeRole}')
    ), direct_execute as (
      select function.oid,privilege.grantee
      from protected join pg_proc function on function.oid=to_regprocedure(signature)
      cross join lateral aclexplode(coalesce(function.proacl,
        acldefault('f',function.proowner))) privilege
      where privilege.privilege_type='EXECUTE'
    ) select count(*)::integer value from direct_execute
      join callers on callers.role_oid=direct_execute.grantee`)).rows[0].value);
  assert.equal(forbiddenDirectExecute, 0,
    'public, client, service_role and runtime direct EXECUTE ACL must remain absent');

  const exposedV2Count = Number((await databaseClient.query(`select count(*)::integer value
    from pg_proc function join pg_namespace namespace on namespace.oid=function.pronamespace
    where namespace.nspname in ('public','customer_api') and (
      function.proname='execute_service_request_message_link_v2'
      or function.proname ~ '^.*service.*request.*(subject|message).*link.*v2$')`)).rows[0].value);
  assert.equal(exposedV2Count, 0, 'S5 public/customer V2 entrypoint must remain absent');

  const executorBoundary = (await databaseClient.query(`with protected(schema_name,relation_name) as (values
      ${protectedRelationValues},('communications','private_message_documents')
    ) select
      (select count(*)::integer from pg_class relation
        join pg_namespace namespace on namespace.oid=relation.relnamespace
        cross join lateral aclexplode(relation.relacl) privilege
        where relation.relkind in ('r','p','v','m','f')
          and privilege.grantee=(select oid from pg_roles where rolname='${executorRole}')) direct_table_acl,
      (select count(*)::integer from protected
        where has_table_privilege('${executorRole}',format('%I.%I',schema_name,relation_name),'DELETE')
          or has_table_privilege('${executorRole}',format('%I.%I',schema_name,relation_name),'TRUNCATE')) forbidden_mutation,
      (select count(*)::integer from pg_namespace namespace
        where namespace.nspname !~ '^pg_' and namespace.nspname<>'information_schema'
          and has_schema_privilege('${executorRole}',namespace.oid,'CREATE')) schema_create`)).rows[0];
  assert.deepEqual(executorBoundary, {
    direct_table_acl: 0, forbidden_mutation: 0, schema_create: 0,
  }, 'executor must have no wildcard table ACL, DELETE, TRUNCATE or schema CREATE');

  const aclManifest = (await databaseClient.query(`with roles as (
      select oid,rolname from pg_roles where rolname in (${protectedRoleSql})
    ), lines(value) as (
      select concat_ws('|',role.rolname,'schema',namespace.nspname,privilege.privilege_type)
      from pg_namespace namespace cross join roles role
      cross join lateral aclexplode(coalesce(namespace.nspacl,
        acldefault('n',namespace.nspowner))) privilege where privilege.grantee=role.oid
      union all
      select concat_ws('|',role.rolname,'relation',namespace.nspname||'.'||relation.relname,
        privilege.privilege_type) from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace cross join roles role
      cross join lateral aclexplode(coalesce(relation.relacl,acldefault(
        case when relation.relkind='S' then 'S'::\"char\" else 'r'::\"char\" end,
        relation.relowner))) privilege where privilege.grantee=role.oid
      union all
      select concat_ws('|',role.rolname,'column',namespace.nspname||'.'||relation.relname||'.'||attribute.attname,
        privilege.privilege_type) from pg_attribute attribute
      join pg_class relation on relation.oid=attribute.attrelid
      join pg_namespace namespace on namespace.oid=relation.relnamespace cross join roles role
      cross join lateral aclexplode(attribute.attacl) privilege
      where attribute.attnum>0 and not attribute.attisdropped and privilege.grantee=role.oid
      union all
      select concat_ws('|',role.rolname,'function',namespace.nspname||'.'||function.proname||'('||
        function.proargtypes::text||')',privilege.privilege_type)
      from pg_proc function join pg_namespace namespace on namespace.oid=function.pronamespace
      cross join roles role cross join lateral aclexplode(coalesce(function.proacl,
        acldefault('f',function.proowner))) privilege where privilege.grantee=role.oid
    ) select count(*)::integer line_count,
      md5(string_agg(value,E'\\n' order by value)) fingerprint from lines`)).rows[0];
  assert.deepEqual(aclManifest, {
    line_count: 160, fingerprint: 'f0f91a9eb48b953ee558032b34aa5c42',
  }, 'executor/owner ACL manifest must remain exact');

  const rlsCount = Number((await databaseClient.query(`with protected(schema_name,relation_name) as (values
      ${protectedRelationValues}
    ) select count(*)::integer value from protected
    join pg_namespace namespace on namespace.nspname=protected.schema_name
    join pg_class relation on relation.relnamespace=namespace.oid
      and relation.relname=protected.relation_name where relation.relrowsecurity`)).rows[0].value);
  assert.equal(rlsCount, 22, 'RLS must remain enabled on every protected relation');

  const policies = (await databaseClient.query(`with service_policies as (
      select namespace.nspname schema_name,relation.relname relation_name,
        policy.polname policy_name,policy.polcmd,policy.polpermissive,
        array(select role.rolname from unnest(policy.polroles) role_oid
          join pg_roles role on role.oid=role_oid order by role.rolname) policy_roles,
        coalesce(pg_get_expr(policy.polqual,policy.polrelid),'') policy_using,
        coalesce(pg_get_expr(policy.polwithcheck,policy.polrelid),'') policy_check
      from pg_policy policy join pg_class relation on relation.oid=policy.polrelid
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where policy.polname like 'core_platform_service_subject_link_%'
        or policy.polname like 'service_subject_link_owner_%'
    ) select count(*)::integer policy_count,
      count(*) filter(where not polpermissive or cardinality(policy_roles)<>1)::integer invalid_count,
      md5(string_agg(concat_ws('|',schema_name,relation_name,policy_name,polcmd,
        polpermissive::text,policy_roles::text,policy_using,policy_check),E'\\n'
        order by schema_name,relation_name,policy_name)) fingerprint from service_policies`)).rows[0];
  assert.deepEqual(policies, {
    policy_count: 47, invalid_count: 0, fingerprint: 'd213e945cd67e42ac72dc9d4cbdda6e2',
  }, 'SERVICE RLS policy manifest must remain exact');

  const s4Boundary = (await databaseClient.query(`with targets(relation_name) as (values
      ('communications.private_conversations'::text),
      ('communications.private_participants'),('communications.private_messages'),
      ('communications.private_message_documents')
    ), leaks as (
      select relation_name,privilege_name from targets cross join unnest(array[
        'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'
      ]) privilege_name where has_table_privilege('service_role',relation_name,privilege_name)
      union all select relation_name,privilege_name from targets cross join unnest(array[
        'SELECT','INSERT','UPDATE','REFERENCES'
      ]) privilege_name where has_any_column_privilege('service_role',relation_name,privilege_name)
    ) select
      (select count(*)::integer from leaks) effective_leaks,
      (select count(*)::integer from pg_class relation
        join pg_namespace namespace on namespace.oid=relation.relnamespace
        cross join lateral aclexplode(relation.relacl) privilege
        where namespace.nspname='communications'
          and relation.relname in ('private_conversations','private_participants',
            'private_messages','private_message_documents')
          and privilege.grantee=(select oid from pg_roles where rolname='service_role')) direct_acl,
      (select count(*)::integer from pg_policy policy
        join pg_class relation on relation.oid=policy.polrelid
        join pg_namespace namespace on namespace.oid=relation.relnamespace
        where namespace.nspname='communications'
          and relation.relname in ('private_conversations','private_participants',
            'private_messages','private_message_documents')
          and (0=any(policy.polroles) or
            (select oid from pg_roles where rolname='service_role')=any(policy.polroles))) policy_leaks,
      (select count(*)::integer from pg_class relation
        join pg_namespace namespace on namespace.oid=relation.relnamespace
        where namespace.nspname='communications'
          and relation.relname in ('private_conversations','private_participants',
            'private_messages','private_message_documents') and relation.relrowsecurity) rls_tables`)).rows[0];
  assert.deepEqual(s4Boundary, {
    effective_leaks: 0, direct_acl: 0, policy_leaks: 0, rls_tables: 4,
  }, 'S4 must leave service_role with zero capability on all four tables');

  assert.equal(await exactSafetyValue(databaseClient), true,
    'database-owned exact catalog safety assertion must agree with independent verifier');
  catalogFingerprint = aclManifest.fingerprint;
  policyFingerprint = policies.fingerprint;
}

async function expectCatalogDriftRejected(name, mutationSql) {
  await client.query('begin');
  try {
    await client.query(mutationSql);
    await assert.rejects(() => verifyCatalog(client), error => error instanceof assert.AssertionError,
      `${name} must invalidate the verifier`);
  } finally {
    await client.query('rollback').catch(() => undefined);
    await client.query('reset role').catch(() => undefined);
    await client.query('reset session authorization').catch(() => undefined);
  }
  await verifyCatalog(client);
}

async function assertDirectExecutorDenial(statement) {
  await client.query('begin');
  try {
    await client.query(`set session authorization ${runtimeRole}`);
    await client.query(`set role ${executorRole}`);
    await assert.rejects(client.query(statement), error => error?.code === '42501');
  } finally {
    await client.query('rollback').catch(() => undefined);
    await client.query('reset role').catch(() => undefined);
    await client.query('reset session authorization').catch(() => undefined);
  }
}

async function assertDirectRoleFunctionDenial(roleName) {
  await client.query('begin');
  try {
    await client.query(`set session authorization ${roleName}`);
    await assert.rejects(client.query(`select * from
      app_private.execute_service_request_message_link_v2(
        'validate',null::uuid,null::uuid,null::uuid,null::uuid,1,null::uuid,1)`),
    error => error?.code === '42501');
  } finally {
    await client.query('rollback').catch(() => undefined);
    await client.query('reset role').catch(() => undefined);
    await client.query('reset session authorization').catch(() => undefined);
  }
}

try {
  await check('target is a local writable PostgreSQL 17 superuser fixture', async () => {
    const identity = (await client.query(`select current_user::text,
      (select rolsuper from pg_roles where rolname=current_user) rolsuper,
      current_setting('server_version_num')::integer version_num,
      current_setting('transaction_read_only') read_only`)).rows[0];
    assert.equal(identity.rolsuper, true);
    assert.ok(identity.version_num >= 170000 && identity.version_num < 180000);
    assert.equal(identity.read_only, 'off');
  });

  await check('exact S3/S4 role graph, ownership, ACL, function and RLS manifests hold', async () => {
    await verifyCatalog(client);
  });

  await check('executor direct domain-table access fails with SQLSTATE 42501', async () => {
    await assertDirectExecutorDenial('select * from communications.private_messages limit 1');
    await assertDirectExecutorDenial('delete from service_catalog.requests where false');
  });

  await check('clients, service_role and runtime cannot execute S2 without SET ROLE', async () => {
    for (const roleName of ['anon', 'authenticated', 'service_role', runtimeRole]) {
      await assertDirectRoleFunctionDenial(roleName);
    }
  });

  const negativeCases = [
    ['unexpected SERVICE role', `create role cladora_service_subject_link_unexpected
      nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication`],
    ['unexpected CE membership edge', `grant cladora_ce_guide_executor
      to ${runtimeRole} with admin false, inherit false, set true`],
    ['unexpected executor table ACL', `grant delete on service_catalog.requests to ${executorRole}`],
    ['unexpected protected-function owner', `alter function
      app_private.execute_service_request_message_link_v2(
        text,uuid,uuid,uuid,uuid,bigint,uuid,bigint) owner to postgres`],
    ['unexpected protected-relation policy', `create policy service_subject_link_unexpected_policy
      on platform.customer_workspaces for select to ${runtimeRole} using(true)`],
    ['unexpected package-owner function', `create function
      app_private.service_subject_link_unexpected_v1() returns boolean language sql stable
      set search_path=pg_catalog as 'select true';
      alter function app_private.service_subject_link_unexpected_v1() owner to ${ownerRole}`],
    ['unexpected protected-function security metadata', `alter function
      app_private.core_platform_service_subject_link_scope_allowed_v1(uuid,uuid)
      security invoker; alter function
      app_private.core_platform_service_subject_link_scope_allowed_v1(uuid,uuid) reset all`],
  ];
  for (const [name, sql] of negativeCases) {
    await check(`${name} invalidates the catalog verifier and rolls back cleanly`, async () => {
      await expectCatalogDriftRejected(name, sql);
    });
  }

  console.log(JSON.stringify({
    contract: 'service-role-graph-isolation.v1',
    checks,
    migration_count: migrations.length,
    s3_sha256: createHash('sha256').update(s3).digest('hex'),
    s4_sha256: createHash('sha256').update(s4).digest('hex'),
    acl_fingerprint: catalogFingerprint,
    policy_fingerprint: policyFingerprint,
    s5_activation: false,
  }));
} finally {
  client.release(true);
  await pool.end();
}
