import { randomUUID } from 'node:crypto';
import type { CoreTransactionProviderEvidenceV1 } from '../core/transaction-provider-evidence-v1';
import type {
  CoreTransactionCommandV2,
  CoreTransactionProvidersV2,
} from '../core/postgres-transaction-host-v1';

export const experienceGuideLifecycleProviderCodeV1 = 'ce-guide-lifecycle-provider.v1';

type ValidateLifecycle = CoreTransactionProvidersV2['validateProviders'];
type LifecycleScope = Parameters<ValidateLifecycle>[0];
type LifecycleAuthority = Parameters<ValidateLifecycle>[2];
type DenialReason = Extract<CoreTransactionProviderEvidenceV1,
  { decision: 'denied' }>['denial_reason'];

type LifecycleAction = 'publish' | 'unpublish';

const actionFor = (command: CoreTransactionCommandV2): LifecycleAction | null => {
  if (command.evaluation_purpose === 'experience.guide.publish'
    && command.subject_reference.relation === 'publish') return 'publish';
  if (command.evaluation_purpose === 'experience.guide.unpublish'
    && command.subject_reference.relation === 'unpublish') return 'unpublish';
  return null;
};
const expectedVersionFor = (command: CoreTransactionCommandV2): number | null => {
  const value = command.aggregate_version - 1;
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

function binding(
  scope: LifecycleScope,
  command: CoreTransactionCommandV2,
  authority: LifecycleAuthority,
  evaluatedAt: string,
) {
  return {
    contract_version: 'core-transaction-provider-evidence.v1' as const,
    evidence_id: randomUUID(),
    provider_code: experienceGuideLifecycleProviderCodeV1,
    transaction_id: command.transaction_id,
    command_id: command.command_id,
    workspace_id: command.workspace_id,
    actor_id: command.actor_id,
    context_id: command.context_id,
    authority_decision_id: authority.decision_id,
    authority_version: authority.authority_version,
    attempt: scope.attempt,
    subject_reference: command.subject_reference,
    evaluated_at: evaluatedAt,
    source_disclosure: 'status_only' as const,
    source_reference: null,
  };
}

function deny(
  scope: LifecycleScope,
  command: CoreTransactionCommandV2,
  authority: LifecycleAuthority,
  reason: DenialReason,
  evaluatedAt = authority.evaluated_at,
): CoreTransactionProviderEvidenceV1 {
  return {
    ...binding(scope, command, authority, evaluatedAt),
    decision: 'denied',
    denial_reason: reason,
  };
}

function authorityMatches(
  scope: LifecycleScope,
  command: CoreTransactionCommandV2,
  authority: LifecycleAuthority,
): boolean {
  return authority.decision === 'allowed'
    && authority.workspace_id === command.workspace_id
    && authority.actor_id === command.actor_id
    && authority.context_id === command.context_id
    && authority.authority_version === command.authority_version
    && authority.permission_code === 'experience.guide.manage'
    && authority.module_code === 'experience_guides'
    && authority.evaluation_purpose === command.evaluation_purpose
    && authority.transaction_context.transaction_id === scope.transaction_id
    && authority.transaction_context.command_id === command.command_id
    && authority.transaction_context.attempt === scope.attempt
    && authority.transaction_context.isolation_level === 'serializable'
    && authority.transaction_context.lock.workspace_id === command.workspace_id
    && authority.transaction_context.lock.aggregate_type === command.aggregate_type
    && authority.transaction_context.lock.aggregate_id === command.aggregate_id;
}

function commandMatches(command: CoreTransactionCommandV2): boolean {
  const action = actionFor(command);
  const expectedVersion = expectedVersionFor(command);
  return action !== null
    && expectedVersion !== null
    && command.aggregate_type === 'experience_guide'
    && command.permission_code === 'experience.guide.manage'
    && command.module_code === 'experience_guides'
    && command.subject_reference.kind === 'experience.guide'
    && command.subject_reference.id === command.aggregate_id
    && command.subject_reference.version === expectedVersion
    && command.subject_reference.request_version === 1
    && command.provider_source_ids.includes(command.aggregate_id);
}

/**
 * CE-owned, read-only validation in the Core serializable scope. Guides with a
 * Documents reference fail closed until the Documents owner supplies the
 * approved transaction-scoped immutable selector. This provider does not create
 * a selector, authority source, receipt ledger or target-access projection.
 */
export const validateExperienceGuideLifecycleV1: ValidateLifecycle = async (
  scope,
  command,
  authority,
) => {
  if (scope.workspace_id !== command.workspace_id || scope.actor_id !== command.actor_id
    || !commandMatches(command)) {
    return deny(scope, command, authority, 'RELATION_MISMATCH');
  }
  if (!authorityMatches(scope, command, authority)) {
    return deny(scope, command, authority, 'SUBJECT_DENIED');
  }

  try {
    const transaction = await scope.query<{
      transaction_id: string;
      isolation: string;
      actor_bound: boolean;
      aal2: boolean;
    }>(`select txid_current()::text as transaction_id,
      current_setting('transaction_isolation') as isolation,
      auth.uid()=$1::uuid as actor_bound, auth.jwt()->>'aal'='aal2' as aal2`, [scope.actor_id]);
    const execution = transaction.rows[0];
    if (transaction.rowCount !== 1 || execution.transaction_id !== scope.database_transaction_id
      || execution.isolation !== 'serializable' || execution.actor_bound !== true
      || execution.aal2 !== true) {
      return deny(scope, command, authority, 'SUBJECT_DENIED');
    }

    const guide = await scope.query<{
      version: string;
      content_version: string;
      status: string;
      reference_count: string;
    }>(`select g.version::text,g.content_version::text,g.status,
        (select count(*)::text from experience.guide_references r
          where r.tenant_id=g.tenant_id and r.workspace_id=g.workspace_id
            and r.guide_id=g.id and r.guide_version=g.content_version) as reference_count
      from experience.guides g
      where g.id=$1 and g.workspace_id=$2 and g.tenant_id=$3
      for update`, [command.aggregate_id, command.workspace_id, scope.tenant_id]);
    if (guide.rowCount !== 1) return deny(scope, command, authority, 'SUBJECT_DENIED');

    const row = guide.rows[0];
    const expectedVersion = expectedVersionFor(command)!;
    if (Number(row.version) !== expectedVersion) {
      return deny(scope, command, authority, 'STALE_SUBJECT');
    }
    const action = actionFor(command)!;
    if ((action === 'publish' && row.status !== 'draft')
      || (action === 'unpublish' && row.status !== 'published')) {
      return deny(scope, command, authority, 'SUBJECT_DENIED');
    }
    if (!Number.isSafeInteger(Number(row.content_version)) || Number(row.content_version) < 1) {
      return deny(scope, command, authority, 'PROVIDER_UNAVAILABLE');
    }
    // No cached/fallback target authorization. The missing owner selector is a
    // bounded blocker for publication; unpublish remains safe and target-free.
    if (action === 'publish' && Number(row.reference_count) !== 0) {
      return deny(scope, command, authority, 'PROVIDER_UNAVAILABLE');
    }

    const instant = await scope.query<{ now: string }>('select clock_timestamp()::text as now');
    return {
      ...binding(scope, command, authority, new Date(instant.rows[0].now).toISOString()),
      decision: 'accepted',
      denial_reason: null,
      reference_state: 'available',
      current_actor_can_read: true,
    };
  } catch (error) {
    if ((error as { code?: string })?.code === '40001') throw error;
    return deny(scope, command, authority, 'PROVIDER_UNAVAILABLE');
  }
};

/** Exact conditional CE mutation; Core owns the surrounding transaction. */
export const mutateExperienceGuideLifecycleV1: CoreTransactionProvidersV2['mutate'] = async (
  scope,
  command,
) => {
  if (!commandMatches(command)) throw new Error('ce_guide_lifecycle_command_invalid');
  const action = actionFor(command)!;
  const expectedVersion = expectedVersionFor(command)!;
  const expectedState = action === 'publish' ? 'draft' : 'published';
  const resultingState = action === 'publish' ? 'published' : 'draft';
  const updated = await scope.query<{ id: string }>(`update experience.guides
    set status=$5,version=$4
    where id=$1 and workspace_id=$2 and tenant_id=$3
      and version=$4-1 and status=$6
    returning id::text`, [command.aggregate_id, command.workspace_id, scope.tenant_id,
    command.aggregate_version, resultingState, expectedState]);
  if (updated.rowCount !== 1 || expectedVersion !== command.aggregate_version - 1) {
    throw Object.assign(new Error('ce_guide_lifecycle_version_conflict'), { code: '40001' });
  }
  return { mutation_id: updated.rows[0].id };
};
