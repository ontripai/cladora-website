import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

const connectionString = process.env.CORE_READ_AUTHORITY_PROFILE_TEST_DATABASE_URL;
if (!connectionString || process.env.CORE_READ_AUTHORITY_PROFILE_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/postgres') {
  throw new Error('Local disposable PostgreSQL only');
}

const pool = new pg.Pool({ connectionString, max: 2 });
const client = await pool.connect();
const ids = {
  tenant: randomUUID(),
  workspace: randomUUID(),
  otherWorkspace: randomUUID(),
  readActor: randomUUID(),
  manageActor: randomUUID(),
  readMembership: randomUUID(),
  manageMembership: randomUUID(),
  readContext: randomUUID(),
  manageContext: randomUUID(),
  readRole: randomUUID(),
  manageRole: randomUUID(),
  readAssignment: randomUUID(),
  manageAssignment: randomUUID(),
};
let checks = 0;
const check = async (name, fn) => {
  await fn();
  checks += 1;
  console.log(`ok ${checks} - ${name}`);
};

const setActor = actor => client.query(
  `select set_config('request.jwt.claims',$1,true),
    set_config('request.jwt.claim.sub',$2,true),
    set_config('request.jwt.claim.aal','aal2',true)`,
  [JSON.stringify({ sub: actor, role: 'authenticated', aal: 'aal2' }), actor],
);
const allowed = async (context, workspace, permission, module = 'experience_guides') => {
  const result = await client.query(
    `select app_private.check_workspace_native_permission_v2($1,$2,$3,$4) as allowed`,
    [context, workspace, permission, module],
  );
  return result.rows[0]?.allowed === true;
};
const revision = async () => Number((await client.query(
  `select revision::text from app_private.canonical_authority_revision_v1 where singleton`,
)).rows[0].revision);
const durableDigest = async () => {
  const result = await client.query(`select
    (select count(*)::text from platform.idempotency_keys) as idempotency,
    (select count(*)::text from audit.events) as audit,
    (select count(*)::text from platform.outbox_events) as outbox,
    (select count(*)::text from experience.guides) as guides,
    (select count(*)::text from experience.guide_steps) as guide_steps,
    (select count(*)::text from experience.guide_references) as guide_references`);
  return createHash('sha256').update(JSON.stringify(result.rows[0])).digest('hex');
};

