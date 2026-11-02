/** Inactive CE save writer. No route, pool, authority shortcut or autonomous retry. */
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  coreTransactionCommandV2Schema, coreTransactionReceiptV2Schema,
  type CoreTransactionCommandV2, type CoreTransactionProvidersV2, type CoreTransactionHostV1,
  type CoreTransactionReceiptV2, type CoreTransactionScopeV1,
} from '../core/postgres-transaction-host-v1';
import { resolveAuthority } from '../core/current-authority-postgres-provider-v1';
import {
  bindCanonicalCurrentAuthorityObservationV1,
  type CurrentAuthorityTransactionDecisionReceiptV1,
} from '../core/current-authority-transaction-port-v1';
import {
  coreTransactionReplayCommandHashV1, coreTransactionReplayReceiptHashV1,
} from '../core/transaction-replay-provider-hook-v1';
import { coreSubjectReferencesMatch } from '../core/transaction-provider-evidence-v1';
import { createCe012GuideProviderBridge } from './experience-guide-provider-bridge';
import { createCe012GuideCommandExecutor } from './experience-guide-editor-adapter';
import {
  ce012GuideSaveCommandV1Schema, ce012GuideCommandReceiptV1Schema,
  coreCe012MapDecisionV1Schema, fingerprintCe012GuideSavePayload,
  type Ce012GuideSaveCommandV1, type Ce012GuideMutationPlanV1, type Ce012GuideCommandEvaluationV1,
  type DocsCe012ReferenceRequestV1,
} from './experience-guide-command-contract';

export const CE012_SAVE_WRITER_RUNTIME_BINDING = null;
// Existing Documents connection provider identity/policy, not a new permission or provider registry.
export const CE012_SAVE_PROVIDER_CODE = 'documents-ce012-reference-provider.v1' as const;
export const CE012_SAVE_REPLAY_POLICY = 'provider_current_state_required' as const;

/** Trusted composition capability from the official Documents factory at c0caf3e.
 * Not a public callback/allow flag. Absent dependency is NOT_READY, never fallback.
 * Runtime composition/custody must be accepted separately; this module installs nothing.
 */
export interface Ce012SaveDocumentsModuleV1 {
  documentsCe012ReferenceProviderVersionV1: typeof CE012_SAVE_PROVIDER_CODE;
  createDocumentsCe012ReferenceProviderV1(
    scope: CoreTransactionScopeV1, command: CoreTransactionCommandV2,
    authority: CurrentAuthorityTransactionDecisionReceiptV1, guide: unknown,
    mode: 'new_command' | 'replay',
  ): { select(request: DocsCe012ReferenceRequestV1): Promise<unknown> };
}
export class Ce012SaveWriterNotReadyV1 extends Error {
  readonly code = 'CE012_SAVE_WRITER_NOT_READY';
  constructor() { super('CE012 save writer dependency or binding unavailable'); }
}
const must = (value: unknown): void => { if (!value) throw new Ce012SaveWriterNotReadyV1(); };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const keyFor = (c: CoreTransactionCommandV2) => `core-tx.v1:${c.workspace_id}:${c.idempotency_key}`;
const stable = (v: unknown): string => Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : v !== null && typeof v === 'object' ? `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(',')}}` : JSON.stringify(v);
const guideRow = z.strictObject({ version: z.coerce.number().int().positive().safe(),
  status: z.enum(['draft', 'published', 'cancelled']) });
export const CE012_SAVE_LEDGER_SQL = `select response_ref,request_hash,actor_id::text from platform.idempotency_keys
  where tenant_id=$1 and key=$2 for share`;
const storedRow = z.strictObject({ mutation_id: z.string().uuid(), command_hash: z.string(),
  command_json: z.unknown(), guide_command: z.unknown(), ce_receipt: z.unknown(),
  actor_id: z.string().uuid(), membership_id: z.string().uuid(),
  database_transaction_id: z.string(), canonical_key: z.string() });

