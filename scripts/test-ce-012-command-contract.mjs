import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  CE012_GUIDE_COMMAND_CONTRACT,
  CORE_CE012_MAP_DECISION_CONTRACT,
  DOCS_CE012_REFERENCE_DECISION_CONTRACT,
  ce012GuideSaveCommandV1Schema,
  evaluateCe012GuideSaveCommand,
  fingerprintCe012GuideSavePayload,
  isCe012GuideCompletionCurrent,
} from '../src/lib/community/experience-guide-command-contract.ts';

let assertions = 0;
const check = (value, message) => {
  assertions += 1;
  assert.ok(value, message);
};
const equal = (actual, expected, message) => {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
};
const id = () => randomUUID();
const now = '2026-10-11T12:00:00.000Z';

const identity = {
  context_id: id(),
  workspace_id: id(),
  guide_id: id(),
};
const target = {
  document_id: id(),
  document_version_id: id(),
  document_version: 9,
  label: 'Safety guide',
};

const makeCommand = (overrides = {}) => {
  const draft = {
    contract: CE012_GUIDE_COMMAND_CONTRACT,
    version: 1,
    command_id: id(),
    action: 'save_draft',
    ...identity,
    expected_guide_version: 4,
    payload: {
      title: 'Arrival guide',
      step_id: id(),
      step_title: 'Before arrival',
      instructions: 'Read the current document before arrival.',
      document_target: target,
    },
    idempotency_key: `ce012:${id()}`,
    ...overrides,
  };
  draft.payload_fingerprint = fingerprintCe012GuideSavePayload(draft);
  return draft;
};

const makeSnapshot = (command, overrides = {}) => ({
  guide: {
    ...identity,
    current_version: command.expected_guide_version,
    state: 'draft',
  },
  core_decision: {
    contract: CORE_CE012_MAP_DECISION_CONTRACT,
    version: 1,
    decision_id: id(),
    context_id: command.context_id,
    workspace_id: command.workspace_id,
    guide_id: command.guide_id,
    actor_id: id(),
    membership_id: id(),
    module_code: 'experience_guides',
    entitlement_key: 'module.experience_guides',
    permission_code: 'experience.guide.manage',
    authority: 'allowed',
    entitlement: 'active',
    evaluated_at: now,
  },
  document_decision: command.payload.document_target === null ? null : {
    contract: DOCS_CE012_REFERENCE_DECISION_CONTRACT,
    version: 1,
    decision_id: id(),
    context_id: command.context_id,
    workspace_id: command.workspace_id,
    guide_id: command.guide_id,
    target: {
      document_id: command.payload.document_target.document_id,
      document_version_id: command.payload.document_target.document_version_id,
      document_version: command.payload.document_target.document_version,
    },
    evaluation_mode: 'new_command',
    authority_basis: 'current_server_session',
    decision: 'current_authorized',
    safe_label: command.payload.document_target.label,
    redaction: 'safe_label_only',
    evaluated_at: now,
  },
  issuance: {
    receipt_id: id(),
    idempotency_binding_id: id(),
    evaluated_at: now,
  },
  replay: null,
  ...overrides,
});

const evaluateWithoutMutation = (command, snapshot) => {
  const commandBefore = structuredClone(command);
  const snapshotBefore = structuredClone(snapshot);
  const result = evaluateCe012GuideSaveCommand(command, snapshot);
  equal(command, commandBefore, 'evaluation must not mutate the command');
  equal(snapshot, snapshotBefore, 'evaluation must not mutate provider snapshots');
  return result;
};

const command = makeCommand();
const snapshot = makeSnapshot(command);
const documentDecision = (decision, extra = {}) => ({
  ...snapshot.document_decision,
  decision,
  safe_label: ['current_authorized', 'historical_authorized'].includes(decision) ? target.label : null,
  redaction: ['current_authorized', 'historical_authorized'].includes(decision) ? 'safe_label_only' : 'none',
  ...extra,
});
const accepted = evaluateWithoutMutation(command, snapshot);
equal(accepted.decision_status, 'accepted', 'valid save is accepted');
equal(accepted.result_code, 'OK', 'valid save returns OK');
equal(accepted.replayed, false, 'new save is not a replay');
check(accepted.receipt !== null, 'accepted save has a receipt');
check(accepted.mutation_plan !== null, 'accepted save has one mutation plan');
equal(accepted.receipt?.context_id, command.context_id, 'receipt binds Context');
equal(accepted.receipt?.workspace_id, command.workspace_id, 'receipt binds Workspace');
equal(accepted.receipt?.guide_id, command.guide_id, 'receipt binds Guide');
equal(accepted.receipt?.previous_guide_version, 4, 'receipt binds current Guide version');
equal(accepted.receipt?.resulting_guide_version, 5, 'receipt advances Guide once');
equal(accepted.receipt?.document_target, target, 'receipt binds immutable document version target');
equal(accepted.receipt?.payload_fingerprint, command.payload_fingerprint, 'receipt binds payload fingerprint');
equal(accepted.receipt?.idempotency_key, command.idempotency_key, 'receipt binds idempotency key');
equal(accepted.receipt?.authority, 'verified', 'receipt records server-owned authority result');
equal(accepted.receipt?.entitlement, 'verified', 'receipt records server-owned entitlement result');
equal(accepted.receipt?.evaluated_at, now, 'receipt timestamp is server-issued');