try {
  await check('clean bootstrap contains one exact inactive registry profile', async () => {
    const history = await client.query(`select count(*)::int as n
      from supabase_migrations.schema_migrations where version='20261016080831'`);
    assert.equal(history.rows[0].n, 1);
    const registry = await client.query(`select
      p.code as permission_code,p.resource,p.action,
      m.code as module_code,m.version,m.entitlement_key,m.is_active,m.lifecycle_status,
      m.requires_aal2,b.binding_version,b.permission_mode,b.is_assignable_to_local_role,
      b.is_delegable,b.requires_aal2 as binding_requires_aal2,b.lifecycle_status as binding_status
      from identity.permissions p
      join platform.module_permission_bindings b on b.permission_id=p.id
      join platform.module_definitions m on m.id=b.module_definition_id
      where p.code='experience.guide.read' and m.code='experience_guides'`);
    assert.equal(registry.rowCount, 1);
    assert.deepEqual(registry.rows[0], {
      permission_code: 'experience.guide.read', resource: 'experience.guide', action: 'read',
      module_code: 'experience_guides', version: 1,
      entitlement_key: 'module.experience_guides', is_active: true,
      lifecycle_status: 'published', requires_aal2: true, binding_version: 1,
      permission_mode: 'read', is_assignable_to_local_role: true, is_delegable: false,
      binding_requires_aal2: true, binding_status: 'active',
    });
    const activation = await client.query(`select
      (select count(*)::int from identity.role_permissions rp join identity.permissions p
        on p.id=rp.permission_id where p.code='experience.guide.read') as global_roles,
      (select count(*)::int from platform.workspace_role_permissions wrp
        join identity.permissions p on p.id=wrp.permission_id
        where p.code='experience.guide.read') as workspace_roles,
      (select count(*)::int from platform.workspace_modules
        where module_code='experience_guides') as workspace_modules,
      (select count(*)::int from platform.workspace_entitlements
        where entitlement_key='module.experience_guides') as entitlements`);
    assert.deepEqual(activation.rows[0], {
      global_roles: 0, workspace_roles: 0, workspace_modules: 0, entitlements: 0,
    });
  });

  await check('registry owner, ACL and RLS inventory remains on canonical tables', async () => {
    const inventory = await client.query(`select n.nspname as schema_name,c.relname,
      r.rolname as owner,c.relrowsecurity,c.relacl::text as acl
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      join pg_roles r on r.oid=c.relowner
      where (n.nspname,c.relname) in (
        ('identity','permissions'),('platform','module_definitions'),
        ('platform','module_permission_bindings'),('platform','workspace_entitlements'))
      order by n.nspname,c.relname`);
    assert.equal(inventory.rowCount, 4);
    assert.ok(inventory.rows.every(row => row.relrowsecurity === true));
    assert.ok(inventory.rows.every(row => typeof row.owner === 'string' && row.owner.length > 0));
    console.log(`catalog_inventory_sha256=${createHash('sha256')
      .update(JSON.stringify(inventory.rows)).digest('hex')}`);
  });

  await client.query('begin');
  const baseRole = (await client.query(`select id from identity.roles
    where tenant_id is null and is_system and code='association_admin'`)).rows[0];
  const taxonomy = (await client.query(`select p.id as property_profile_id,o.id as operating_model_id
    from platform.property_profiles p cross join platform.operating_models o
    where p.code='residential_condominium' and p.version=1
      and o.code='association_managed' and o.version=1`)).rows[0];
  const moduleDefinition = (await client.query(`select id from platform.module_definitions
    where code='experience_guides' and version=1`)).rows[0];
  const readPermission = (await client.query(`select id from identity.permissions
    where code='experience.guide.read'`)).rows[0];
  assert.ok(baseRole && taxonomy && moduleDefinition && readPermission);

  await client.query(`insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
    ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$3,now(),now()),
    ($2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$4,now(),now())`, [
    ids.readActor, ids.manageActor,
    `read-profile-${ids.readActor}@example.invalid`,
    `manage-profile-${ids.manageActor}@example.invalid`,
  ]);
  await client.query(`insert into platform.tenants(id,legal_name,registration_number,status)
    values($1,'Core read profile disposable',$2,'active')`,
  [ids.tenant, `CORE-READ-${ids.tenant}`]);
  await client.query(`insert into platform.customer_workspaces(
    id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status,activated_at
  ) values
    ($1,$3,'OWNER_PORTFOLIO','Core read fixture','PILOT','ACTIVE',statement_timestamp()),
    ($2,$3,'OWNER_PORTFOLIO','Core read other fixture','PILOT','ACTIVE',statement_timestamp())`,
  [ids.workspace, ids.otherWorkspace, ids.tenant]);
  await client.query(`insert into platform.workspace_taxonomy_assignments(
    tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,
    valid_from,notes,created_by
  ) values($1,$2,$3,$4,'active',statement_timestamp()-interval '1 second',$5,$6)`, [
    ids.tenant, ids.workspace, taxonomy.property_profile_id, taxonomy.operating_model_id,
    'Core read authority profile disposable taxonomy', ids.readActor,
  ]);
  await client.query(`insert into platform.module_property_profile_compatibilities(
    module_definition_id,property_profile_id,compatibility_level,reason
  ) values($1,$2,'compatible','Core read authority profile disposable compatibility')
    on conflict(module_definition_id,property_profile_id) do nothing`,
  [moduleDefinition.id, taxonomy.property_profile_id]);
  await client.query(`insert into platform.module_operating_model_compatibilities(
    module_definition_id,operating_model_id,compatibility_level,reason
  ) values($1,$2,'compatible','Core read authority profile disposable compatibility')
    on conflict(module_definition_id,operating_model_id) do nothing`,
  [moduleDefinition.id, taxonomy.operating_model_id]);
  await client.query(`insert into platform.workspace_modules(
    tenant_id,customer_workspace_id,module_definition_id,module_code,status,valid_from,
    activated_at,activated_by,reason
  ) values($1,$2,$3,'experience_guides','active',statement_timestamp()-interval '1 second',
    statement_timestamp(),$4,'Core read authority profile disposable activation')`,
  [ids.tenant, ids.workspace, moduleDefinition.id, ids.readActor]);
  await client.query(`insert into platform.workspace_entitlements(
    customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from
  ) values($1,'module.experience_guides','boolean',true,statement_timestamp()-interval '1 second')`,
  [ids.workspace]);

  await client.query(`insert into identity.permissions(code,resource,action,description)
    values('experience.guide.manage','experience.guide','manage','Disposable manage-only contrast')
    on conflict(code) do nothing`);
  const managePermission = (await client.query(`select id from identity.permissions
    where code='experience.guide.manage'`)).rows[0];
  await client.query(`insert into platform.module_permission_bindings(
    module_definition_id,permission_id,binding_version,permission_mode,
    is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status
  ) values($1,$2,1,'manage',true,false,true,'active') on conflict do nothing`,
  [moduleDefinition.id, managePermission.id]);

  await client.query(`insert into identity.memberships(
    id,tenant_id,user_id,role_id,status,starts_at
  ) values
    ($1,$3,$4,$6,'active',statement_timestamp()-interval '1 second'),
    ($2,$3,$5,$6,'active',statement_timestamp()-interval '1 second')`, [
    ids.readMembership, ids.manageMembership, ids.tenant,
    ids.readActor, ids.manageActor, baseRole.id,
  ]);
  await client.query(`insert into identity.context_grants(
    id,membership_id,tenant_id,scope_type,starts_at
  ) values
    ($1,$3,$5,'tenant',statement_timestamp()-interval '1 second'),
    ($2,$4,$5,'tenant',statement_timestamp()-interval '1 second')`, [
    ids.readContext, ids.manageContext, ids.readMembership, ids.manageMembership, ids.tenant,
  ]);
  await client.query(`insert into platform.workspace_roles(
    id,tenant_id,customer_workspace_id,code,name,base_role_id,scope_ceiling,
    lifecycle_status,created_by,valid_from
  ) values
    ($1,$3,$4,'core_read_only','Core read-only fixture',$5,'workspace','draft',$6,
      statement_timestamp()-interval '1 second'),
    ($2,$3,$4,'core_manage_only','Core manage-only fixture',$5,'workspace','draft',$7,
      statement_timestamp()-interval '1 second')`, [
    ids.readRole, ids.manageRole, ids.tenant, ids.workspace, baseRole.id,
    ids.readActor, ids.manageActor,
  ]);
  await client.query(`insert into platform.workspace_role_modules(
    tenant_id,workspace_role_id,module_definition_id
  ) values($1,$2,$4),($1,$3,$4)`,
  [ids.tenant, ids.readRole, ids.manageRole, moduleDefinition.id]);
  await client.query(`insert into platform.workspace_role_permissions(
    tenant_id,workspace_role_id,permission_id,effect
  ) values($1,$2,$4,'allow'),($1,$3,$5,'allow')`, [
    ids.tenant, ids.readRole, ids.manageRole, readPermission.id, managePermission.id,
  ]);
  await client.query(`update platform.workspace_roles
    set lifecycle_status='published',lock_version=lock_version+1
    where id in($1,$2)`, [ids.readRole, ids.manageRole]);
  await client.query(`insert into platform.workspace_member_roles(
    id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
    assigned_by_user_id,assigned_by_membership_id,reason,valid_from
  ) values
    ($1,$3,$4,$5,$7,'workspace',$8,$5,'Core read-only disposable assignment',
      statement_timestamp()-interval '1 second'),
    ($2,$3,$4,$6,$9,'workspace',$10,$6,'Core manage-only disposable assignment',
      statement_timestamp()-interval '1 second')`, [
    ids.readAssignment, ids.manageAssignment, ids.tenant, ids.workspace,
    ids.readMembership, ids.manageMembership, ids.readRole, ids.readActor,
    ids.manageRole, ids.manageActor,
  ]);

  await check('read-only and manage-only actors remain independent', async () => {
    const before = await durableDigest();
    await setActor(ids.readActor);
    assert.equal(await allowed(ids.readContext, ids.workspace, 'experience.guide.read'), true);
    assert.equal(await allowed(ids.readContext, ids.workspace, 'experience.guide.manage'), false);
    await setActor(ids.manageActor);
    assert.equal(await allowed(ids.manageContext, ids.workspace, 'experience.guide.manage'), true);
    assert.equal(await allowed(ids.manageContext, ids.workspace, 'experience.guide.read'), false);
    assert.equal(await durableDigest(), before);
  });

  await check('missing entitlement denies with zero shared or domain writes', async () => {
    await setActor(ids.readActor);
    await client.query(`delete from platform.workspace_entitlements
      where customer_workspace_id=$1 and entitlement_key='module.experience_guides'`,
    [ids.workspace]);
    const before = await durableDigest();
    assert.equal(await allowed(ids.readContext, ids.workspace, 'experience.guide.read'), false);
    assert.equal(await durableDigest(), before);
    await client.query(`insert into platform.workspace_entitlements(
      customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from
    ) values($1,'module.experience_guides','boolean',true,statement_timestamp()-interval '1 second')`,
    [ids.workspace]);
  });

  await check('expired entitlement and stale revision fail closed', async () => {
    await setActor(ids.readActor);
    const oldRevision = await revision();
    await client.query(`update platform.workspace_entitlements
      set valid_until=statement_timestamp(),updated_at=statement_timestamp()
      where customer_workspace_id=$1 and entitlement_key='module.experience_guides'`,
    [ids.workspace]);
    const currentRevision = await revision();
    assert.ok(currentRevision > oldRevision);
    const before = await durableDigest();
    assert.equal(await allowed(ids.readContext, ids.workspace, 'experience.guide.read'), false);
    assert.equal(await durableDigest(), before);
    await client.query(`update platform.workspace_entitlements
      set valid_until=null,updated_at=statement_timestamp()
      where customer_workspace_id=$1 and entitlement_key='module.experience_guides'`,
    [ids.workspace]);
  });

  await check('revoked entitlement and revoked actor deny with zero writes', async () => {
    await setActor(ids.readActor);
    await client.query(`update platform.workspace_entitlements
      set boolean_value=false,updated_at=statement_timestamp()
      where customer_workspace_id=$1 and entitlement_key='module.experience_guides'`,
    [ids.workspace]);
    let before = await durableDigest();
    assert.equal(await allowed(ids.readContext, ids.workspace, 'experience.guide.read'), false);
    assert.equal(await durableDigest(), before);
    await client.query(`update platform.workspace_entitlements
      set boolean_value=true,updated_at=statement_timestamp()
      where customer_workspace_id=$1 and entitlement_key='module.experience_guides'`,
    [ids.workspace]);
    await client.query(`update identity.memberships
      set status='revoked',ends_at=statement_timestamp(),updated_at=statement_timestamp()
      where id=$1`, [ids.readMembership]);
    before = await durableDigest();
    assert.equal(await allowed(ids.readContext, ids.workspace, 'experience.guide.read'), false);
    assert.equal(await durableDigest(), before);
  });

  await check('wrong Workspace and arbitrary registry tuple deny', async () => {
    await setActor(ids.manageActor);
    const before = await durableDigest();
    assert.equal(await allowed(ids.manageContext, ids.otherWorkspace, 'experience.guide.manage'), false);
    assert.equal(await allowed(ids.manageContext, ids.workspace, 'experience.guide.read'), false);
    assert.equal(await allowed(ids.manageContext, ids.workspace, 'experience.guide.manage', 'documents'), false);
    assert.equal(await durableDigest(), before);
  });

  await client.query('rollback');
  await check('disposable fixture leaves zero residue', async () => {
    const residue = await client.query(`select
      exists(select 1 from platform.tenants where id=$1) as tenant,
      exists(select 1 from auth.users where id in($2,$3)) as actors,
      exists(select 1 from identity.memberships where id in($4,$5)) as memberships,
      exists(select 1 from platform.workspace_roles where id in($6,$7)) as roles`, [
      ids.tenant, ids.readActor, ids.manageActor, ids.readMembership, ids.manageMembership,
      ids.readRole, ids.manageRole,
    ]);
    assert.deepEqual(residue.rows[0], {
      tenant: false, actors: false, memberships: false, roles: false,
    });
  });

  console.log(JSON.stringify({
    contract: 'core-read-authority-profile-postgres.v1',
    checks,
    result: 'PASS',
    residue: 0,
  }));
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
