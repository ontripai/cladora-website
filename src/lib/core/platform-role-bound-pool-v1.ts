import 'server-only';

import type { Pool, PoolClient } from 'pg';

export const corePlatformRoleBoundPoolContractV1 =
  'core-platform-role-bound-pool.v1' as const;
export const corePlatformCeGuideRuntimeRoleV1 = 'cladora_ce_guide_runtime' as const;
export const corePlatformCeGuideExecutorRoleV1 = 'cladora_ce_guide_executor' as const;

export type CorePlatformRoleBoundConnectionModelV1 = 'direct' | 'session_pooler';

export interface CorePlatformRoleBoundPoolV1 extends Pick<Pool, 'connect'> {
  readonly contract_version: typeof corePlatformRoleBoundPoolContractV1;
  readonly connection_model: CorePlatformRoleBoundConnectionModelV1;
}

export type CorePlatformRoleBoundPoolOptionsV1 = Readonly<{
  /**
   * The supplied pool must authenticate every physical connection as the
   * fixed runtime role. Credential provisioning remains outside this package.
   */
  runtime_pool: Pick<Pool, 'connect'>;
  connection_model: CorePlatformRoleBoundConnectionModelV1;
}>;

const identitySql = 'select current_user::text as current_user,session_user::text as session_user';
const checkoutSafetySql = 'select app_private.assert_ce_guide_role_safety_v1() as safe';
const transactionSafetySql = 'select app_private.acquire_ce_guide_role_safety_lease_v1() as safe';
const clearIdentitySql = `select
  set_config('request.jwt.claims','',false),
  set_config('request.jwt.claim.sub','',false),
  set_config('request.jwt.claim.aal','',false),
  set_config('request.jwt.claim.role','',false),
  set_config('request.cladora.context_id','',false),
  set_config('request.cladora.workspace_id','',false)`;

async function assertRuntimeIdentity(client: PoolClient) {
  const identity = await client.query<{ current_user: string; session_user: string }>(identitySql);
  if (identity.rowCount !== 1
    || identity.rows[0]?.current_user !== corePlatformCeGuideRuntimeRoleV1
    || identity.rows[0]?.session_user !== corePlatformCeGuideRuntimeRoleV1) {
    throw new Error('core_platform_runtime_identity_invalid');
  }
}

async function assertExecutorIdentity(client: PoolClient) {
  const identity = await client.query<{ current_user: string; session_user: string }>(identitySql);
  if (identity.rowCount !== 1
    || identity.rows[0]?.current_user !== corePlatformCeGuideExecutorRoleV1
    || identity.rows[0]?.session_user !== corePlatformCeGuideRuntimeRoleV1) {
    throw new Error('core_platform_executor_identity_invalid');
  }
}

async function assertSafety(client: PoolClient, transaction: boolean) {
  const safety = await client.query<{ safe: boolean }>(
    transaction ? transactionSafetySql : checkoutSafetySql,
  );
  if (safety.rowCount !== 1 || safety.rows[0]?.safe !== true) {
    throw new Error('core_platform_role_safety_invalid');
  }
}

async function cleanForReuse(client: PoolClient) {
  await client.query(clearIdentitySql);
  await client.query('reset all');
  await client.query('reset role');
  await assertRuntimeIdentity(client);
}

/**
 * Inactive server-only binder for the canonical role-bound capability.
 *
 * The caller supplies an externally credentialed, fixed-runtime-role pool.
 * Transaction pooling is intentionally absent from the type and rejected at
 * runtime. No route imports or default instance are provided by this module.
 */
export function createCorePlatformRoleBoundPoolV1(
  options: CorePlatformRoleBoundPoolOptionsV1,
): CorePlatformRoleBoundPoolV1 {
  if (options.connection_model !== 'direct' && options.connection_model !== 'session_pooler') {
    throw new Error('core_platform_connection_model_unsupported');
  }
  if (!options.runtime_pool || typeof options.runtime_pool.connect !== 'function') {
    throw new Error('core_platform_runtime_pool_unavailable');
  }

  return {
    contract_version: corePlatformRoleBoundPoolContractV1,
    connection_model: options.connection_model,
    async connect() {
      const client = await options.runtime_pool.connect();
      let released = false;
      let transactionOpen = false;
      let commitAttempted = false;
      let poisoned = false;
      try {
        await cleanForReuse(client);
        await client.query(`set role ${corePlatformCeGuideExecutorRoleV1}`);
        await assertExecutorIdentity(client);
        await assertSafety(client, false);
      } catch (error) {
        client.release(true);
        throw error;
      }

      const wrapped = Object.create(client) as PoolClient;
      wrapped.query = (async (text: unknown, values?: unknown[]) => {
        if (typeof text !== 'string') {
          poisoned = true;
          throw new Error('core_platform_text_query_required');
        }
        const normalized = text.trim().toLowerCase();
        if (normalized.startsWith('begin')) {
          if (transactionOpen) {
            poisoned = true;
            throw new Error('core_platform_nested_transaction_denied');
          }
          const result = await client.query(text, values);
          transactionOpen = true;
          try {
            await assertExecutorIdentity(client);
            await assertSafety(client, true);
          } catch (error) {
            poisoned = true;
            throw error;
          }
          return result;
        }
        if (normalized === 'commit') {
          if (!transactionOpen) {
            poisoned = true;
            throw new Error('core_platform_commit_without_transaction');
          }
          await assertExecutorIdentity(client);
          await assertSafety(client, true);
          commitAttempted = true;
          try {
            const result = await client.query(text, values);
            transactionOpen = false;
            return result;
          } catch (error) {
            poisoned = true;
            throw error;
          }
        }
        if (normalized === 'rollback') {
          try {
            const result = await client.query(text, values);
            transactionOpen = false;
            return result;
          } catch (error) {
            poisoned = true;
            throw error;
          }
        }
        if (transactionOpen) {
          await assertExecutorIdentity(client);
          await assertSafety(client, true);
        } else {
          await assertExecutorIdentity(client);
          await assertSafety(client, false);
        }
        return client.query(text, values);
      }) as PoolClient['query'];

      wrapped.release = (error?: Error | boolean) => {
        if (released) return;
        released = true;
        if (error || transactionOpen || poisoned || commitAttempted) {
          client.release(true);
          return;
        }
        // Keep the physical client out of the pool until asynchronous cleanup
        // and runtime identity verification both finish.
        void cleanForReuse(client).then(
          () => client.release(),
          () => client.release(true),
        );
      };
      return wrapped;
    },
  };
}
