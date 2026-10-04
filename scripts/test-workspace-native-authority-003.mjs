import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Runs the actual migration/functions in an isolated PostgreSQL (PGlite).
// Fixtures model referenced canonical columns, not the entire migration chain.
// No remote connection, customer data, concurrency or deployment claim.
const { PGlite } = await import(process.env.CLADORA_PGLITE_PACKAGE || '@electric-sql/pglite');
const db = new PGlite();
const sqlFile = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
function functionSql(source, name) {
  const escaped = name.replaceAll('.', '\\.');
  const match = source.match(new RegExp(`create(?: or replace)? function ${escaped}\\([\\s\\S]*?\\n\\$\\$;`));
  assert.ok(match, `Missing canonical function ${name}`); return match[0];
}
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [tenant, otherTenant, user, otherUser, grantorUser, workspace, secondWorkspace, foreignWorkspace,
  role, emptyRole, grantorRole, member, otherMember, grantorMember, context, physicalContext, otherContext,
  grantorContext, property, building, unit, moduleId, permission, localRole, emptyLocalRole, grantorLocalRole,
  assignment, otherAssignment, grantorAssignment, binding, delegation] = Array.from({ length: 31 }, (_, i) => id(i + 1));
let cases = 0;
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
async function check(name, fn) { await fn(); cases++; console.log(`PASS ${name}`); }
async function changed(sql, fn) { await db.exec('begin'); try { await db.exec(sql); await fn(); } finally { await db.exec('rollback'); } }
const setActor = async (sub = user, aal = 'aal2') => q("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub, aal })]);
const native = async (ctx = context, ws = workspace) => (await q('select app_private.check_workspace_native_permission_v2($1,$2,$3,$4) as allowed', [ctx, ws, 'test.manage', 'test_native']))[0].allowed;
const resolve = async (ctx = context, ws = workspace) => q('select * from app_private.resolve_workspace_native_context_v2($1,$2)', [ctx, ws]);
const denied = async fn => assert.rejects(fn, e => e.code === '42501');
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema identity; create schema platform; create schema portfolio;
    create schema app_private; create schema customer_api;
    grant usage on schema customer_api,auth to authenticated;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table identity.roles(id uuid primary key,tenant_id uuid,code text);
    create table identity.memberships(id uuid primary key,tenant_id uuid,user_id uuid,role_id uuid,status text,starts_at timestamptz default now()-interval '1 day',ends_at timestamptz);
    create table identity.context_grants(id uuid primary key,membership_id uuid,tenant_id uuid,scope_type text,property_id uuid,building_id uuid,unit_id uuid,starts_at timestamptz default now()-interval '1 day',ends_at timestamptz);
    create table identity.permissions(id uuid primary key,code text);
    create table identity.role_permissions(role_id uuid,permission_id uuid,effect text);
    create table platform.customer_workspaces(id uuid primary key,tenant_id uuid,workspace_type text default 'building',environment text default 'PILOT',lifecycle_status text default 'ACTIVE');
    create table platform.workspace_roles(id uuid primary key,tenant_id uuid,customer_workspace_id uuid,scope_ceiling text default 'workspace',lifecycle_status text default 'published',valid_from timestamptz default now()-interval '1 day',valid_to timestamptz);
    create table platform.workspace_member_roles(id uuid primary key,tenant_id uuid,customer_workspace_id uuid,membership_id uuid,workspace_role_id uuid,scope_type text default 'workspace',property_id uuid,building_id uuid,unit_id uuid,valid_from timestamptz default now()-interval '1 day',valid_to timestamptz);
    create table platform.workspace_role_modules(workspace_role_id uuid,module_definition_id uuid);
    create table platform.workspace_role_permissions(workspace_role_id uuid,permission_id uuid,effect text);
    create table platform.module_definitions(id uuid primary key,code text,is_active boolean default true,lifecycle_status text default 'published',requires_aal2 boolean default true,entitlement_key text,valid_from timestamptz default now()-interval '1 day',valid_to timestamptz);
    create table platform.module_permission_bindings(id uuid primary key,module_definition_id uuid,permission_id uuid,is_assignable_to_local_role boolean default true,is_delegable boolean default true,requires_aal2 boolean default true,lifecycle_status text default 'active',valid_from timestamptz default now()-interval '1 day',valid_to timestamptz);
    create table platform.workspace_modules(customer_workspace_id uuid,module_code text,status text default 'active',valid_from timestamptz default now()-interval '1 day',valid_to timestamptz);
    create table platform.workspace_entitlements(customer_workspace_id uuid,entitlement_key text,boolean_value boolean,numeric_value numeric,override_value_json jsonb,override_expires_at timestamptz,valid_from timestamptz default now()-interval '1 day',valid_until timestamptz);
    create table platform.workspace_taxonomy_assignments(id uuid primary key,customer_workspace_id uuid,property_profile_id uuid,operating_model_id uuid,status text default 'active',valid_from timestamptz default now()-interval '1 day',valid_to timestamptz);
    create table platform.property_profiles(id uuid primary key); create table platform.operating_models(id uuid primary key);
    create table platform.module_property_profile_compatibilities(module_definition_id uuid,property_profile_id uuid,compatibility_level text);
    create table platform.module_operating_model_compatibilities(module_definition_id uuid,operating_model_id uuid,compatibility_level text);
    create table platform.workspace_property_bindings(property_id uuid,customer_workspace_id uuid,tenant_id uuid,status text default 'active',valid_from timestamptz default now()-interval '1 day',valid_to timestamptz);
    create table portfolio.properties(id uuid primary key,tenant_id uuid);
    create table portfolio.buildings(id uuid primary key,tenant_id uuid,property_id uuid);
    create table portfolio.units(id uuid primary key,tenant_id uuid,building_id uuid);
    create table platform.workspace_delegations(id uuid primary key,tenant_id uuid,customer_workspace_id uuid,grantee_membership_id uuid,grantor_membership_id uuid,lifecycle_status text default 'active',scope_type text default 'workspace',property_id uuid,building_id uuid,unit_id uuid,valid_from timestamptz default now()-interval '1 day',valid_until timestamptz default now()+interval '1 day');
    create table platform.workspace_delegation_permissions(delegation_id uuid,module_permission_binding_id uuid,module_definition_id uuid,permission_id uuid);
  `);
  const composition = sqlFile('20260917120000_workspace_dynamic_composition.sql');
  const delegated = sqlFile('20260919120000_workspace_delegations_approvals.sql');
  const ceiling = sqlFile('20261003083859_workspace_scoped_effective_permission.sql');
  await db.exec(functionSql(composition, 'app_private.resolve_workspace_from_customer_context_v1'));
  await db.exec(functionSql(sqlFile('20260902074312_customer_password_optional_mfa_policy.sql'), 'app_private.customer_mfa_required'));
  await db.exec(functionSql(delegated, 'app_private.check_direct_effective_permission_v1'));
  await db.exec(functionSql(delegated, 'app_private.check_effective_permission_v1'));
  await db.exec(functionSql(ceiling, 'app_private.context_covers_workspace_target_v1'));
  await db.exec(functionSql(ceiling, 'app_private.check_scoped_effective_permission_v1'));
  await db.exec(`
    insert into identity.roles values ('${role}','${tenant}','test_manager'),('${emptyRole}','${tenant}','test_consumer'),('${grantorRole}','${tenant}','test_provider');
    insert into identity.memberships(id,tenant_id,user_id,role_id,status) values
      ('${member}','${tenant}','${user}','${role}','active'),('${otherMember}','${tenant}','${otherUser}','${emptyRole}','active'),('${grantorMember}','${tenant}','${grantorUser}','${grantorRole}','active');
    insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id) values
      ('${context}','${member}','${tenant}','tenant',null),('${physicalContext}','${member}','${tenant}','property','${property}'),
      ('${otherContext}','${otherMember}','${tenant}','tenant',null),('${grantorContext}','${grantorMember}','${tenant}','tenant',null);
    insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id) values
      ('${id(50)}','${otherMember}','${tenant}','property','${property}');
    insert into platform.customer_workspaces(id,tenant_id) values ('${workspace}','${tenant}'),('${secondWorkspace}','${tenant}'),('${foreignWorkspace}','${otherTenant}');
    insert into platform.workspace_roles(id,tenant_id,customer_workspace_id) values ('${localRole}','${tenant}','${workspace}'),('${emptyLocalRole}','${tenant}','${workspace}'),('${grantorLocalRole}','${tenant}','${workspace}');
    insert into platform.workspace_member_roles(id,tenant_id,customer_workspace_id,membership_id,workspace_role_id) values
      ('${assignment}','${tenant}','${workspace}','${member}','${localRole}'),('${otherAssignment}','${tenant}','${workspace}','${otherMember}','${emptyLocalRole}'),('${grantorAssignment}','${tenant}','${workspace}','${grantorMember}','${grantorLocalRole}');
    insert into identity.permissions values ('${permission}','test.manage');
    insert into identity.role_permissions values ('${role}','${permission}','allow');
    insert into platform.module_definitions(id,code,entitlement_key) values ('${moduleId}','test_native','module.test_native');
    insert into platform.module_permission_bindings(id,module_definition_id,permission_id) values ('${binding}','${moduleId}','${permission}');
    insert into platform.workspace_modules(customer_workspace_id,module_code) values ('${workspace}','test_native');
    insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,boolean_value) values ('${workspace}','module.test_native',true);
    insert into platform.property_profiles values ('${id(101)}'); insert into platform.operating_models values ('${id(102)}');
    insert into platform.workspace_taxonomy_assignments(id,customer_workspace_id,property_profile_id,operating_model_id) values ('${id(103)}','${workspace}','${id(101)}','${id(102)}');
    insert into platform.module_property_profile_compatibilities values ('${moduleId}','${id(101)}','compatible');
    insert into platform.module_operating_model_compatibilities values ('${moduleId}','${id(102)}','compatible');
    insert into platform.workspace_role_modules values ('${localRole}','${moduleId}'),('${emptyLocalRole}','${moduleId}'),('${grantorLocalRole}','${moduleId}');
    insert into platform.workspace_role_permissions values ('${grantorLocalRole}','${permission}','allow');
    insert into portfolio.properties values ('${property}','${tenant}'); insert into portfolio.buildings values ('${building}','${tenant}','${property}'); insert into portfolio.units values ('${unit}','${tenant}','${building}');
    insert into platform.workspace_property_bindings(property_id,customer_workspace_id,tenant_id) values ('${property}','${workspace}','${tenant}');
    insert into platform.workspace_delegations(id,tenant_id,customer_workspace_id,grantee_membership_id,grantor_membership_id) values ('${delegation}','${tenant}','${workspace}','${otherMember}','${grantorMember}');
    insert into platform.workspace_delegation_permissions values ('${delegation}','${binding}','${moduleId}','${permission}');
  `);
  await setActor();
  const legacyInputs = [['workspace', workspace], ['workspace', secondWorkspace], ['property', property], ['building', building], ['unit', unit]];
  const legacy = async () => Promise.all(legacyInputs.map(([scope, target]) => q('select app_private.check_effective_permission_v1($1,$2,$3,$4,$5) as effective, app_private.check_scoped_effective_permission_v1($1,$2,$3,$4,$5) as scoped, app_private.check_direct_effective_permission_v1($1,$6,$2,$3,$4,$5) as direct', [physicalContext, 'test.manage', 'test_native', scope, target, member])));
  async function legacySnapshot() {
    const results = [await legacy()];
    for (const sql of [
      "update identity.role_permissions set effect='deny'",
      `insert into platform.workspace_role_permissions values ('${localRole}','${permission}','deny')`,
      `delete from identity.role_permissions; insert into platform.workspace_role_permissions values ('${localRole}','${permission}','allow')`,
      'update platform.workspace_entitlements set boolean_value=false',
      "update platform.workspace_modules set status='inactive'",
    ]) await changed(sql, async () => results.push(await legacy()));
    await setActor(otherUser);
    results.push(await q('select app_private.check_effective_permission_v1($1,$2,$3,\'property\',$4) as delegated', [id(50), 'test.manage', 'test_native', property]));
    await setActor(); return results;
  }
  const before = await legacySnapshot();
  await db.exec(sqlFile('20261003122445_workspace_native_context_authority_v2.sql'));
  await check('legacy direct/effective/scoped allow/deny/delegation results unchanged across 91 evaluations', async () => assert.deepEqual(await legacySnapshot(), before));
  await check('explicit native target resolves without a physical binding', async () => { const rows = await resolve(); assert.equal(rows.length, 1); assert.equal(rows[0].workspace_id, workspace); });
  await check('base permission remains behind explicit assignment', async () => assert.equal(await native(), true));
  await check('other workspace denied despite same tenant membership', async () => { assert.equal(await native(context, secondWorkspace), false); await denied(() => resolve(context, secondWorkspace)); });
  await check('foreign tenant workspace denied', async () => assert.equal(await native(context, foreignWorkspace), false));
  await check('physical Context never authorizes whole native workspace', async () => { assert.equal(await native(physicalContext), false); await denied(() => resolve(physicalContext)); });
  await check('null workspace does not fall through to legacy engine', async () => assert.equal(await native(context, null), false));
  await check('null context denied', async () => assert.equal(await native(null), false));
  await check('forged Context belonging to another user denied', async () => assert.equal(await native(otherContext), false));
  await check('target list only contains canonical authorized workspace', async () => assert.deepEqual((await q('select * from customer_api.list_workspace_targets_v2($1)', [context])).map(x => x.workspace_id), [workspace]));
  await check('tenant membership without assignment grants no native scope', async () => changed(`delete from platform.workspace_member_roles where id='${assignment}'`, async () => assert.equal(await native(), false)));
  for (const [name, sql] of [
    ['expired Context', `update identity.context_grants set ends_at=now() where id='${context}'`],
    ['future Context', `update identity.context_grants set starts_at=now()+interval '1 day' where id='${context}'`],
    ['revoked membership', `update identity.memberships set status='revoked' where id='${member}'`],
    ['expired membership', `update identity.memberships set ends_at=now() where id='${member}'`],
    ['future membership', `update identity.memberships set starts_at=now()+interval '1 day' where id='${member}'`],
    ['suspended workspace', `update platform.customer_workspaces set lifecycle_status='SUSPENDED' where id='${workspace}'`],
    ['expired assignment', `update platform.workspace_member_roles set valid_to=now() where id='${assignment}'`],
    ['future assignment', `update platform.workspace_member_roles set valid_from=now()+interval '1 day' where id='${assignment}'`],
    ['archived role', `update platform.workspace_roles set lifecycle_status='archived' where id='${localRole}'`],
    ['expired role', `update platform.workspace_roles set valid_to=now() where id='${localRole}'`],
    ['future role', `update platform.workspace_roles set valid_from=now()+interval '1 day' where id='${localRole}'`],
    ['property role assignment', `update platform.workspace_member_roles set scope_type='property',property_id='${property}' where id='${assignment}'`],
    ['wrong assignment tenant', `update platform.workspace_member_roles set tenant_id='${otherTenant}' where id='${assignment}'`],
    ['wrong role workspace', `update platform.workspace_roles set customer_workspace_id='${secondWorkspace}' where id='${localRole}'`],
    ['wrong role tenant', `update platform.workspace_roles set tenant_id='${otherTenant}' where id='${localRole}'`],
    ['identity role tenant mismatch', `update identity.roles set tenant_id='${otherTenant}' where id='${role}'`],
    ['inactive module', 'update platform.module_definitions set is_active=false'],
    ['expired module', 'update platform.module_definitions set valid_to=now()'],
    ['expired permission binding', 'update platform.module_permission_bindings set valid_to=now()'],
    ['non-assignable permission binding', 'update platform.module_permission_bindings set is_assignable_to_local_role=false'],
    ['ambiguous module version', `insert into platform.module_definitions(id,code,entitlement_key) values ('${id(120)}','test_native','module.test_native')`],
    ['ambiguous permission binding', `insert into platform.module_permission_bindings(id,module_definition_id,permission_id) values ('${id(121)}','${moduleId}','${permission}')`],
    ['disabled module activation', "update platform.workspace_modules set status='inactive'"],
    ['false entitlement', 'update platform.workspace_entitlements set boolean_value=false'],
    ['expired entitlement', 'update platform.workspace_entitlements set valid_until=now()'],
    ['missing taxonomy', 'delete from platform.workspace_taxonomy_assignments'],
    ['ambiguous taxonomy', `insert into platform.workspace_taxonomy_assignments(id,customer_workspace_id,property_profile_id,operating_model_id) values ('${id(122)}','${workspace}','${id(101)}','${id(102)}')`],
    ['incompatible taxonomy', "update platform.module_property_profile_compatibilities set compatibility_level='incompatible'"],
    ['base deny', "update identity.role_permissions set effect='deny'"],
    ['local deny overrides base allow', `insert into platform.workspace_role_permissions values ('${localRole}','${permission}','deny')`],
  ]) await check(`${name} fails closed`, async () => changed(sql, async () => assert.equal(await native(), false)));
  await check('module/binding AAL2 enforced in native path', async () => { await setActor(user, 'aal1'); assert.equal(await native(), false); await setActor(); });
  await check('customer MFA policy applies even when module is not sensitive', async () => changed(`update identity.roles set code='association_admin' where id='${role}'; update platform.module_definitions set requires_aal2=false; update platform.module_permission_bindings set requires_aal2=false`, async () => {
    await setActor(user, 'aal1'); assert.equal(await native(), false); await denied(() => resolve());
  }));
  await setActor();
  for (const scope of ['building', 'unit']) await check(`${scope} Context cannot widen into native scope`, async () => changed(`update identity.context_grants set scope_type='${scope}',property_id=null,building_id=null,unit_id=null where id='${context}'`, async () => assert.equal(await native(), false)));
  await check('anonymous caller denied', async () => { await setActor(null); assert.equal(await native(), false); await denied(() => resolve()); await setActor(); });
  await check('workspace assignment cannot substitute for a permission', async () => changed('delete from identity.role_permissions', async () => assert.equal(await native(), false)));
  await check('local allow passes canonical permission gate', async () => changed(`delete from identity.role_permissions; insert into platform.workspace_role_permissions values ('${localRole}','${permission}','allow')`, async () => assert.equal(await native(), true)));
  await check('valid delegated permission evaluates current direct grantor', async () => { await setActor(otherUser); assert.equal(await native(otherContext), true); await setActor(); });
  for (const [name, sql] of [
    ['revoked delegation', "update platform.workspace_delegations set lifecycle_status='revoked'"],
    ['expired delegation', 'update platform.workspace_delegations set valid_until=now()'],
    ['expired grantor Context', `update identity.context_grants set ends_at=now() where id='${grantorContext}'`],
    ['revoked grantor membership', `update identity.memberships set status='revoked' where id='${grantorMember}'`],
    ['expired grantor assignment', `update platform.workspace_member_roles set valid_to=now() where id='${grantorAssignment}'`],
    ['lost grantor permission', 'delete from platform.workspace_role_permissions'],
    ['physical grantor Context', `update identity.context_grants set scope_type='property',property_id='${property}' where id='${grantorContext}'`],
    ['non-delegable binding', 'update platform.module_permission_bindings set is_delegable=false'],
    ['grantee deny overrides delegation', `insert into platform.workspace_role_permissions values ('${emptyLocalRole}','${permission}','deny')`],
  ]) await check(`${name} denies delegated native permission`, async () => changed(sql, async () => { await setActor(otherUser); assert.equal(await native(otherContext), false); }));
  await setActor();
  await check('internal helpers have no public/anon/authenticated/service execute', async () => {
    for (const signature of [
      'app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid)',
      'app_private.resolve_workspace_native_context_v2(uuid,uuid)',
      'app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid)',
      'app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)',
      'app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)',
    ]) for (const roleName of ['anon', 'authenticated', 'service_role']) assert.equal((await q('select has_function_privilege($1,$2,\'EXECUTE\') as allowed', [roleName, signature]))[0].allowed, false);
  });
  await check('authenticated can list targets through gateway but not resolve internally', async () => {
    await db.exec('set role authenticated');
    try { assert.equal((await q('select * from customer_api.list_workspace_targets_v2($1)', [context])).length, 1); await denied(() => resolve()); } finally { await db.exec('reset role'); }
  });
  console.log(`${cases} PostgreSQL native workspace authority cases passed`);
  if (process.argv.includes('--airprop-runtime') || process.argv.includes('--airprop-underwriting') || (process.argv.includes('--airprop-diligence') || process.argv.includes('--airprop-diligence-review'))) {
    const { runAirpropNativeRuntimeTests } = await import('./test-airprop-native-runtime-004.mjs');
    await runAirpropNativeRuntimeTests({ db, q, check, changed, setActor, id, tenant, otherTenant, user, otherUser, workspace, secondWorkspace, foreignWorkspace, context, otherContext, physicalContext, localRole, member, property });
  }
  if (process.argv.includes('--airprop-underwriting') || (process.argv.includes('--airprop-diligence') || process.argv.includes('--airprop-diligence-review'))) {
    const { runAirpropUnderwritingTests } = await import('./test-airprop-underwriting-runtime-007.mjs');
    await runAirpropUnderwritingTests({ db,q,check,changed,setActor,id,tenant,otherTenant,user,otherUser,workspace,secondWorkspace,foreignWorkspace,context,otherContext,physicalContext,localRole,member,property });
  }
  if ((process.argv.includes('--airprop-diligence') || process.argv.includes('--airprop-diligence-review'))) {
    const { runAirpropDiligenceTests } = await import('./test-airprop-diligence-runtime-011.mjs');
    await runAirpropDiligenceTests({db,q,check,changed,setActor,id,tenant,user,workspace,secondWorkspace,context,physicalContext,localRole,member});
  }
  if (process.argv.includes('--airprop-diligence-review')) {
    const { runAirpropDiligenceReviewTests } = await import('./test-airprop-diligence-runtime-012.mjs');
    await runAirpropDiligenceReviewTests({db,q,check,changed,setActor,id,tenant,user,otherUser,workspace,secondWorkspace,context,physicalContext,localRole,member,property});
  }
  if (process.argv.includes('--role-assignment')) {
    const { runWorkspaceRoleAssignmentTests } = await import('./test-workspace-role-assignment-runtime.mjs');
    await runWorkspaceRoleAssignmentTests({ db,q,check,changed,setActor,id,tenant,user,otherUser,workspace,secondWorkspace,context,otherContext,physicalContext,member });
  }
} finally { await db.close(); }
