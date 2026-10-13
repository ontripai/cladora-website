import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { CoreTransactionScopeV1 } from '../core/postgres-transaction-host-v1';
import { resolveAuthority } from '../core/current-authority-postgres-provider-v1';
import {
  bindCanonicalCurrentAuthorityObservationV1,
  currentAuthorityTransactionRequestV1Schema,
} from '../core/current-authority-transaction-port-v1';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const version = z.number().int().positive().safe();
export const documentsReferenceAuthorityRequestV1Schema = z.strictObject({
  contract_version: z.literal('documents-reference-authority.v1'),
  context_id: uuid,
  workspace_id: uuid,
  command_id: uuid,
  authority_version: version,
  document_id: uuid,
  document_version_id: uuid,
  document_version: version,
  evaluation_mode: z.enum(['new_command', 'replay']),
});
export type DocumentsReferenceAuthorityRequestV1 = z.infer<typeof documentsReferenceAuthorityRequestV1Schema>;
const evidenceSchema = z.strictObject({
  context_id: uuid, workspace_id: uuid, document_id: uuid,
  document_version_id: uuid, document_version: version,
  transaction_id: uuid, command_id: uuid, attempt: version,
  authority_version: version,
  evaluated_at: z.string().datetime({ offset: true }),
  scan_state: z.literal('clean'), lifecycle_state: z.literal('active'),
  safe_label: z.literal('Document reference'),
  transaction_bound: z.literal(true), reusable_as_authority: z.literal(false),
});
export const documentsReferenceAuthorityResultV1Schema = z.discriminatedUnion('decision', [
  z.strictObject({ contract_version: z.literal('documents-reference-authority.v1'),
    decision: z.literal('allowed'), evidence: evidenceSchema }),
  z.strictObject({ contract_version: z.literal('documents-reference-authority.v1'),
    decision: z.literal('denied'), evidence: z.null(),
    code: z.enum(['INVALID_REQUEST', 'AUTHORITY_DENIED', 'STALE_VERSION',
      'UNSAFE_SCAN_STATE', 'INACTIVE_DOCUMENT', 'PROVIDER_UNAVAILABLE']) }),
]);
export type DocumentsReferenceAuthorityResultV1 = z.infer<typeof documentsReferenceAuthorityResultV1Schema>;
type DenialCode = Extract<DocumentsReferenceAuthorityResultV1, { decision: 'denied' }>['code'];
const deny = (code: DenialCode): DocumentsReferenceAuthorityResultV1 => ({
  contract_version: 'documents-reference-authority.v1', decision: 'denied', code, evidence: null,
});

/** Documents-owned row visibility, matching the checked Vault download rules.
 * Core alone supplies module/permission/Workspace authority; this query supplies
 * canonical document classification, Context scope and explicit view access.
 * No call to download authorization (which writes access events).
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

/** Inactive trusted server provider. Uses only the caller's live serializable
 * Core scope. Never opens/commits a transaction, writes, grants or fetches bytes.
 * Call before protected mutation on every command, retry and replay.
 * A 40001 must escape to the existing host for a fresh transaction retry.
 */