export const CE012_SAVE_GUIDE_SQL = `select version,status::text from experience.guides
  where tenant_id=$1 and workspace_id=$2 and id=$3 for update`;
export const CE012_SAVE_MEMBERSHIP_SQL = `select m.id::text from identity.context_grants g
  join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  where g.id=$1 and m.user_id=$2 and m.tenant_id=$3 and m.status='active'
    and m.starts_at<=clock_timestamp() and (m.ends_at is null or m.ends_at>clock_timestamp())
    and g.starts_at<=clock_timestamp() and (g.ends_at is null or g.ends_at>clock_timestamp())`;
export const CE012_SAVE_STORED_SQL = `select mutation_id::text,command_hash,command_json,
  guide_command,ce_receipt,actor_id::text,membership_id::text,database_transaction_id,canonical_key
  from experience.guide_save_receipts_v1
  where tenant_id=$1 and workspace_id=$2 and canonical_key=$3 for share`;
export const CE012_SAVE_INSERT_SQL = `insert into experience.guide_save_receipts_v1
  (tenant_id,workspace_id,actor_id,membership_id,canonical_key,command_hash,
    command_json,guide_command,ce_receipt,mutation_id,database_transaction_id)
  values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11)
  returning ce_receipt`;

function commandMatches(c: CoreTransactionCommandV2, g: Ce012GuideSaveCommandV1) {
  const t = g.payload.document_target;
  return c.command_id === g.command_id && c.context_id === g.context_id
    && c.workspace_id === g.workspace_id && c.aggregate_id === g.guide_id
    && c.aggregate_type === 'experience_guide' && c.aggregate_version === g.expected_guide_version + 1
    && c.subject_reference.kind === 'experience.guide' && c.subject_reference.id === g.guide_id
    && c.subject_reference.version === g.expected_guide_version && c.subject_reference.relation === 'save_draft'
    && c.subject_reference.request_version === 1 && c.provider_source_ids.includes(g.guide_id)
    && (t === null || (c.provider_source_ids.includes(t.document_id) && c.provider_source_ids.includes(t.document_version_id)))
    && c.permission_code === 'experience.guide.manage' && c.module_code === 'experience_guides'
    && c.evaluation_purpose === 'experience.guide.command' && c.idempotency_key === g.idempotency_key
    && c.input_fingerprint === g.payload_fingerprint && fingerprintCe012GuideSavePayload(g) === g.payload_fingerprint;
}
function authorityMatches(s: CoreTransactionScopeV1, c: CoreTransactionCommandV2,
  a: CurrentAuthorityTransactionDecisionReceiptV1) {
  return s.transaction_id === c.transaction_id && s.workspace_id === c.workspace_id && s.actor_id === c.actor_id
    && a.decision === 'allowed' && a.rechecked_after_lock && a.transaction_bound
    && a.actor_id === c.actor_id && a.context_id === c.context_id && a.workspace_id === c.workspace_id
    && a.authority_version === c.authority_version && a.permission_code === c.permission_code
    && a.module_code === c.module_code && a.evaluation_purpose === c.evaluation_purpose
    && a.transaction_context.transaction_id === s.transaction_id && a.transaction_context.command_id === c.command_id
    && a.transaction_context.attempt === s.attempt && a.transaction_context.isolation_level === 'serializable'
    && a.transaction_context.lock.aggregate_id === c.aggregate_id
    && a.transaction_context.lock.aggregate_type === c.aggregate_type
    && a.entitlement?.workspace_id === c.workspace_id && a.entitlement.module_code === c.module_code
    && a.entitlement.entitlement_key === 'module.experience_guides'
    && a.entitlement.authority_revision === c.authority_version;
}
const scopeIdentity = (s: CoreTransactionScopeV1) => [s.transaction_id, s.database_transaction_id,
  s.tenant_id, s.workspace_id, s.actor_id, s.attempt].join(':');

