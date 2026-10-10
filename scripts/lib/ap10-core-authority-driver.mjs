import { randomUUID } from 'node:crypto';

const FIXTURE_REASON = 'AP10 synthetic fixture authority';
const CLEANUP_REASON = 'AP10 synthetic fixture cleanup';

function fixtureIds() {
  return {
    tenantId: randomUUID(),
    membershipId: randomUUID(),
    contextId: randomUUID(),
    workspaceIds: [randomUUID(), randomUUID()],
    propertyIds: [randomUUID(), randomUUID()],
    buildingIds: [randomUUID(), randomUUID()],
    unitIds: [randomUUID(), randomUUID(), randomUUID()],
    workspaceRoleIds: [randomUUID(), randomUUID()],
    assignmentIds: [randomUUID(), randomUUID()],
    propertyAuthorityIds: [randomUUID(), randomUUID()],
  };
}

async function exactlyOne(client, sql, values, code) {
  const result = await client.query(sql, values);
  if (result.rowCount !== 1) throw new Error(code);
  return result.rows[0];
}

export function createAp10CoreAuthorityDriver(pool) {
  if (!pool?.connect) throw new Error('postgres_pool_required');

  return {
    async setup({ userId, runId, target }) {
      const client = await pool.connect();
      const ids = fixtureIds();
      const fixtureCode = runId.toLowerCase().replaceAll(/[^a-z0-9]/g, '').slice(0, 18);
      if (fixtureCode.length < 3) throw new Error('fixture_run_id_invalid');
      try {
        await client.query('begin');
        const systemRole = await exactlyOne(client, `
          select id from identity.roles
          where tenant_id is null and is_system and code='airprop_portfolio_director'
        `, [], 'airprop_system_role_missing');
        const moduleDefinition = await exactlyOne(client, `
          select id,code,entitlement_key from platform.module_definitions
          where code='airprop_commercial' and is_active
            and valid_from<=statement_timestamp()
            and (valid_to is null or valid_to>statement_timestamp())
        `, [], 'airprop_module_definition_missing_or_ambiguous');
        const taxonomy = await exactlyOne(client, `
          select p.id as property_profile_id,o.id as operating_model_id
          from platform.property_profiles p
          cross join platform.operating_models o
          where p.code='residential_condominium' and p.version=1
            and o.code='association_managed' and o.version=1
        `, [], 'canonical_taxonomy_missing_or_ambiguous');
        const permissions = await client.query(`
          select id,code from identity.permissions
          where code in ('airprop.asset.read','airprop.asset.manage')
          order by code
        `);
        if (permissions.rowCount !== 2) throw new Error('airprop_fixture_permissions_missing');

        await client.query(`
          insert into platform.tenants(id,legal_name,registration_number,status)
          values($1,$2,$3,'active')
        `, [ids.tenantId, `AP10 Synthetic ${fixtureCode}`, `AP10-${fixtureCode}-${target}`]);
        for (let index = 0; index < 2; index += 1) {
          await client.query(`
            insert into platform.customer_workspaces(
              id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status,activated_at
            ) values($1,$2,'OWNER_PORTFOLIO',$3,'PILOT','ACTIVE',statement_timestamp())
          `, [ids.workspaceIds[index], ids.tenantId, `AP10 synthetic workspace ${index + 1}`]);
          await client.query(`
            insert into portfolio.properties(id,tenant_id,type,name,status)
            values($1,$2,'condominium',$3,'active')
          `, [ids.propertyIds[index], ids.tenantId, `AP10 synthetic property ${index + 1}`]);
          await client.query(`
            insert into portfolio.buildings(id,tenant_id,property_id,code,name,status)
            values($1,$2,$3,$4,$5,'active')
          `, [
            ids.buildingIds[index],
            ids.tenantId,
            ids.propertyIds[index],
            `AP10-B${index + 1}`,
            `AP10 synthetic building ${index + 1}`,
          ]);
          await client.query(`
            insert into platform.workspace_property_bindings(
              tenant_id,customer_workspace_id,property_id,status,binding_source,created_by
            ) values($1,$2,$3,'active','platform_assignment',$4)
          `, [ids.tenantId, ids.workspaceIds[index], ids.propertyIds[index], userId]);
          await client.query(`
            insert into platform.workspace_taxonomy_assignments(
              tenant_id,customer_workspace_id,property_profile_id,operating_model_id,
              status,valid_from,notes,created_by
            ) values($1,$2,$3,$4,'active',statement_timestamp()-interval '1 second',$5,$6)
          `, [
            ids.tenantId,
            ids.workspaceIds[index],
            taxonomy.property_profile_id,
            taxonomy.operating_model_id,
            FIXTURE_REASON,
            userId,
          ]);
          await client.query(`
            insert into platform.workspace_modules(
              tenant_id,customer_workspace_id,module_definition_id,module_code,status,
              valid_from,activated_at,activated_by,reason
            ) values($1,$2,$3,$4,'active',statement_timestamp()-interval '1 second',
              statement_timestamp(),$5,$6)
          `, [
            ids.tenantId,
            ids.workspaceIds[index],
            moduleDefinition.id,
            moduleDefinition.code,
            userId,
            FIXTURE_REASON,
          ]);
          await client.query(`
            insert into platform.workspace_entitlements(
              customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from
            ) values($1,$2,'boolean',true,statement_timestamp()-interval '1 second')
          `, [ids.workspaceIds[index], moduleDefinition.entitlement_key]);
          await client.query(`
            insert into platform.workspace_roles(
              id,tenant_id,customer_workspace_id,code,name,base_role_id,scope_ceiling,
              lifecycle_status,created_by,valid_from
            ) values($1,$2,$3,$4,$5,$6,'workspace','draft',$7,
              statement_timestamp()-interval '1 second')
          `, [
            ids.workspaceRoleIds[index],
            ids.tenantId,
            ids.workspaceIds[index],
            `ap10_${fixtureCode}_${index + 1}`.slice(0, 50),
            `AP10 synthetic role ${index + 1}`,
            systemRole.id,
            userId,
          ]);
          await client.query(`
            insert into platform.workspace_role_modules(
              tenant_id,workspace_role_id,module_definition_id
            ) values($1,$2,$3)
          `, [ids.tenantId, ids.workspaceRoleIds[index], moduleDefinition.id]);
          for (const permission of permissions.rows) {
            await client.query(`
              insert into platform.workspace_role_permissions(
                tenant_id,workspace_role_id,permission_id,effect
              ) values($1,$2,$3,'allow')
            `, [ids.tenantId, ids.workspaceRoleIds[index], permission.id]);
          }
          await client.query(`
            update platform.workspace_roles
            set lifecycle_status='published',lock_version=lock_version+1
            where id=$1 and lifecycle_status='draft'
          `, [ids.workspaceRoleIds[index]]);
        }

        await client.query(`
          insert into portfolio.units(id,tenant_id,building_id,code,status) values
            ($1,$4,$5,'AP10-U1','active'),
            ($2,$4,$5,'AP10-U2','active'),
            ($3,$4,$6,'AP10-U3','active')
        `, [
          ids.unitIds[0],
          ids.unitIds[1],
          ids.unitIds[2],
          ids.tenantId,
          ids.buildingIds[0],
          ids.buildingIds[1],
        ]);
        await client.query(`
          insert into identity.memberships(
            id,tenant_id,user_id,role_id,status,starts_at
          ) values($1,$2,$3,$4,'active',statement_timestamp()-interval '1 second')
        `, [ids.membershipId, ids.tenantId, userId, systemRole.id]);
        await client.query(`
          insert into identity.context_grants(
            id,membership_id,tenant_id,scope_type,starts_at
          ) values($1,$2,$3,'tenant',statement_timestamp()-interval '1 second')
        `, [ids.contextId, ids.membershipId, ids.tenantId]);

        for (let index = 0; index < 2; index += 1) {
          await client.query(`
            insert into platform.workspace_member_roles(
              id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,
              scope_type,assigned_by_user_id,assigned_by_membership_id,reason,valid_from
            ) values($1,$2,$3,$4,$5,'workspace',$6,$4,$7,
              statement_timestamp()-interval '1 second')
          `, [
            ids.assignmentIds[index],
            ids.tenantId,
            ids.workspaceIds[index],
            ids.membershipId,
            ids.workspaceRoleIds[index],
            userId,
            FIXTURE_REASON,
          ]);
          await client.query(`
            insert into platform.workspace_property_authorities(
              id,tenant_id,property_id,customer_workspace_id,purpose,
              authority_source,evidence_reference,valid_from
            ) values($1,$2,$3,$4,'property_operations','synthetic_ap10_fixture',$5,
              statement_timestamp()-interval '1 second')
          `, [
            ids.propertyAuthorityIds[index],
            ids.tenantId,
            ids.propertyIds[index],
            ids.workspaceIds[index],
            `test://ap10/${runId}/authority/${index + 1}`,
          ]);
        }
        await client.query('commit');
        return Object.freeze(ids);
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },

    async assertAllowed({ authority, userId }) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({
          sub: userId,
          role: 'authenticated',
          aal: 'aal2',
        })]);
        const allowed = await client.query(`
          select w.workspace_id,
            app_private.check_workspace_native_permission_v2(
              $1,w.workspace_id,'airprop.asset.read','airprop_commercial'
            ) as can_read,
            app_private.check_workspace_native_permission_v2(
              $1,w.workspace_id,'airprop.asset.manage','airprop_commercial'
            ) as can_manage
          from unnest($2::uuid[]) as w(workspace_id)
        `, [authority.contextId, authority.workspaceIds]);
        if (allowed.rowCount !== authority.workspaceIds.length
          || allowed.rows.some((row) => row.can_read !== true || row.can_manage !== true)) return false;

        await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({
          sub: userId,
          role: 'authenticated',
          aal: 'aal1',
        })]);
        const denied = await client.query(`
          select bool_and(not app_private.check_workspace_native_permission_v2(
            $1,w.workspace_id,'airprop.asset.read','airprop_commercial'
          )) as denied
          from unnest($2::uuid[]) as w(workspace_id)
        `, [authority.contextId, authority.workspaceIds]);
        return denied.rows[0]?.denied === true;
      } finally {
        await client.query('rollback');
        client.release();
      }
    },

    async revoke({ authority }) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(`
          update platform.workspace_member_roles
          set valid_to=statement_timestamp(),reason=$2,lock_version=lock_version+1
          where id=any($1::uuid[]) and valid_to is null
        `, [authority.assignmentIds, CLEANUP_REASON]);
        await client.query(`
          update platform.workspace_property_authorities
          set status='revoked',revoked_at=statement_timestamp(),valid_to=statement_timestamp(),
              revocation_reason=$2
          where id=any($1::uuid[]) and status='active'
        `, [authority.propertyAuthorityIds, CLEANUP_REASON]);
        await client.query(`
          update identity.context_grants set ends_at=statement_timestamp()
          where id=$1 and ends_at is null
        `, [authority.contextId]);
        await client.query(`
          update identity.memberships
          set status='revoked',ends_at=statement_timestamp()
          where id=$1 and status='active'
        `, [authority.membershipId]);
        await client.query(`
          update platform.workspace_roles
          set lifecycle_status='archived',valid_to=statement_timestamp(),lock_version=lock_version+1
          where id=any($1::uuid[]) and lifecycle_status='published'
        `, [authority.workspaceRoleIds]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },

    async verifyRevoked({ authority }) {
      const result = await pool.query(`
        select
          not exists(select 1 from identity.memberships
            where id=$1 and status='active'
              and starts_at<=statement_timestamp()
              and (ends_at is null or ends_at>statement_timestamp()))
          and not exists(select 1 from identity.context_grants
            where id=$2 and starts_at<=statement_timestamp()
              and (ends_at is null or ends_at>statement_timestamp()))
          and not exists(select 1 from platform.workspace_member_roles
            where id=any($3::uuid[]) and valid_from<=statement_timestamp()
              and (valid_to is null or valid_to>statement_timestamp()))
          and not exists(select 1 from platform.workspace_property_authorities
            where id=any($4::uuid[]) and status='active'
              and valid_from<=statement_timestamp()
              and (valid_to is null or valid_to>statement_timestamp()))
          as revoked
      `, [
        authority.membershipId,
        authority.contextId,
        authority.assignmentIds,
        authority.propertyAuthorityIds,
      ]);
      return result.rows[0]?.revoked === true;
    },
  };
}