export async function resolveDocumentsReferenceAuthorityV1(
  scope: CoreTransactionScopeV1, requestValue: unknown,
): Promise<DocumentsReferenceAuthorityResultV1> {
  const parsed = documentsReferenceAuthorityRequestV1Schema.safeParse(requestValue);
  if (!parsed.success) return deny('INVALID_REQUEST');
  const request = parsed.data;
  if (request.workspace_id !== scope.workspace_id) return deny('AUTHORITY_DENIED');
  try {
    const execution = await scope.query<{ transaction_id: string; isolation: string; actor_bound: boolean; aal2: boolean }>(
      `select txid_current()::text as transaction_id,
        current_setting('transaction_isolation') as isolation,
        auth.uid()=$1::uuid as actor_bound, auth.jwt()->>'aal'='aal2' as aal2`, [scope.actor_id]);
    const session = execution.rows[0];
    if (execution.rowCount !== 1 || session.transaction_id !== scope.database_transaction_id
      || session.isolation !== 'serializable' || session.actor_bound !== true || session.aal2 !== true) {
      return deny('AUTHORITY_DENIED');
    }
    // Real row locks cover legacy lifecycle/scanner writers, which do not use
    // Core advisory locks. All domain locks precede Core's revision barrier.
    const documents = await scope.query<{ current_version: number; active: boolean }>(
      `select d.current_version, (d.status='active' and d.deleted_at is null
        and d.archived_at is null and d.disposition_status in ('retained','review_due','legal_hold')) as active
       from documents.documents d where d.id=$1 and d.workspace_id=$2 and d.tenant_id=$3 for share`,
      [request.document_id, request.workspace_id, scope.tenant_id]);
    if (documents.rowCount !== 1) return deny('AUTHORITY_DENIED');
    const versions = await scope.query<{ version: number; scanning_status: string; checksum_status: string }>(
      `select v.version,v.scanning_status,v.checksum_status from documents.document_versions v
       where v.id=$1 and v.document_id=$2 and v.tenant_id=$3 for share`,
      [request.document_version_id, request.document_id, scope.tenant_id]);
    // Serialize explicit view revocation before taking the Core barrier. No
    // copied permission data leaves the query capability.
    await scope.query(`select p.id from documents.document_permissions p
      where p.document_id=$1 and p.tenant_id=$2 order by p.id for share`,
    [request.document_id, scope.tenant_id]);
    const instant = await scope.query<{ now: string }>('select clock_timestamp()::text as now');
    const authorityRequest = currentAuthorityTransactionRequestV1Schema.parse({
      contract_version: 'core-current-authority-transaction-port-request.v1', decision_id: randomUUID(),
      context_id: request.context_id, workspace_id: request.workspace_id, actor_id: scope.actor_id,
      authority_version: request.authority_version, permission_code: 'documents.vault.read',
      module_code: 'documents', evaluation_purpose: 'documents.reference.read',
      transaction_context: { transaction_id: scope.transaction_id, command_id: request.command_id,
        attempt: scope.attempt, isolation_level: 'serializable', lock: {
          kind: 'command_aggregate', workspace_id: request.workspace_id,
          aggregate_type: 'documents.document', aggregate_id: request.document_id,
          acquired_at: new Date(instant.rows[0].now).toISOString(),
        } },
    });
    const observation = await resolveAuthority(scope, authorityRequest);
    const authority = bindCanonicalCurrentAuthorityObservationV1(authorityRequest, observation);
    if (authority.decision !== 'allowed') return deny('AUTHORITY_DENIED');
    const visibility = await scope.query<{ allowed: boolean }>(readVisibilitySql,
      [request.context_id, request.document_id, request.workspace_id, scope.tenant_id]);
    if (visibility.rowCount !== 1 || visibility.rows[0].allowed !== true) return deny('AUTHORITY_DENIED');
    // Reveal readiness/version status only after current read authority passes.
    if (versions.rowCount !== 1 || versions.rows[0].version !== request.document_version
      || documents.rows[0].current_version !== request.document_version) return deny('STALE_VERSION');
    if (!documents.rows[0].active) return deny('INACTIVE_DOCUMENT');
    const documentVersion = versions.rows[0];
    if (documentVersion.scanning_status !== 'clean' || documentVersion.checksum_status !== 'verified') {
      return deny('UNSAFE_SCAN_STATE');
    }
    const scan = await scope.query<{ clean: boolean }>(`select exists (
      select 1 from documents.document_scan_attestations a
      join documents.document_versions v on v.id=a.version_id and v.tenant_id=a.tenant_id
      where a.version_id=$1 and a.tenant_id=$2 and a.provider='clamav'
        and a.verdict='clean' and a.content_sha256=v.sha256
        and a.scanned_at<=statement_timestamp() and a.recorded_at<=statement_timestamp()
    ) as clean`, [request.document_version_id, scope.tenant_id]);
    if (scan.rows[0]?.clean !== true) return deny('UNSAFE_SCAN_STATE');
    // Recheck after all document predicates: time expiry cannot reuse the first
    // observation. No further source locks are acquired after the Core barrier.
    const finalRequest = { ...authorityRequest, decision_id: randomUUID() };
    const final = bindCanonicalCurrentAuthorityObservationV1(finalRequest, await resolveAuthority(scope, finalRequest));
    if (final.decision !== 'allowed') return deny('AUTHORITY_DENIED');
    const currentVisibility = await scope.query<{ allowed: boolean }>(readVisibilitySql,
      [request.context_id, request.document_id, request.workspace_id, scope.tenant_id]);
    if (currentVisibility.rows[0]?.allowed !== true) return deny('AUTHORITY_DENIED');
    return documentsReferenceAuthorityResultV1Schema.parse({
      contract_version: 'documents-reference-authority.v1', decision: 'allowed', evidence: {
        context_id: request.context_id, workspace_id: request.workspace_id,
        document_id: request.document_id, document_version_id: request.document_version_id,
        document_version: request.document_version, transaction_id: scope.transaction_id,
        command_id: request.command_id, attempt: scope.attempt, authority_version: request.authority_version,
        evaluated_at: final.evaluated_at, scan_state: 'clean', lifecycle_state: 'active',
        safe_label: 'Document reference', transaction_bound: true, reusable_as_authority: false,
      },
    });
  } catch (error) {
    if ((error as { code?: string })?.code === '40001') throw error;
    return deny('PROVIDER_UNAVAILABLE');
  }
}
