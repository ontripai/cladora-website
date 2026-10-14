import { randomUUID } from 'node:crypto';
import type { CoreTransactionProviderEvidenceV1 } from '../core/transaction-provider-evidence-v1';
import type { CoreTransactionProvidersV2 } from '../core/postgres-transaction-host-v1';

export const documentsReferenceAuthorityProviderCodeV1 = 'documents-reference-authority.v1';

type ValidateDocumentsReferenceAuthorityV1 = CoreTransactionProvidersV2['validateProviders'];
type ValidateParameters = Parameters<ValidateDocumentsReferenceAuthorityV1>;
type Scope = ValidateParameters[0];
type Command = ValidateParameters[1];
type Authority = ValidateParameters[2];
type DenialReason = Extract<CoreTransactionProviderEvidenceV1,
  { decision: 'denied' }>['denial_reason'];

export type DocumentsReferenceCurrentStateBindingV1 = Readonly<{
  context_id: string;
  workspace_id: string;
  actor_id: string;
  authority_version: number;
  document_id: string;
  document_version_id: string;
  document_version: number;
  authority_evaluated_at: string;
}>;

export type DocumentsReferenceCurrentStateV1 = Readonly<{
  decision: 'accepted' | 'denied';
  denial_reason: 'STALE_REFERENCE' | 'REFERENCE_DENIED' | null;
  evaluated_at: string;
}>;

const expectedSubject = Object.freeze({
  kind: 'documents.document_version',
  relation: 'read',
  request_version: 1,
});

