import assert from 'node:assert/strict';
import { bindCanonicalCurrentAuthorityObservationV1 } from '../src/lib/core/current-authority-transaction-port-v1.ts';
import {
  Ce012ProviderBindingMismatchError,
  createCe012GuideProviderBridge,
} from '../src/lib/community/experience-guide-provider-bridge.ts';
import {
  CE012_GUIDE_COMMAND_CONTRACT,
  CORE_CE012_MAP_DECISION_CONTRACT,
  DOCS_CE012_REFERENCE_DECISION_CONTRACT,
  evaluateCe012GuideSaveCommand,
  fingerprintCe012GuideSavePayload,
} from '../src/lib/community/experience-guide-command-contract.ts';

const uuid = (suffix) => `70000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const lockTime = '2026-10-12T09:00:00.000Z';
const evaluatedAt = '2026-10-12T09:00:00.001Z';
const state = {
  contextAuthority: 'allowed',
  entitlement: 'active',
  transactionOutcome: 'allowed',
  documentsDecision: 'current_authorized',
  mutateContext: null,
  mutateReceipt: null,
  mutateDocuments: null,
  contextCalls: 0,
  transactionCalls: 0,
  documentsCalls: 0,
  writes: 0,
};

const command = {
  contract: CE012_GUIDE_COMMAND_CONTRACT,
  version: 1,
  command_id: uuid(1),
  action: 'save_draft',
  context_id: uuid(2),
  workspace_id: uuid(3),
  guide_id: uuid(4),
  expected_guide_version: 7,
  payload: {
    title: 'Arrival guide',
    step_id: uuid(5),
    step_title: 'Before arrival',
    instructions: 'Read the current instructions.',
    document_target: {
      document_id: uuid(6),
      document_version_id: uuid(7),
      document_version: 12,
      label: 'Untrusted browser label',
    },
  },
  idempotency_key: 'ce012:provider-bridge:0001',
};
command.payload_fingerprint = fingerprintCe012GuideSavePayload(command);

const transaction = () => ({
  decision_id: uuid(8),
  authority_version: 19,
  transaction_context: {
    transaction_id: uuid(9),
    command_id: command.command_id,
    attempt: 1,
    isolation_level: 'serializable',
    lock: {
      kind: 'command_aggregate',
      workspace_id: command.workspace_id,
      aggregate_type: 'experience_guide',
      aggregate_id: command.guide_id,
      acquired_at: lockTime,
    },
  },
});

const ports = {
  coreCommandContext: {
    async evaluate(request) {
      state.contextCalls += 1;
      return {
        contract: CORE_CE012_MAP_DECISION_CONTRACT,
        version: 1,
        decision_id: uuid(10),
        context_id: request.context_id,
        workspace_id: request.workspace_id,
        guide_id: request.guide_id,
        actor_id: uuid(11),
        membership_id: uuid(12),
        module_code: request.module_code,
        entitlement_key: request.entitlement_key,
        permission_code: request.permission_code,
        authority: state.contextAuthority,
        entitlement: state.entitlement,
        evaluated_at: lockTime,
        ...(state.mutateContext ?? {}),
      };
    },
  },
  coreTransactionalAuthority: {
    async recheckAfterLock(request) {
      state.transactionCalls += 1;
      if (state.transactionOutcome === 'unknown_commit') {
        throw new Error('Core authority recheck has unknown commit state');
      }
      const observation = {
        contract_version: 'core-current-authority-observation.v1',
        source_contract: 'workspace-native-effective-authority.v2',
        decision_id: request.decision_id,
        context_id: request.context_id,
        workspace_id: request.workspace_id,
        actor_id: request.actor_id,
        authority_version: request.authority_version,
        permission_code: request.permission_code,
        module_code: request.module_code,
        transaction_context: structuredClone(request.transaction_context),
        evaluator: 'app_private.check_workspace_native_permission_v2',
        source_disclosure: 'status_only',
        source_reference: null,
        actor_status: 'current',
        decision: 'allowed',
        evaluated_at: evaluatedAt,
      };
      if (state.transactionOutcome === 'revoked') observation.actor_status = 'revoked';
      if (state.transactionOutcome === 'cross_workspace') observation.workspace_id = uuid(80);
      if (state.transactionOutcome === 'stale_authority') observation.authority_version += 1;
      if (state.transactionOutcome === 'denied') observation.decision = 'denied';
      const receipt = bindCanonicalCurrentAuthorityObservationV1(request, observation);
      return { ...receipt, ...(state.mutateReceipt ?? {}) };
    },
  },
  documentsImmutableSelector: {
    async select(request) {
      state.documentsCalls += 1;
      const released = state.documentsDecision === 'current_authorized'
        || state.documentsDecision === 'historical_authorized';
      return {
        contract: DOCS_CE012_REFERENCE_DECISION_CONTRACT,
        version: 1,
        decision_id: uuid(30),
        context_id: request.context_id,
        workspace_id: request.workspace_id,
        guide_id: request.guide_id,
        target: request.target,
        evaluation_mode: request.evaluation_mode,
        authority_basis: 'current_server_session',
        decision: state.documentsDecision,
        safe_label: released ? 'Provider safe label' : null,
        redaction: released ? 'safe_label_only' : 'none',
        evaluated_at: '2026-10-12T09:00:00.002Z',
        ...(state.mutateDocuments ?? {}),
      };
    },
  },
};

const bridge = createCe012GuideProviderBridge(ports);
const runtimeSnapshot = {
  guide: {
    context_id: command.context_id,
    workspace_id: command.workspace_id,
    guide_id: command.guide_id,
    current_version: command.expected_guide_version,
    state: 'draft',
  },
  issuance: {
    receipt_id: uuid(40),
    idempotency_binding_id: uuid(41),
    evaluated_at: '2026-10-12T09:00:00.003Z',
  },
  replay: null,
};

const evaluate = async (transactionInput = transaction(), mode = 'new_command') => {
  const writesBefore = state.writes;
  const providers = await bridge.evaluate(command, transactionInput, mode);
  assert.equal(state.writes, writesBefore, 'provider bridge must be zero-write');
  return {
    providers,
    result: evaluateCe012GuideSaveCommand(command, {
      ...runtimeSnapshot,
      core_decision: providers.core_decision,
      document_decision: providers.document_decision,
    }),
  };
};

const accepted = await evaluate();
assert.equal(accepted.providers.authority_receipt.contract_version, 'core-current-authority-decision-receipt.v1');
assert.equal(accepted.providers.authority_receipt.decision, 'allowed');
assert.equal(accepted.providers.authority_receipt.transaction_bound, true);
assert.equal(accepted.providers.binding.context_id, command.context_id);
assert.equal(accepted.providers.binding.workspace_id, command.workspace_id);
assert.equal(accepted.providers.binding.guide_id, command.guide_id);
assert.equal(accepted.providers.binding.guide_version, command.expected_guide_version);
assert.equal(accepted.providers.binding.authority_version, 19);
assert.equal(accepted.providers.binding.document_version_id, command.payload.document_target.document_version_id);
assert.equal(accepted.providers.binding.document_version, command.payload.document_target.document_version);
assert.equal(accepted.providers.binding.safe_label, 'Provider safe label');
assert.equal(accepted.result.result_code, 'OK');
assert.equal(accepted.result.receipt.document_target.label, 'Provider safe label');

for (const [outcome, expectedAuthority] of [
  ['revoked', 'revoked'],
  ['cross_workspace', 'denied'],
  ['stale_authority', 'denied'],
  ['denied', 'denied'],
]) {
  state.transactionOutcome = outcome;
  const documentsBefore = state.documentsCalls;
  const evaluated = await evaluate();
  assert.equal(evaluated.providers.core_decision.authority, expectedAuthority, outcome);
  assert.equal(evaluated.result.result_code, 'AUTHORITY_DENIED', outcome);
  assert.equal(evaluated.result.receipt, null, `${outcome}: no receipt`);
  assert.equal(evaluated.result.mutation_plan, null, `${outcome}: zero mutation plan`);
  assert.equal(state.documentsCalls, documentsBefore, `${outcome}: Documents skipped`);
}

state.transactionOutcome = 'unknown_commit';
const documentsBeforeUnknown = state.documentsCalls;
const writesBeforeUnknown = state.writes;
await assert.rejects(bridge.evaluate(command, transaction(), 'new_command'), /unknown commit state/);
assert.equal(state.documentsCalls, documentsBeforeUnknown, 'unknown commit skips Documents');
assert.equal(state.writes, writesBeforeUnknown, 'unknown commit is zero-write in bridge');

state.transactionOutcome = 'allowed';
for (const [documentsDecision, expected] of [
  ['stale', 'DOCUMENT_STALE'],
  ['not_found', 'DOCUMENT_NOT_FOUND'],
]) {
  state.documentsDecision = documentsDecision;
  const evaluated = await evaluate();
  assert.equal(evaluated.result.result_code, expected);
  assert.equal(evaluated.result.receipt, null);
  assert.equal(evaluated.result.mutation_plan, null);
}
state.documentsDecision = 'current_authorized';

for (const [field, transactionInput] of [
  ['transaction command_id', { ...transaction(), transaction_context: { ...transaction().transaction_context, command_id: uuid(50) } }],
  ['transaction lock Workspace', { ...transaction(), transaction_context: { ...transaction().transaction_context, lock: { ...transaction().transaction_context.lock, workspace_id: uuid(51) } } }],
  ['transaction Guide', { ...transaction(), transaction_context: { ...transaction().transaction_context, lock: { ...transaction().transaction_context.lock, aggregate_id: uuid(52) } } }],
]) {
  const callsBefore = state.contextCalls;
  await assert.rejects(
    bridge.evaluate(command, transactionInput, 'new_command'),
    (error) => error instanceof Ce012ProviderBindingMismatchError && error.field === field,
  );
  assert.equal(state.contextCalls, callsBefore, `${field}: rejected before provider call`);
}

state.mutateContext = { workspace_id: uuid(60) };
await assert.rejects(
  bridge.evaluate(command, transaction(), 'new_command'),
  (error) => error instanceof Ce012ProviderBindingMismatchError && error.field === 'Core context workspace_id',
);
state.mutateContext = null;

state.mutateReceipt = { authority_version: 20 };
await assert.rejects(
  bridge.evaluate(command, transaction(), 'new_command'),
  (error) => error instanceof Ce012ProviderBindingMismatchError && error.field === 'Core transaction authority_version',
);
state.mutateReceipt = null;

state.mutateDocuments = { workspace_id: uuid(61) };
await assert.rejects(
  bridge.evaluate(command, transaction(), 'new_command'),
  (error) => error instanceof Ce012ProviderBindingMismatchError && error.field === 'Documents workspace_id',
);
state.mutateDocuments = null;

const replay = await bridge.evaluate(command, transaction(), 'replay');
assert.equal(replay.document_decision.evaluation_mode, 'replay');

console.log('CE012 provider bridge passed: canonical Core transaction receipt, exact Workspace/Guide/document/safe-label/authority-version binding, bounded denials and zero-write failures');