const redactedLabel = 'Provider safe label';
const redactedAccepted = evaluateWithoutMutation(command, {
  ...snapshot,
  document_decision: { ...snapshot.document_decision, safe_label: redactedLabel },
});
equal(redactedAccepted.result_code, 'OK', 'provider label may differ from the browser label');
equal(redactedAccepted.receipt?.document_target?.label, redactedLabel, 'receipt uses the provider-redacted label');
equal(redactedAccepted.mutation_plan?.payload.document_target?.label, redactedLabel, 'mutation plan uses the provider-redacted label');

const redactedReplay = evaluateWithoutMutation(command, {
  ...snapshot,
  guide: { ...snapshot.guide, current_version: 5 },
  document_decision: { ...snapshot.document_decision, evaluation_mode: 'replay', safe_label: redactedLabel },
  replay: {
    idempotency_key: command.idempotency_key,
    payload_fingerprint: command.payload_fingerprint,
    receipt: redactedAccepted.receipt,
  },
});
equal(redactedReplay.result_code, 'OK', 'replay identity does not trust or compare the browser label');
equal(redactedReplay.replayed, true, 'redacted-label retry returns the original receipt');
equal(redactedReplay.mutation_plan, null, 'redacted-label replay remains zero-write');

const replaySnapshot = makeSnapshot(command, {
  guide: { ...snapshot.guide, current_version: 5 },
  document_decision: { ...snapshot.document_decision, decision_id: id(), evaluation_mode: 'replay' },
  replay: {
    idempotency_key: command.idempotency_key,
    payload_fingerprint: command.payload_fingerprint,
    receipt: accepted.receipt,
  },
});
const replayed = evaluateWithoutMutation(command, replaySnapshot);
equal(replayed.result_code, 'OK', 'same-key same-payload replay succeeds');
equal(replayed.replayed, true, 'same-key same-payload is marked replayed');
equal(replayed.receipt, accepted.receipt, 'unknown-commit retry returns original receipt');
equal(replayed.mutation_plan, null, 'replay performs zero new mutation');

const changedCommand = structuredClone(command);
changedCommand.payload.title = 'Changed after retry';
changedCommand.payload_fingerprint = fingerprintCe012GuideSavePayload(changedCommand);
const changed = evaluateWithoutMutation(changedCommand, replaySnapshot);
equal(changed.result_code, 'REPLAY_CONFLICT', 'same key with changed payload conflicts');
equal(changed.mutation_plan, null, 'changed-payload replay has zero mutation');
equal(changed.receipt, null, 'changed-payload replay emits no receipt');

const denials = [
  ['fingerprint mismatch', { command: { ...command, payload_fingerprint: `sha256:${'0'.repeat(64)}` } }, 'PAYLOAD_FINGERPRINT_MISMATCH'],
  ['cross-Workspace Core decision', { snapshot: { ...snapshot, core_decision: { ...snapshot.core_decision, workspace_id: id() } } }, 'WORKSPACE_MISMATCH'],
  ['cross-Context Guide', { snapshot: { ...snapshot, guide: { ...snapshot.guide, context_id: id() } } }, 'WORKSPACE_MISMATCH'],
  ['cross-Workspace document decision', { snapshot: { ...snapshot, document_decision: { ...snapshot.document_decision, workspace_id: id() } } }, 'WORKSPACE_MISMATCH'],
  ['revoked authority', { snapshot: { ...snapshot, core_decision: { ...snapshot.core_decision, authority: 'revoked' } } }, 'AUTHORITY_DENIED'],
  ['denied authority', { snapshot: { ...snapshot, core_decision: { ...snapshot.core_decision, authority: 'denied' } } }, 'AUTHORITY_DENIED'],
  ['inactive entitlement', { snapshot: { ...snapshot, core_decision: { ...snapshot.core_decision, entitlement: 'inactive' } } }, 'ENTITLEMENT_INACTIVE'],
  ['Core provider not ready', { snapshot: { ...snapshot, core_decision: { ...snapshot.core_decision, authority: 'not_ready' } } }, 'PROVIDER_NOT_READY'],
  ['missing Guide', { snapshot: { ...snapshot, guide: null } }, 'GUIDE_UNAVAILABLE'],
  ['non-draft Guide', { snapshot: { ...snapshot, guide: { ...snapshot.guide, state: 'published' } } }, 'ACTION_NOT_ALLOWED'],
  ['stale Guide', { snapshot: { ...snapshot, guide: { ...snapshot.guide, current_version: 5 } } }, 'STALE_GUIDE'],
  ['missing document decision', { snapshot: { ...snapshot, document_decision: null } }, 'DOCUMENT_DECISION_REQUIRED'],
  ['document provider not ready', { snapshot: { ...snapshot, document_decision: documentDecision('not_ready') } }, 'PROVIDER_NOT_READY'],
  ['document not found', { snapshot: { ...snapshot, document_decision: documentDecision('not_found') } }, 'DOCUMENT_NOT_FOUND'],
  ['document denied', { snapshot: { ...snapshot, document_decision: documentDecision('denied') } }, 'DOCUMENT_DENIED'],
  ['stale document result', { snapshot: { ...snapshot, document_decision: documentDecision('stale') } }, 'DOCUMENT_STALE'],
  ['changed immutable document version ID', { snapshot: { ...snapshot, document_decision: { ...snapshot.document_decision, target: { ...snapshot.document_decision.target, document_version_id: id() } } } }, 'DOCUMENT_STALE'],
  ['historical document on new save', { snapshot: { ...snapshot, document_decision: documentDecision('historical_authorized') } }, 'DOCUMENT_STALE'],
];