function evidenceBinding(scope: Scope, command: Command, authority: Authority, evaluatedAt: string) {
  return {
    contract_version: 'core-transaction-provider-evidence.v1' as const,
    evidence_id: randomUUID(),
    provider_code: documentsReferenceAuthorityProviderCodeV1,
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

function deny(scope: Scope, command: Command, authority: Authority,
  denialReason: DenialReason, evaluatedAt = authority.evaluated_at,
): CoreTransactionProviderEvidenceV1 {
  return {
    ...evidenceBinding(scope, command, authority, evaluatedAt),
    decision: 'denied',
    denial_reason: denialReason,
  };
}

function authorityMatchesCommand(scope: Scope, command: Command, authority: Authority): boolean {
  return authority.decision === 'allowed'
    && authority.workspace_id === command.workspace_id
    && authority.actor_id === command.actor_id
    && authority.context_id === command.context_id
    && authority.authority_version === command.authority_version
    && authority.permission_code === 'documents.vault.read'
    && authority.module_code === 'documents'
    && authority.evaluation_purpose === 'documents.reference.read'
    && authority.transaction_context.transaction_id === scope.transaction_id
    && authority.transaction_context.command_id === command.command_id
    && authority.transaction_context.attempt === scope.attempt
    && authority.transaction_context.isolation_level === 'serializable'
    && authority.transaction_context.lock.workspace_id === command.workspace_id
    && authority.transaction_context.lock.aggregate_type === command.aggregate_type
    && authority.transaction_context.lock.aggregate_id === command.aggregate_id;
}

/** Documents-owned row visibility matching the checked Vault download rules.
 * Core owns module/permission/Workspace authority. This pure query adds canonical
 * document classification, Context scope and explicit view access without
 * invoking download authorization, which writes an access event.
 */
const readVisibilitySql = `select (
  (documents.customer_document_scope_matches(g.scope_type::text,g.property_id,
    g.building_id,g.unit_id,d.property_id)
   and case lower(r.code)
     when 'association_admin' then true
     when 'property_manager' then d.classification<>'restricted'
     when 'president' then d.classification<>'restricted' and
       (d.document_type ilike 'governance%' or exists(select 1 from documents.document_links l
         where l.document_id=d.id and l.tenant_id=d.tenant_id
           and l.entity_type in ('governance.meeting','governance.resolution')))
     when 'censor' then d.classification<>'restricted' and
       (d.document_type ilike any(array['audit%','financial%','governance%'])
        or exists(select 1 from documents.document_links l where l.document_id=d.id
          and l.tenant_id=d.tenant_id and l.entity_type in
            ('finance.journal','billing.invoice','governance.meeting','governance.resolution'))
        or exists(select 1 from documents.document_audit_links l
          where l.document_id=d.id and l.tenant_id=d.tenant_id))
     when 'owner' then d.classification<>'restricted' and
       exists(select 1 from documents.document_links l where l.document_id=d.id
         and l.tenant_id=d.tenant_id and l.entity_type='portfolio.unit' and l.entity_id=g.unit_id)
       and communications.member_covers_unit(m.id,m.tenant_id,g.unit_id)
     when 'tenant_resident' then d.classification='public'
       and communications.member_covers_unit(m.id,m.tenant_id,g.unit_id)
     else false end)
  or exists(select 1 from documents.document_permissions perm
    join portfolio.buildings b on b.property_id=d.property_id and b.tenant_id=d.tenant_id
    join portfolio.units u on u.building_id=b.id and u.tenant_id=d.tenant_id and u.status='active'
    where perm.document_id=d.id and perm.tenant_id=d.tenant_id
      and perm.permission='view' and perm.membership_id=m.id
      and perm.valid_from<=statement_timestamp()
      and (perm.valid_until is null or perm.valid_until>statement_timestamp())
      and communications.member_covers_unit(m.id,m.tenant_id,u.id)
      and communications.context_covers_unit(g.id,u.id))
) as allowed
from documents.documents d
join identity.context_grants g on g.id=$1 and g.tenant_id=d.tenant_id
join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
join identity.roles r on r.id=m.role_id and (r.tenant_id is null or r.tenant_id=m.tenant_id)
where d.id=$2 and d.workspace_id=$3 and d.tenant_id=$4
  and m.user_id=auth.uid() and m.status='active'
  and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
  and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())`;

/** Canonical Documents row selector shared by the existing provider and other
 * transaction-scoped consumers. It assumes Core authority was accepted in the
 * same scope and returns no document payload or storage metadata.
 */
export async function selectDocumentsReferenceCurrentStateV1(
  scope: Scope,
  binding: DocumentsReferenceCurrentStateBindingV1,
): Promise<DocumentsReferenceCurrentStateV1> {
  const execution = await scope.query<{
    transaction_id: string; isolation: string; actor_bound: boolean; aal2: boolean;
  }>(`select txid_current()::text as transaction_id,
    current_setting('transaction_isolation') as isolation,
    auth.uid()=$1::uuid as actor_bound,auth.jwt()->>'aal'='aal2' as aal2`, [binding.actor_id]);
  const session = execution.rows[0];
  const evaluatedAt = binding.authority_evaluated_at;
  if (execution.rowCount !== 1 || session.transaction_id !== scope.database_transaction_id
    || session.isolation !== 'serializable' || session.actor_bound !== true || session.aal2 !== true
    || scope.workspace_id !== binding.workspace_id || scope.actor_id !== binding.actor_id) {
    return { decision: 'denied', denial_reason: 'REFERENCE_DENIED', evaluated_at: evaluatedAt };
  }

  // Real shared locks cover lifecycle and scanner writers outside Core's
  // advisory-lock convention. Exact predicates make historical NULL bindings,
  // cross-Workspace identities and missing mappings indistinguishable denials.
  const documents = await scope.query<{ current_version: number; active: boolean }>(
    `select d.current_version,(d.status='active' and d.deleted_at is null
      and d.archived_at is null and d.disposition_status in ('retained','review_due','legal_hold')) as active
     from documents.documents d where d.id=$1 and d.workspace_id=$2 and d.tenant_id=$3 for share`,
    [binding.document_id, binding.workspace_id, scope.tenant_id],
  );
  if (documents.rowCount !== 1) {
    return { decision: 'denied', denial_reason: 'REFERENCE_DENIED', evaluated_at: evaluatedAt };
  }
  const versions = await scope.query<{
    version: number; scanning_status: string; checksum_status: string;
  }>(`select v.version,v.scanning_status,v.checksum_status from documents.document_versions v
     where v.id=$1 and v.document_id=$2 and v.tenant_id=$3 for share`,
  [binding.document_version_id, binding.document_id, scope.tenant_id]);
  await scope.query(`select p.id from documents.document_permissions p
    where p.document_id=$1 and p.tenant_id=$2 order by p.id for share`,
  [binding.document_id, scope.tenant_id]);

  const visibility = await scope.query<{ allowed: boolean }>(readVisibilitySql,
    [binding.context_id, binding.document_id, binding.workspace_id, scope.tenant_id]);
  if (visibility.rowCount !== 1 || visibility.rows[0].allowed !== true) {
    return { decision: 'denied', denial_reason: 'REFERENCE_DENIED', evaluated_at: evaluatedAt };
  }
  if (versions.rowCount !== 1 || versions.rows[0].version !== binding.document_version
    || documents.rows[0].current_version !== binding.document_version) {
    return { decision: 'denied', denial_reason: 'STALE_REFERENCE', evaluated_at: evaluatedAt };
  }
  if (!documents.rows[0].active) {
    return { decision: 'denied', denial_reason: 'REFERENCE_DENIED', evaluated_at: evaluatedAt };
  }
  const version = versions.rows[0];
  if (version.scanning_status !== 'clean' || version.checksum_status !== 'verified') {
    return { decision: 'denied', denial_reason: 'REFERENCE_DENIED', evaluated_at: evaluatedAt };
  }
  const scan = await scope.query<{ clean: boolean }>(`select exists (
    select 1 from documents.document_scan_attestations a
    join documents.document_versions v on v.id=a.version_id and v.tenant_id=a.tenant_id
    where a.version_id=$1 and a.tenant_id=$2 and a.provider='clamav'
      and a.verdict='clean' and a.content_sha256=v.sha256
      and a.scanned_at<=statement_timestamp() and a.recorded_at<=statement_timestamp()
  ) as clean`, [binding.document_version_id, scope.tenant_id]);
  if (scan.rows[0]?.clean !== true) {
    return { decision: 'denied', denial_reason: 'REFERENCE_DENIED', evaluated_at: evaluatedAt };
  }

  const currentVisibility = await scope.query<{ allowed: boolean }>(readVisibilitySql,
    [binding.context_id, binding.document_id, binding.workspace_id, scope.tenant_id]);
  if (currentVisibility.rowCount !== 1 || currentVisibility.rows[0].allowed !== true) {
    return { decision: 'denied', denial_reason: 'REFERENCE_DENIED', evaluated_at: evaluatedAt };
  }
  const instant = await scope.query<{ now: string }>('select clock_timestamp()::text as now');
  return { decision: 'accepted', denial_reason: null,
    evaluated_at: new Date(instant.rows[0].now).toISOString() };
}

/** Inactive Core v2 provider validation. Uses only the host's live serializable
 * scope and post-lock canonical authority receipt. It never opens or commits a
 * transaction, writes, grants, fetches bytes or creates a parallel authority.
 */
export const validateDocumentsReferenceAuthorityV1: ValidateDocumentsReferenceAuthorityV1 = async (
  scope, command, authority,
) => {
  if (scope.workspace_id !== command.workspace_id || scope.actor_id !== command.actor_id
    || command.aggregate_type !== 'documents.document'
    || command.permission_code !== 'documents.vault.read'
    || command.module_code !== 'documents'
    || command.evaluation_purpose !== 'documents.reference.read'
    || command.subject_reference.kind !== expectedSubject.kind
    || command.subject_reference.relation !== expectedSubject.relation
    || command.subject_reference.request_version !== expectedSubject.request_version
    || command.aggregate_version !== command.subject_reference.version
    || !command.provider_source_ids.includes(command.aggregate_id)
    || !command.provider_source_ids.includes(command.subject_reference.id)) {
    return deny(scope, command, authority, 'RELATION_MISMATCH');
  }
  if (!authorityMatchesCommand(scope, command, authority)) {
    return deny(scope, command, authority, 'SUBJECT_DENIED');
  }

  try {
    const state = await selectDocumentsReferenceCurrentStateV1(scope, {
      context_id: command.context_id,
      workspace_id: command.workspace_id,
      actor_id: command.actor_id,
      authority_version: authority.authority_version,
      document_id: command.aggregate_id,
      document_version_id: command.subject_reference.id,
      document_version: command.subject_reference.version,
      authority_evaluated_at: authority.evaluated_at,
    });
    if (state.decision !== 'accepted') {
      return deny(scope, command, authority,
        state.denial_reason === 'STALE_REFERENCE' ? 'STALE_SUBJECT' : 'SUBJECT_DENIED',
        state.evaluated_at);
    }
    return {
      ...evidenceBinding(scope, command, authority, state.evaluated_at),
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
