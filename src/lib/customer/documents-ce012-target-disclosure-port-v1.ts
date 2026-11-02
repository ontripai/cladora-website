/** Inactive trusted-server candidate port. No route, pool or disclosure permit. */
import { createHash, randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type { CoreTransactionScopeV1 } from '../core/postgres-transaction-host-v1';
import {
  createCoreCe012TerminalAuthorityPortV1,
  type CoreCe012TerminalBindingV1,
  type CoreCe012TerminalObservationV1,
} from '../core/ce012-terminal-authority-port-v1';
import { coreCe012StoredRelationRequestV1Schema } from '../core/ce012-stored-relation-v1';
import { resolveAuthority } from '../core/current-authority-postgres-provider-v1';
import {
  bindCanonicalCurrentAuthorityObservationV1,
  currentAuthorityTransactionRequestV1Schema,
} from '../core/current-authority-transaction-port-v1';
import { createDocumentsCe012ReferenceProviderV1 } from './documents-ce012-reference-provider-v1';
import type { DocsCe012ReferenceRequestV1 } from './documents-ce012-reference-contract';

export const DOCUMENTS_CE012_TARGET_DISCLOSURE_PORT_V1 = 'documents-ce012-target-disclosure-port.v1' as const;
export const DOCUMENTS_CE012_TARGET_DISCLOSURE_RUNTIME_BINDING = null;
export const DOCUMENTS_CE012_TARGET_DISCLOSURE_CORE_SOURCE = '534be1a3d69a3b36d0f04edc555bf01c3d666842';
export type DocumentsCe012TargetObservationV1 = Readonly<{ contract: 'documents-ce012-target-observation.v1' }>;
type PrivateProjection = Readonly<{
  target: Readonly<DocsCe012ReferenceRequestV1['target']>;
  safe_label: 'Document reference';
  reusable_as_command_authority: false;
}>;
type State = 'observed' | 'denied' | 'stale' | 'unavailable' | 'mismatch';
const result = (documents_status: State, observation: DocumentsCe012TargetObservationV1 | null = null) => Object.freeze({
  contract: DOCUMENTS_CE012_TARGET_DISCLOSURE_PORT_V1, status: 'not_ready' as const,
  documents_status, observation, projection: null,
  host_binding: 'UNBOUND' as const, action_authorization: 'not_evaluated' as const,
});
class ScopeFailure extends Error { constructor() { super('Documents target scope unavailable'); } }
const errorCode = (e: unknown) => typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * Construct inside the existing trusted Core read phase only. The real Core10
 * factory is imported directly: no caller-supplied port, verifier or allow bit.
 * Stored relation validation (not an input replay flag) selects historical mode.
 * Core11 host/lifetime/settlement adoption is deliberately UNBOUND.
 */
export function createDocumentsCe012TargetDisclosurePortV1(scope: CoreTransactionScopeV1, value: unknown) {
  const parsed = coreCe012StoredRelationRequestV1Schema.safeParse(value);
  const input = parsed.success ? structuredClone(parsed.data) : null;
  const core = createCoreCe012TerminalAuthorityPortV1(scope, input);
  const bound = { transaction_id: scope.transaction_id, database_transaction_id: scope.database_transaction_id,
    tenant_id: scope.tenant_id, workspace_id: scope.workspace_id, actor_id: scope.actor_id, attempt: scope.attempt };
  const originalQuery = scope.query;
  const unchanged = () => scope.query === originalQuery
    && Object.entries(bound).every(([key, v]) => scope[key as keyof typeof bound] === v);
  let generation = 0, busy = false, pending = 0, closed = false, failed = false, first: unknown;
  const observations = new WeakMap<DocumentsCe012TargetObservationV1, {
    generation: number; core: CoreCe012TerminalObservationV1;
    binding: CoreCe012TerminalBindingV1; projection: PrivateProjection;
  }>();
  const invalidate = () => { generation++; };
  const fail = (e: unknown) => { if (!failed) { failed = true; first = e; } invalidate(); };
  const ensure = () => { if (failed) throw first; if (closed || !unchanged()) throw new ScopeFailure(); };
  const readScope: CoreTransactionScopeV1 = Object.freeze({ ...bound,
    async query<Row extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
      ensure();
      try { const answer = await core.scope.query<Row>(text, values); ensure(); return answer; }
      catch (e) { fail(e); throw e; }
    },
  });
  // A trusted-provider facade, NOT permission for arbitrary SQL or a new host.
  // The same Core read-phase scope still controls which operations are possible.
  const trackedScope: CoreTransactionScopeV1 = Object.freeze({ ...bound,
    async query<Row extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
      invalidate(); ensure();
      if (busy) { const e = new ScopeFailure(); fail(e); throw e; }
      pending++;
      try { return await readScope.query<Row>(text, values); } finally { pending--; }
    },
  });
  function bindingMatches(b: CoreCe012TerminalBindingV1) {
    if (!input || !unchanged()) return false;
    const c = input.command, g = input.guide_command, t = g.payload.document_target;
    return t !== null && Object.entries(bound).every(([key, v]) => b[key as keyof typeof bound] === v)
      && b.context_id === c.context_id && b.command_id === c.command_id
      && b.authority_revision === c.authority_version && b.command_hash === digest(c)
      && b.canonical_key === `core-tx.v1:${c.workspace_id}:${c.idempotency_key}`
      && b.core_receipt_id === input.expected.core_receipt_id
      && b.core_receipt_hash === input.expected.core_receipt_hash
      && b.ce_receipt_id === input.expected.ce_save_receipt_id
      && b.target.document_id === t.document_id && b.target.document_version_id === t.document_version_id
      && b.target.document_version === t.document_version;
  }
  async function observe(...extras: unknown[]) {
    invalidate();
    if (busy || pending) return result('unavailable');
    busy = true;
    try {
      ensure();
      if (extras.length || !input) return result('mismatch');
      const initial = await core.checkpoint(); ensure();
      if (initial.core_status !== 'observed' || !initial.observation) return result(
        initial.core_status === 'denied' ? 'denied' : initial.core_status === 'mismatch' ? 'mismatch' : 'unavailable');
      const before = core.inspect(initial.observation);
      if (before.status !== 'core_observed_not_ready' || !bindingMatches(before.binding)) return result('mismatch');
      const c = input.command, g = input.guide_command, target = g.payload.document_target;
      if (target === null) return result('mismatch');
      // Existing authority primitive/binder; do not manufacture an allowed receipt.
      const request = currentAuthorityTransactionRequestV1Schema.parse({
        contract_version: 'core-current-authority-transaction-port-request.v1', decision_id: randomUUID(),
        context_id: c.context_id, workspace_id: c.workspace_id, actor_id: c.actor_id,
        authority_version: c.authority_version, permission_code: c.permission_code,
        module_code: c.module_code, evaluation_purpose: c.evaluation_purpose,
        transaction_context: { transaction_id: c.transaction_id, command_id: c.command_id,
          attempt: bound.attempt, isolation_level: 'serializable', lock: { kind: 'command_aggregate',
            workspace_id: c.workspace_id, aggregate_type: c.aggregate_type, aggregate_id: c.aggregate_id,
            acquired_at: before.evaluated_at } },
      });
      const authority = bindCanonicalCurrentAuthorityObservationV1(request, await resolveAuthority(readScope, request));
      ensure();
      if (authority.decision !== 'allowed') return result('denied');
      const provider = createDocumentsCe012ReferenceProviderV1(readScope, c, authority, g, 'replay');
      const selected = await provider.select({ contract: 'docs-ce012-reference-request.v1', version: 1,
        context_id: c.context_id, workspace_id: c.workspace_id, guide_id: g.guide_id,
        target: { document_id: target.document_id, document_version_id: target.document_version_id,
          document_version: target.document_version }, evaluation_mode: 'replay' });
      ensure();
      if (selected.decision !== 'historical_authorized') return result(
        selected.decision === 'stale' ? 'stale' : selected.decision === 'not_ready' ? 'unavailable' : 'denied');
      if (selected.safe_label !== 'Document reference' || selected.redaction !== 'safe_label_only') return result('unavailable');
      // Recheck Core after all selector waits. This does NOT renew the target's
      // expiry frontier or establish a joint checkpoint/settlement. Candidate only.
      const final = await core.checkpoint(); ensure();
      if (final.core_status !== 'observed' || !final.observation) return result(
        final.core_status === 'denied' ? 'denied' : final.core_status === 'mismatch' ? 'mismatch' : 'unavailable');
      const after = core.inspect(final.observation);
      if (after.status !== 'core_observed_not_ready' || !bindingMatches(after.binding)
        || after.binding.backend_pid !== before.binding.backend_pid
        || after.binding.membership_id !== before.binding.membership_id
        || after.binding.mutation_id !== before.binding.mutation_id) return result('mismatch');
      const projection: PrivateProjection = Object.freeze({ target: Object.freeze({
        document_id: target.document_id, document_version_id: target.document_version_id,
        document_version: target.document_version }), safe_label: 'Document reference', reusable_as_command_authority: false });
      const observation = Object.freeze({ contract: 'documents-ce012-target-observation.v1' as const });
      observations.set(observation, { generation, core: final.observation, binding: after.binding, projection });
      return result('observed', observation);
    } catch (caught) {
      const e = failed ? first : caught;
      if (e instanceof ScopeFailure) return result('mismatch');
      if (errorCode(e) === '42501') { fail(e); return result('denied'); }
      fail(e); throw e; // Preserve the ORIGINAL 40001/cancellation/unknown failure.
    } finally { busy = false; }
  }
  return Object.freeze({ contract: DOCUMENTS_CE012_TARGET_DISCLOSURE_PORT_V1, scope: trackedScope, observe,
    /** Private server-only inspection, NEVER a release/response API. Even valid
     * candidates are NOT_READY/UNBOUND/non-authorizing, including retained copies.
     */
    inspectPrivate(observation: DocumentsCe012TargetObservationV1) {
      const item = observations.get(observation);
      if (!item || busy || pending || closed || failed || !unchanged() || item.generation !== generation) {
        return Object.freeze({ status: 'invalidated' as const, projection: null });
      }
      const inspected = core.inspect(item.core);
      if (inspected.status !== 'core_observed_not_ready' || inspected.binding !== item.binding || !bindingMatches(item.binding)) {
        return Object.freeze({ status: 'invalidated' as const, projection: null });
      }
      return Object.freeze({ status: 'private_candidate_not_ready' as const, private_projection: item.projection,
        projection: null, host_binding: 'UNBOUND' as const, action_authorization: 'not_evaluated' as const,
        terminal_wait_coverage: 'not_ready' as const, settlement: 'not_observed' as const });
    },
    close() { closed = true; invalidate(); core.close(); },
  });
}