for (const [name, changes, expectedCode] of denials) {
  const denialCommand = changes.command ?? command;
  const denialSnapshot = changes.snapshot ?? snapshot;
  const result = evaluateWithoutMutation(denialCommand, denialSnapshot);
  equal(result.result_code, expectedCode, `${name}: result code`);
  equal(result.receipt, null, `${name}: no receipt`);
  equal(result.mutation_plan, null, `${name}: zero mutation`);
}

const replayAfterRevocation = evaluateWithoutMutation(command, {
  ...replaySnapshot,
  core_decision: { ...replaySnapshot.core_decision, authority: 'revoked' },
});
equal(replayAfterRevocation.result_code, 'AUTHORITY_DENIED', 'replay rechecks current authority');
equal(replayAfterRevocation.receipt, null, 'revoked replay does not disclose prior receipt');
equal(replayAfterRevocation.mutation_plan, null, 'revoked replay has zero mutation');

const replayWithoutExactDocumentCheck = evaluateWithoutMutation(command, {
  ...replaySnapshot,
  document_decision: { ...replaySnapshot.document_decision, evaluation_mode: 'new_command' },
});
equal(replayWithoutExactDocumentCheck.result_code, 'DOCUMENT_DECISION_REQUIRED', 'replay requires explicit exact-version recheck');
equal(replayWithoutExactDocumentCheck.mutation_plan, null, 'unverified replay has zero mutation');

const noTargetCommand = makeCommand({ payload: { ...command.payload, document_target: null } });
noTargetCommand.payload_fingerprint = fingerprintCe012GuideSavePayload(noTargetCommand);
const noTarget = evaluateWithoutMutation(noTargetCommand, makeSnapshot(noTargetCommand));
equal(noTarget.result_code, 'OK', 'save without optional document target is accepted');
equal(noTarget.receipt?.document_target, null, 'null target is preserved');
equal(noTarget.receipt?.document_decision_id, null, 'null target has no document decision binding');

const activeIdentity = { ...identity };
check(isCe012GuideCompletionCurrent(accepted.receipt, activeIdentity), 'completion applies to the originating editor');
check(!isCe012GuideCompletionCurrent(accepted.receipt, { ...activeIdentity, context_id: id() }), 'late completion is ignored after Context switch');
check(!isCe012GuideCompletionCurrent(accepted.receipt, { ...activeIdentity, workspace_id: id() }), 'late completion is ignored after Workspace switch');
check(!isCe012GuideCompletionCurrent(accepted.receipt, { ...activeIdentity, guide_id: id() }), 'late completion is ignored after Guide switch');

for (const serverOwnedField of ['authority', 'entitlement', 'receipt_id', 'resulting_guide_version', 'evaluated_at']) {
  const injected = { ...command, [serverOwnedField]: 'client-value' };
  check(!ce012GuideSaveCommandV1Schema.safeParse(injected).success, `client cannot supply ${serverOwnedField}`);
}

const firstAttempt = evaluateCe012GuideSaveCommand(command, snapshot);
const retryWithoutCommit = evaluateCe012GuideSaveCommand(command, {
  ...snapshot,
  issuance: { receipt_id: id(), idempotency_binding_id: id(), evaluated_at: now },
});
equal(firstAttempt.result_code, 'OK', 'first failure-prone attempt can plan a save');
equal(retryWithoutCommit.result_code, 'OK', 'same-key retry after a rolled-back failure can be planned');
equal(retryWithoutCommit.mutation_plan?.payload, command.payload, 'failure/retry preserves every input field');
equal(retryWithoutCommit.mutation_plan?.receipt.payload_fingerprint, command.payload_fingerprint, 'failure/retry preserves the binding');

console.log(`CE012 command contract: ${assertions} assertions passed`);