/** New factory per retained command; inputs are private parsed copies. No transport dispatch. */
export function createCe012SaveWriterProviderV1(guideValue: unknown,
  documents: Ce012SaveDocumentsModuleV1 | null = null): CoreTransactionProvidersV2 & {
    localReceipt(): z.infer<typeof ce012GuideCommandReceiptV1Schema> | null;
  } {
  let completed: z.infer<typeof ce012GuideCommandReceiptV1Schema> | null = null;
  const guide = ce012GuideSaveCommandV1Schema.parse(guideValue);
  const plans = new WeakMap<CoreTransactionScopeV1, {
    command: string; scope: string; plan: Ce012GuideMutationPlanV1; membership: string;
  }>();
  async function evaluate(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV2,
    authority: CurrentAuthorityTransactionDecisionReceiptV1, replay: z.infer<typeof ce012GuideCommandReceiptV1Schema> | null) {
    must(documents?.documentsCe012ReferenceProviderVersionV1 === CE012_SAVE_PROVIDER_CODE);
    must(commandMatches(command, guide) && authorityMatches(scope, command, authority));
    const bound = scopeIdentity(scope);
    const member = await scope.query<{ id: string }>(CE012_SAVE_MEMBERSHIP_SQL,
      [command.context_id, scope.actor_id, scope.tenant_id]);
    must(member.rowCount === 1 && member.rows.length === 1 && z.string().uuid().safeParse(member.rows[0]?.id).success);
    const membership = member.rows[0].id;
    const rows = await scope.query(CE012_SAVE_GUIDE_SQL, [scope.tenant_id, scope.workspace_id, guide.guide_id]);
    must(rows.rowCount === 1 && rows.rows.length === 1);
    const row = guideRow.parse(rows.rows[0]);
    const bridge = createCe012GuideProviderBridge({
      coreCommandContext: { async evaluate() {
        return coreCe012MapDecisionV1Schema.parse({ contract: 'core-ce012-map-decision.v1', version: 1,
          decision_id: authority.decision_id, context_id: command.context_id, workspace_id: command.workspace_id,
          guide_id: guide.guide_id, actor_id: scope.actor_id, membership_id: membership,
          module_code: authority.module_code, permission_code: authority.permission_code,
          entitlement_key: authority.entitlement!.entitlement_key, authority: 'allowed', entitlement: 'active',
          evaluated_at: authority.evaluated_at });
      } },
      coreTransactionalAuthority: { async recheckAfterLock(request) {
        return bindCanonicalCurrentAuthorityObservationV1(request, await resolveAuthority(scope, request));
      } },
      documentsImmutableSelector: documents!.createDocumentsCe012ReferenceProviderV1(
        scope, command, authority, guide, replay === null ? 'new_command' : 'replay'),
    });
    const linked = await bridge.evaluate(guide, { decision_id: authority.decision_id,
      authority_version: authority.authority_version, transaction_context: authority.transaction_context },
    replay === null ? 'new_command' : 'replay');
    let plan: Ce012GuideMutationPlanV1 | null = null;
    // Reuse the existing executor, parser, evaluator/fingerprint and mutation plan.
    // Its commit port stages a private plan here; ONLY Core's later mutate phase writes.
    const executor = createCe012GuideCommandExecutor({
      core: { async evaluate() { return linked.core_decision; } },
      documents: { async evaluate() { return linked.document_decision; } },
      runtime: {
        async loadSnapshot() { return {
          guide: { guide_id: guide.guide_id, context_id: guide.context_id, workspace_id: guide.workspace_id,
            current_version: row.version, state: row.status },
          issuance: { receipt_id: randomUUID(), idempotency_binding_id: randomUUID(), evaluated_at: linked.binding.evaluated_at },
          replay: replay === null ? null : { idempotency_key: guide.idempotency_key,
            payload_fingerprint: guide.payload_fingerprint, receipt: replay },
        }; },
        async commit(value) { plan = value; return value.receipt; },
      },
    });
    const result = await executor.execute(guide);
    must(scopeIdentity(scope) === bound && result.result_code === 'OK' && result.receipt !== null);
    if (replay === null) must(plan !== null);
    return { result, plan, membership, bound, linked };
  }
  return {
    localReceipt() { return completed === null ? null : ce012GuideCommandReceiptV1Schema.parse(completed); },
    provider_code: CE012_SAVE_PROVIDER_CODE, replay_policy: CE012_SAVE_REPLAY_POLICY,
    resolveAuthority,
    async validateProviders(scope, command, authority) {
      completed = null; plans.delete(scope);
      const ev = await evaluate(scope, command, authority, null);
      plans.set(scope, { command: hash(command), scope: ev.bound, plan: ev.plan!, membership: ev.membership });
      return { contract_version: 'core-transaction-provider-evidence.v1', evidence_id: randomUUID(),
        provider_code: CE012_SAVE_PROVIDER_CODE, transaction_id: command.transaction_id,
        command_id: command.command_id, workspace_id: command.workspace_id, actor_id: command.actor_id,
        context_id: command.context_id, authority_decision_id: authority.decision_id,
        authority_version: authority.authority_version, attempt: scope.attempt, subject_reference: command.subject_reference,
        evaluated_at: ev.linked.binding.evaluated_at, source_disclosure: 'status_only', source_reference: null,
        decision: 'accepted', denial_reason: null, reference_state: 'available', current_actor_can_read: true };
    },
    async mutate(scope, command) {
      const staged = plans.get(scope); plans.delete(scope);
      must(staged && staged.command === hash(command) && staged.scope === scopeIdentity(scope));
      const { plan, membership } = staged!;
      const updated = await scope.query(`update experience.guides set title=$4,version=$5,content_version=$5
        where tenant_id=$1 and workspace_id=$2 and id=$3 and status='draft' and version=$6 returning id`,
      [scope.tenant_id, scope.workspace_id, guide.guide_id, plan.payload.title, plan.resulting_guide_version, plan.expected_guide_version]);
      must(updated.rowCount === 1);
      await scope.query(`insert into experience.guide_steps
        (id,tenant_id,workspace_id,guide_id,guide_version,position,title,body) values($1,$2,$3,$4,$5,1,$6,$7)`,
      [plan.payload.step_id, scope.tenant_id, scope.workspace_id, guide.guide_id, plan.resulting_guide_version,
        plan.payload.step_title, plan.payload.instructions]);
      const target = plan.receipt.document_target;
      if (target !== null) await scope.query(`insert into experience.guide_references
        (tenant_id,workspace_id,guide_id,guide_version,step_id,position,target_type,target_id,
          document_version_id,document_version,safe_label) values($1,$2,$3,$4,$5,1,'document',$6,$7,$8,$9)`,
      [scope.tenant_id, scope.workspace_id, guide.guide_id, plan.resulting_guide_version, plan.payload.step_id,
        target.document_id, target.document_version_id, target.document_version, target.label]);
      // Independent operation identity: neither CE typed receipt nor future Core receipt ID.
      const mutationId = randomUUID();
      const saved = await scope.query(CE012_SAVE_INSERT_SQL, [scope.tenant_id, scope.workspace_id,
        scope.actor_id, membership, keyFor(command), hash(command), JSON.stringify(command), JSON.stringify(guide),
        JSON.stringify(plan.receipt), mutationId, scope.database_transaction_id]);
      must(saved.rowCount === 1 && saved.rows.length === 1
        && stable(ce012GuideCommandReceiptV1Schema.parse(saved.rows[0].ce_receipt)) === stable(plan.receipt)
        && scopeIdentity(scope) === staged!.scope);
      completed = plan.receipt;
      return { mutation_id: mutationId };
    },
    async validateReplay(scope, command, authority, coreReceipt) {
      must(commandMatches(command, guide) && authorityMatches(scope, command, authority));
      const bound = scopeIdentity(scope);
      const rows = await scope.query(CE012_SAVE_STORED_SQL, [scope.tenant_id, scope.workspace_id, keyFor(command)]);
      must(rows.rowCount === 1 && rows.rows.length === 1);
      const row = storedRow.parse(rows.rows[0]);
      const receipt = ce012GuideCommandReceiptV1Schema.parse(row.ce_receipt);
      must(row.actor_id === scope.actor_id && row.canonical_key === keyFor(command)
        && row.command_hash === hash(command) && stable(coreTransactionCommandV2Schema.parse(row.command_json)) === stable(command)
        && stable(ce012GuideSaveCommandV1Schema.parse(row.guide_command)) === stable(guide)
        && row.mutation_id === coreReceipt.mutation_id && receipt.command_id === command.command_id);
      const ev = await evaluate(scope, command, authority, receipt);
      must(scopeIdentity(scope) === bound && row.membership_id === ev.membership);
      completed = receipt;
      return { contract_version: 'core-transaction-replay-provider-decision.v1', decision_id: randomUUID(),
        provider_code: CE012_SAVE_PROVIDER_CODE, database_transaction_id: scope.database_transaction_id,
        transaction_id: command.transaction_id, command_id: command.command_id, workspace_id: command.workspace_id,
        actor_id: command.actor_id, context_id: command.context_id, authority_decision_id: authority.decision_id,
        authority_version: authority.authority_version, attempt: scope.attempt, receipt_id: coreReceipt.receipt_id,
        receipt_contract_version: coreReceipt.contract_version, command_hash: coreTransactionReplayCommandHashV1(command),
        receipt_hash: coreTransactionReplayReceiptHashV1(coreReceipt), evaluated_at: ev.linked.binding.evaluated_at,
        read_only: true, decision: 'accepted', denial_reason: null };
    },
  };
}

