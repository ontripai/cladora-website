import {
  currentAuthorityTransactionRequestV1Schema,
  type CurrentAuthorityTransactionRequestV1,
  type CanonicalCurrentAuthorityObservationV1,
} from './current-authority-transaction-port-v1';
import type { CoreTransactionScopeV1 } from './postgres-transaction-host-v1';

export type CoreAuthorityProviderBlockerV1 =
  | 'INVALID_TRANSACTION_BINDING' | 'CROSS_WORKSPACE' | 'ACTOR_BINDING_MISMATCH'
  | 'AUTHORITY_NOT_FOUND' | 'ACTOR_REVOKED' | 'AUTHORITY_DENIED'
  | 'AUTHORITY_UNKNOWN' | 'AUTHORITY_VERSION_UNAVAILABLE' | 'AUTHORITY_SCHEMA_UNAVAILABLE' | 'AUTHORITY_GRANT_UNAVAILABLE';

/** Bounded failure only; never includes source rows, credentials or SQL errors. */
export class CoreAuthorityProviderUnavailableV1 extends Error {
  constructor(readonly code: CoreAuthorityProviderBlockerV1) {
    super(code);
    this.name = 'CoreAuthorityProviderUnavailableV1';
  }
}

/**
 * Canonical DB-backed authority, using the commit-coupled Core revision barrier.
 * Draft migration dependency: no runtime consumer activation or grants.
 * A global epoch intentionally invalidates unrelated Workspaces conservatively.
 */
