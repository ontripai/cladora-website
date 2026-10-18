import 'server-only';

import type { Pool, PoolClient } from 'pg';

export const corePlatformRoleBoundPoolContractV1 =
  'core-platform-role-bound-pool.v1' as const;
export const corePlatformCeGuideRuntimeRoleV1 = 'cladora_ce_guide_runtime' as const;
export const corePlatformCeGuideExecutorRoleV1 = 'cladora_ce_guide_executor' as const;
export const corePlatformServiceSubjectLinkRoleBoundPoolContractV1 =
  'core-platform-service-subject-link-role-bound-pool.v1' as const;
export const corePlatformServiceSubjectLinkRuntimeRoleV1 =
  'cladora_service_subject_link_runtime' as const;
export const corePlatformServiceSubjectLinkExecutorRoleV1 =
  'cladora_service_subject_link_executor' as const;

export type CorePlatformRoleBoundConnectionModelV1 = 'direct' | 'session_pooler';

export interface CorePlatformRoleBoundPoolV1 extends Pick<Pool, 'connect'> {
  readonly contract_version: typeof corePlatformRoleBoundPoolContractV1;
  readonly connection_model: CorePlatformRoleBoundConnectionModelV1;
}

export interface CorePlatformServiceSubjectLinkRoleBoundPoolV1 extends Pick<Pool, 'connect'> {
  readonly contract_version: typeof corePlatformServiceSubjectLinkRoleBoundPoolContractV1;
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
const serviceSubjectLinkCheckoutSafetySql =
  'select app_private.assert_service_subject_link_role_safety_v1() as safe';
const serviceSubjectLinkTransactionSafetySql =
  'select app_private.acquire_service_subject_link_role_safety_lease_v1() as safe';
const clearIdentitySql = `select
  set_config('request.jwt.claims','',false),
  set_config('request.jwt.claim.sub','',false),
  set_config('request.jwt.claim.aal','',false),
  set_config('request.jwt.claim.role','',false),
  set_config('request.cladora.context_id','',false),
  set_config('request.cladora.workspace_id','',false)`;

type FixedRoleBoundProfileV1<Contract extends string> = Readonly<{
  contract_version: Contract;
  runtime_role: string;
  executor_role: string;
  checkout_safety_sql: string;
  transaction_safety_sql: string;
}>;

async function assertRuntimeIdentity(
  client: PoolClient,
  profile: FixedRoleBoundProfileV1<string>,
) {
  const identity = await client.query<{ current_user: string; session_user: string }>(identitySql);
  if (identity.rowCount !== 1
    || identity.rows[0]?.current_user !== profile.runtime_role
    || identity.rows[0]?.session_user !== profile.runtime_role) {
    throw new Error('core_platform_runtime_identity_invalid');
  }
}

async function assertExecutorIdentity(
  client: PoolClient,
  profile: FixedRoleBoundProfileV1<string>,
) {
  const identity = await client.query<{ current_user: string; session_user: string }>(identitySql);
  if (identity.rowCount !== 1
    || identity.rows[0]?.current_user !== profile.executor_role
    || identity.rows[0]?.session_user !== profile.runtime_role) {
    throw new Error('core_platform_executor_identity_invalid');
  }
}

async function assertSafety(
  client: PoolClient,
  profile: FixedRoleBoundProfileV1<string>,
  transaction: boolean,
) {
  const safety = await client.query<{ safe: boolean }>(
    transaction ? profile.transaction_safety_sql : profile.checkout_safety_sql,
  );
  if (safety.rowCount !== 1 || safety.rows[0]?.safe !== true) {
    throw new Error('core_platform_role_safety_invalid');
  }
}

async function cleanForReuse(client: PoolClient, profile: FixedRoleBoundProfileV1<string>) {
  await client.query(clearIdentitySql);
  await client.query('reset all');
  await client.query('reset role');
  await assertRuntimeIdentity(client, profile);
}

const ceGuideProfileV1 = Object.freeze({
  contract_version: corePlatformRoleBoundPoolContractV1,
  runtime_role: corePlatformCeGuideRuntimeRoleV1,
  executor_role: corePlatformCeGuideExecutorRoleV1,
  checkout_safety_sql: checkoutSafetySql,
  transaction_safety_sql: transactionSafetySql,
});

const serviceSubjectLinkProfileV1 = Object.freeze({
  contract_version: corePlatformServiceSubjectLinkRoleBoundPoolContractV1,
  runtime_role: corePlatformServiceSubjectLinkRuntimeRoleV1,
  executor_role: corePlatformServiceSubjectLinkExecutorRoleV1,
  checkout_safety_sql: serviceSubjectLinkCheckoutSafetySql,
  transaction_safety_sql: serviceSubjectLinkTransactionSafetySql,
});

function createFixedRoleBoundPoolV1<Contract extends string>(
  options: CorePlatformRoleBoundPoolOptionsV1,
  profile: FixedRoleBoundProfileV1<Contract>,
): Pick<Pool, 'connect'> & Readonly<{
  contract_version: Contract;
  connection_model: CorePlatformRoleBoundConnectionModelV1;
}> {
  if (options.connection_model !== 'direct' && options.connection_model !== 'session_pooler') {
    throw new Error('core_platform_connection_model_unsupported');
  }
  if (!options.runtime_pool || typeof options.runtime_pool.connect !== 'function') {
    throw new Error('core_platform_runtime_pool_unavailable');
  }

  return {
    contract_version: profile.contract_version,
    connection_model: options.connection_model,
    async connect() {
      const client = await options.runtime_pool.connect();
      let released = false;
      let transactionOpen = false;
      let commitAttempted = false;
      let poisoned = false;
      try {
        await cleanForReuse(client, profile);
        await client.query(`set role ${profile.executor_role}`);
        await assertExecutorIdentity(client, profile);
        await assertSafety(client, profile, false);
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
        const isBegin = /^begin(?:\s+isolation\s+level\s+(?:serializable|repeatable\s+read|read\s+committed|read\s+uncommitted))?$/.test(normalized);
        if (normalized.startsWith('begin') && !isBegin) {
          poisoned = true;
          throw new Error('core_platform_transaction_control_denied');
        }
        if (isBegin) {
          if (transactionOpen) {
            poisoned = true;
            throw new Error('core_platform_nested_transaction_denied');
          }
          const result = await client.query(text, values);
          transactionOpen = true;
          try {
            await assertExecutorIdentity(client, profile);
            await assertSafety(client, profile, true);
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
          await assertExecutorIdentity(client, profile);
          await assertSafety(client, profile, true);
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
        if (/^(?:commit|rollback)\b/.test(normalized)) {
          poisoned = true;
          throw new Error('core_platform_transaction_control_denied');
        }
        if (transactionOpen) {
          await assertExecutorIdentity(client, profile);
          await assertSafety(client, profile, true);
        } else {
          await assertExecutorIdentity(client, profile);
          await assertSafety(client, profile, false);
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
        void cleanForReuse(client, profile).then(
          () => client.release(),
          () => client.release(true),
        );
      };
      return wrapped;
    },
  };
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
  return createFixedRoleBoundPoolV1(options, ceGuideProfileV1);
}

/** Fixed SERVICE subject-link capability; no SQL identifier is caller-controlled. */
export function createCorePlatformServiceSubjectLinkRoleBoundPoolV1(
  options: CorePlatformRoleBoundPoolOptionsV1,
): CorePlatformServiceSubjectLinkRoleBoundPoolV1 {
  return createFixedRoleBoundPoolV1(options, serviceSubjectLinkProfileV1);
}