/** Historical relationship reader only. Current disclosure remains a separate gate.
 * Must be composed with Core ef69's lock-then-fresh-expiry reader, not used instead.
 */
export async function readCe012SaveWriterRelationV1(scope: CoreTransactionScopeV1,
  commandValue: unknown, guideValue: unknown, coreValue: unknown) {
  const command = coreTransactionCommandV2Schema.parse(commandValue);
  const guide = ce012GuideSaveCommandV1Schema.parse(guideValue);
  const expected: CoreTransactionReceiptV2 = coreTransactionReceiptV2Schema.parse(coreValue);
  must(commandMatches(command, guide) && command.actor_id === scope.actor_id
    && command.workspace_id === scope.workspace_id && command.transaction_id === scope.transaction_id);
  const bound = scopeIdentity(scope);
  const rows = await scope.query(CE012_SAVE_STORED_SQL, [scope.tenant_id, scope.workspace_id, keyFor(command)]);
  must(rows.rowCount === 1 && rows.rows.length === 1 && scopeIdentity(scope) === bound);
  const row = storedRow.parse(rows.rows[0]);
  const ledger = await scope.query(CE012_SAVE_LEDGER_SQL, [scope.tenant_id, keyFor(command)]);
  must(ledger.rowCount === 1 && ledger.rows.length === 1 && scopeIdentity(scope) === bound
    && ledger.rows[0].request_hash === hash(command) && ledger.rows[0].actor_id === scope.actor_id);
  const core = coreTransactionReceiptV2Schema.parse(ledger.rows[0].response_ref);
  must(coreTransactionReplayReceiptHashV1(core) === coreTransactionReplayReceiptHashV1(expected));
  const ce = ce012GuideCommandReceiptV1Schema.parse(row.ce_receipt);
  must(row.canonical_key === keyFor(command) && row.actor_id === scope.actor_id
    && row.command_hash === hash(command) && stable(coreTransactionCommandV2Schema.parse(row.command_json)) === stable(command)
    && stable(ce012GuideSaveCommandV1Schema.parse(row.guide_command)) === stable(guide)
    && core.mutation_id === row.mutation_id && core.command_id === command.command_id
    && core.transaction_id === command.transaction_id && core.actor_id === command.actor_id
    && core.workspace_id === command.workspace_id && core.idempotency_key === command.idempotency_key
    && core.input_fingerprint === guide.payload_fingerprint && core.aggregate_id === guide.guide_id
    && core.aggregate_type === command.aggregate_type
    && core.authority.context_id === command.context_id && core.authority.authority_version === command.authority_version
    && core.authority.permission_code === command.permission_code && core.authority.module_code === command.module_code
    && core.authority.evaluation_purpose === command.evaluation_purpose
    && core.authority.decision_id === ce.core_decision_id
    && core.aggregate_version === ce.resulting_guide_version && coreSubjectReferencesMatch(core.subject_reference, command.subject_reference)
    && core.provider_evidence.provider_code === CE012_SAVE_PROVIDER_CODE
    && core.replay_validation?.provider_code === CE012_SAVE_PROVIDER_CODE
    && ce.command_id === guide.command_id && ce.guide_id === guide.guide_id
    && ce.context_id === guide.context_id && ce.workspace_id === guide.workspace_id
    && ce.previous_guide_version === guide.expected_guide_version
    && ce.payload_fingerprint === guide.payload_fingerprint && ce.idempotency_key === guide.idempotency_key
    && stable(ce.document_target && { ...ce.document_target, label: undefined })
      === stable(guide.payload.document_target && { ...guide.payload.document_target, label: undefined }));
  return { contract: 'ce012-save-writer-relation.v1' as const, runtime_binding: null,
    action_authorization: 'not_evaluated' as const,
    ce_receipt: ce, mutation_id: row.mutation_id, core_receipt_id: core.receipt_id,
    core_receipt_hash: coreTransactionReplayReceiptHashV1(core), canonical_key: keyFor(command),
    request_hash: row.command_hash, original_database_transaction_id: row.database_transaction_id };
}