export async function resolveAuthority(
  scope: CoreTransactionScopeV1,
  requestValue: CurrentAuthorityTransactionRequestV1,
): Promise<CanonicalCurrentAuthorityObservationV1> {
  const parsed = currentAuthorityTransactionRequestV1Schema.safeParse(requestValue);
  if (!parsed.success) throw new CoreAuthorityProviderUnavailableV1('INVALID_TRANSACTION_BINDING');
  const request = parsed.data;
  if (request.workspace_id !== scope.workspace_id
    || request.transaction_context.lock.workspace_id !== scope.workspace_id) {
    throw new CoreAuthorityProviderUnavailableV1('CROSS_WORKSPACE');
  }
  if (request.actor_id !== scope.actor_id) {
    throw new CoreAuthorityProviderUnavailableV1('ACTOR_BINDING_MISMATCH');
  }
  if (request.transaction_context.transaction_id !== scope.transaction_id
    || request.transaction_context.attempt !== scope.attempt
    || request.transaction_context.isolation_level !== 'serializable') {
    throw new CoreAuthorityProviderUnavailableV1('INVALID_TRANSACTION_BINDING');
  }
  try {
    const execution = await scope.query<{ transaction_id: string; actor_id: string | null;
      isolation: string; evaluated_at: string }>(`select txid_current()::text as transaction_id,
        auth.uid()::text as actor_id, current_setting('transaction_isolation') as isolation,
        clock_timestamp()::text as evaluated_at`);
    const executionRow = execution.rows[0];
    if (execution.rowCount !== 1 || executionRow.transaction_id !== scope.database_transaction_id
      || executionRow.isolation !== 'serializable'
      || Date.parse(executionRow.evaluated_at) < Date.parse(request.transaction_context.lock.acquired_at)) {
      throw new CoreAuthorityProviderUnavailableV1('INVALID_TRANSACTION_BINDING');
    }
    if (executionRow.actor_id !== request.actor_id) {
      throw new CoreAuthorityProviderUnavailableV1('ACTOR_BINDING_MISMATCH');
    }
    // Acquire after all host locks; hold until the host commits or rolls back.
    // Never initialize or bump the revision on a read/denial path.
    const revision = await scope.query<{ revision: string }>(`select revision::text
      from app_private.canonical_authority_revision_v1 where singleton for share`);
    const authorityVersion = Number(revision.rows[0]?.revision);
    if (revision.rowCount !== 1 || !Number.isSafeInteger(authorityVersion) || authorityVersion < 1) {
      throw new CoreAuthorityProviderUnavailableV1('AUTHORITY_VERSION_UNAVAILABLE');
    }
    const context = await scope.query<{ tenant_id: string; actor_id: string;
      status: string; current: boolean }>(`select m.tenant_id::text, m.user_id::text as actor_id,
        m.status::text, (m.starts_at<=clock_timestamp()
          and (m.ends_at is null or m.ends_at>clock_timestamp())
          and g.starts_at<=clock_timestamp()
          and (g.ends_at is null or g.ends_at>clock_timestamp())) as current
      from identity.context_grants g join identity.memberships m
        on m.id=g.membership_id and m.tenant_id=g.tenant_id
      where g.id=$1`, [request.context_id]);
    if (context.rowCount !== 1) throw new CoreAuthorityProviderUnavailableV1('AUTHORITY_NOT_FOUND');
    if (context.rows[0].actor_id !== request.actor_id) {
      throw new CoreAuthorityProviderUnavailableV1('ACTOR_BINDING_MISMATCH');
    }
    if (context.rows[0].tenant_id !== scope.tenant_id) {
      throw new CoreAuthorityProviderUnavailableV1('CROSS_WORKSPACE');
    }
    if (context.rows[0].status !== 'active' || context.rows[0].current !== true) {
      throw new CoreAuthorityProviderUnavailableV1('ACTOR_REVOKED');
    }
    const workspace = await scope.query<{ tenant_id: string }>(`select tenant_id::text
      from platform.customer_workspaces where id=$1 and archived_at is null
        and lifecycle_status='ACTIVE'`, [request.workspace_id]);
    if (workspace.rowCount !== 1) throw new CoreAuthorityProviderUnavailableV1('AUTHORITY_NOT_FOUND');
    if (workspace.rows[0].tenant_id !== scope.tenant_id) {
      throw new CoreAuthorityProviderUnavailableV1('CROSS_WORKSPACE');
    }
    // Both the entitlement binding and boolean truth are read under the same
    // revision barrier and serializable snapshot. The evaluator owns all gates.
    const evaluated = await scope.query<{ allowed: boolean; evaluated_at: string;
      module_definition_id: string; entitlement_key: string | null }>(`select
      app_private.check_workspace_native_permission_v2($1,$2,$3,$4) as allowed,
      statement_timestamp()::text as evaluated_at, d.id::text as module_definition_id,
      d.entitlement_key from platform.module_definitions d
      where d.code=$4 and d.is_active and d.lifecycle_status in ('active','published')
        and d.valid_from<=statement_timestamp()
        and (d.valid_to is null or d.valid_to>statement_timestamp())`,
    [request.context_id, request.workspace_id, request.permission_code, request.module_code]);
    if (evaluated.rowCount !== 1) throw new CoreAuthorityProviderUnavailableV1('AUTHORITY_UNKNOWN');
    const row = evaluated.rows[0];
    return {
      contract_version: 'core-current-authority-observation.v1',
      source_contract: 'workspace-native-effective-authority.v2',
      decision_id: request.decision_id, context_id: request.context_id,
      workspace_id: request.workspace_id, actor_id: request.actor_id,
      authority_version: authorityVersion, permission_code: request.permission_code,
      module_code: request.module_code, transaction_context: request.transaction_context,
      evaluator: 'app_private.check_workspace_native_permission_v2',
      source_disclosure: 'status_only', source_reference: null, actor_status: 'current',
      decision: row.allowed === true && authorityVersion === request.authority_version ? 'allowed' : 'denied',
      evaluated_at: new Date(row.evaluated_at).toISOString(),
      entitlement: {
        contract_version: 'core-authority-entitlement-binding.v1',
        workspace_id: request.workspace_id, module_definition_id: row.module_definition_id,
        module_code: request.module_code, entitlement_key: row.entitlement_key,
        authority_revision: authorityVersion,
      },
    };
  } catch (error) {
    if (error instanceof CoreAuthorityProviderUnavailableV1) throw error;
    const code = (error as { code?: string })?.code;
    if (code === '40001') throw error; // Preserve TX-HOST-01's bounded fresh-transaction retry.
    if (code === '42501') throw new CoreAuthorityProviderUnavailableV1('AUTHORITY_GRANT_UNAVAILABLE');
    if (code === '42P01' || code === '42883') {
      throw new CoreAuthorityProviderUnavailableV1('AUTHORITY_SCHEMA_UNAVAILABLE');
    }
    throw new CoreAuthorityProviderUnavailableV1('AUTHORITY_UNKNOWN');
  }
}