/** One retained Core wire per editor command. Core owns all settlement/retry.
 * This adapter fits the existing editor executor port; no UI/HTTP wiring implied.
 */
export function createCe012SaveWriterExecutorV1(host: CoreTransactionHostV1,
  coreValue: unknown, documents: Ce012SaveDocumentsModuleV1 | null = null) {
  const command = coreTransactionCommandV2Schema.parse(coreValue);
  let uncertain = false;
  let retainedWire: string | null = null;
  let active: { wire: string; promise: Promise<Ce012GuideCommandEvaluationV1> } | null = null;
  return {
    execute(guideValue: unknown): Promise<Ce012GuideCommandEvaluationV1> {
      const guide = ce012GuideSaveCommandV1Schema.parse(guideValue);
      must(commandMatches(command, guide));
      const wire = stable(guide);
      must(retainedWire === null || retainedWire === wire);
      retainedWire = wire;
      if (active !== null) { must(active.wire === wire); return active.promise; }
      const task = (async (): Promise<Ce012GuideCommandEvaluationV1> => {
        const provider = createCe012SaveWriterProviderV1(guide, documents);
        const result = await host.execute(command, provider);
        if (result.status === 'unknown_commit') { uncertain = true; throw new Ce012SaveWriterUnknownV1(); }
        if (result.status === 'denied') {
          if (uncertain) throw new Ce012SaveWriterUnknownV1();
          return { decision_status: result.code === 'AUTHORITY_DENIED' ? 'denied' : 'not_ready',
            result_code: result.code === 'AUTHORITY_DENIED' ? 'AUTHORITY_DENIED' : 'PROVIDER_NOT_READY',
            replayed: false, receipt: null, mutation_plan: null };
        }
        const receipt = provider.localReceipt();
        must(receipt !== null && result.receipt.command_id === guide.command_id
          && result.receipt.input_fingerprint === guide.payload_fingerprint);
        uncertain = false;
        return { decision_status: 'accepted', result_code: 'OK', replayed: result.status === 'exact_replay',
          receipt, mutation_plan: null };
      })();
      active = { wire, promise: task };
      void task.finally(() => { if (active?.promise === task) active = null; }).catch(() => {});
      return task;
    },
  };
}
export class Ce012SaveWriterUnknownV1 extends Error {
  readonly code = 'CE012_SAVE_UNKNOWN';
  constructor() { super('Save settlement unknown; retain the exact command and key'); }
}
