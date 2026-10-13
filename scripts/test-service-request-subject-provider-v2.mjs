import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loadedModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url)) : require(name),
  loadedModule, loadedModule.exports);
  cache.set(url.href, loadedModule.exports);
  return loadedModule.exports;
}

const {
  resolveServiceRequestSubjectProviderV2,
  serviceRequestSubjectEvidenceProviderV2,
  serviceRequestSubjectProviderCodeV2,
} = load(new URL('../src/lib/customer/service-request-subject-provider-v2.ts', import.meta.url));
const { coreTransactionProviderEvidenceV1Schema } = load(new URL(
  '../src/lib/core/transaction-provider-evidence-v1.ts', import.meta.url,
));

const id = value => `11000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const workspaceId = id(1);
const actorId = id(2);
const requestId = id(3);
const partyId = id(4);
const transactionId = id(5);
const commandId = id(6);
const aggregateId = id(7);

function command(overrides = {}) {
  return {
    contract_version: 'core-transaction-command.v2',
    transaction_id: transactionId,
    command_id: commandId,
    context_id: id(8),
    workspace_id: workspaceId,
    actor_id: actorId,
    authority_version: 9,
    permission_code: 'services.orders.read',
    module_code: 'services_orders',
    evaluation_purpose: 'service.request.subject_context',
    aggregate_type: 'service_operation',
    aggregate_id: aggregateId,
    aggregate_version: 2,
    provider_source_ids: [requestId],
    idempotency_key: 'service-request-provider-v2-test',
    input_fingerprint: 'sha256:0123456789abcdef',
    subject_reference: {
      kind: 'service_request', id: requestId, version: 3,
      relation: 'request_party', request_version: 3,
    },
    ...overrides,
  };
}

function authority(overrides = {}) {
  return {
    contract_version: 'core-current-authority-decision-receipt.v1',
    receipt_version: 1,
    decision_id: id(9),
    context_id: id(8),
    workspace_id: workspaceId,
    actor_id: actorId,
    authority_version: 9,
    permission_code: 'services.orders.read',
    module_code: 'services_orders',
    evaluation_purpose: 'service.request.subject_context',
    transaction_context: {
      transaction_id: transactionId,
      command_id: commandId,
      attempt: 1,
      isolation_level: 'serializable',
      lock: {
        kind: 'command_aggregate', workspace_id: workspaceId,
        aggregate_type: 'service_operation', aggregate_id: aggregateId,
        acquired_at: '2026-10-13T15:00:00.000Z',
      },
    },
    evaluator: 'app_private.check_workspace_native_permission_v2',
    source_disclosure: 'status_only',
    source_reference: null,
    evaluated_at: '2026-10-13T15:00:00.001Z',
    rechecked_after_lock: true,
    transaction_bound: true,
    reusable_as_command_authority: false,
    current_authority_recheck_required_on_retry: true,
    decision: 'allowed',
    denial_reason: null,
    ...overrides,
  };
}

const available = {
  decision: 'accepted',
  denial_reason: null,
  request_context: {
    request_id: requestId,
    request_version: 3,
    workspace_id: workspaceId,
    status: 'submitted',
    actor_party_snapshot: { party_id: partyId, current_actor_is_party: true },
    audience_party_snapshot: { party_ids: [partyId], request_party_only: true },
  },
  evaluated_at: '2026-10-13T15:00:00.002Z',
};
const boundedDenial = reason => ({
  decision: 'denied', denial_reason: reason, request_context: null,
  evaluated_at: '2026-10-13T15:00:00.002Z',
});

function harness(row = available, sqlError) {
  const calls = [];
  const scope = {
    transaction_id: transactionId,
    database_transaction_id: '991',
    workspace_id: workspaceId,
    tenant_id: id(10),
    actor_id: actorId,
    attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      if (sqlError) throw Object.assign(new Error('database failure'), { code: sqlError });
      return { rows: row ? [structuredClone(row)] : [], rowCount: row ? 1 : 0 };
    },
  };
  return { scope, calls };
}

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

await check('accepted canonical Request maps to strict Core evidence', async () => {
  const { scope } = harness();
  const result = await resolveServiceRequestSubjectProviderV2(scope, command(), authority());
  assert.equal(coreTransactionProviderEvidenceV1Schema.safeParse(result).success, true);
  assert.equal(result.decision, 'accepted');
  assert.equal(result.provider_code, serviceRequestSubjectProviderCodeV2);
  assert.deepEqual(result.subject_reference, command().subject_reference);
  assert.equal(result.source_reference, null);
});

await check('provider callback uses the merged CoreTransactionProvidersV2 surface', () => {
  assert.equal(serviceRequestSubjectEvidenceProviderV2.provider_code, serviceRequestSubjectProviderCodeV2);
  assert.equal(serviceRequestSubjectEvidenceProviderV2.validateProviders, resolveServiceRequestSubjectProviderV2);
});

await check('one resolver query carries exact Context, Workspace, actor, Request and version', async () => {
  const { scope, calls } = harness();
  await resolveServiceRequestSubjectProviderV2(scope, command(), authority());
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /resolve_service_request_subject_provider_v2/);
  assert.deepEqual(calls[0].values, [id(8), workspaceId, actorId, requestId, 3]);
});

await check('accepted evidence discloses no beneficiary or Request payload', async () => {
  const { scope } = harness();
  const serialized = JSON.stringify(await resolveServiceRequestSubjectProviderV2(scope, command(), authority()));
  for (const forbidden of ['party_id', 'audience_party_snapshot', 'description', 'beneficiary_party_id']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

for (const reason of ['STALE_SUBJECT', 'SUBJECT_DENIED']) {
  await check(`${reason} remains a bounded denial row`, async () => {
    const { scope } = harness(boundedDenial(reason));
    const result = await resolveServiceRequestSubjectProviderV2(scope, command(), authority());
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, reason);
    assert.equal(result.source_reference, null);
  });
}

for (const sqlState of ['40001', 'XX000']) {
  await check(`database ${sqlState} propagates to Core`, async () => {
    const { scope } = harness(null, sqlState);
    await assert.rejects(resolveServiceRequestSubjectProviderV2(scope, command(), authority()),
      error => error.code === sqlState);
  });
}

for (const [name, mutate, reason] of [
  ['permission', value => ({ ...value, permission_code: 'services.orders.request' }), 'RELATION_MISMATCH'],
  ['module', value => ({ ...value, module_code: 'services_catalog' }), 'RELATION_MISMATCH'],
  ['purpose', value => ({ ...value, evaluation_purpose: 'service.order.transition' }), 'RELATION_MISMATCH'],
  ['subject kind', value => ({ ...value, subject_reference: { ...value.subject_reference, kind: 'message' } }), 'RELATION_MISMATCH'],
  ['subject relation', value => ({ ...value, subject_reference: { ...value.subject_reference, relation: 'subject_link' } }), 'RELATION_MISMATCH'],
  ['source lock', value => ({ ...value, provider_source_ids: [] }), 'RELATION_MISMATCH'],
  ['source version', value => ({ ...value, subject_reference: { ...value.subject_reference, request_version: 4 } }), 'STALE_SUBJECT'],
]) {
  await check(`${name} mismatch denies before SQL`, async () => {
    const { scope, calls } = harness();
    const result = await resolveServiceRequestSubjectProviderV2(scope, mutate(command()), authority());
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, reason);
    assert.equal(calls.length, 0);
  });
}

for (const [name, mutate] of [
  ['denied authority', value => ({ ...value, decision: 'denied', denial_reason: 'ACTOR_REVOKED', rechecked_after_lock: false })],
  ['actor authority', value => ({ ...value, actor_id: id(99) })],
  ['Workspace authority', value => ({ ...value, workspace_id: id(99) })],
  ['transaction authority', value => ({ ...value, transaction_context: { ...value.transaction_context, transaction_id: id(99) } })],
  ['attempt authority', value => ({ ...value, transaction_context: { ...value.transaction_context, attempt: 2 } })],
  ['permission authority', value => ({ ...value, permission_code: 'services.orders.request' })],
]) {
  await check(`${name} mismatch denies before SQL`, async () => {
    const { scope, calls } = harness();
    const result = await resolveServiceRequestSubjectProviderV2(scope, command(), mutate(authority()));
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, 'SUBJECT_DENIED');
    assert.equal(calls.length, 0);
  });
}

for (const [name, row, reason] of [
  ['Request identity', { ...available, request_context: { ...available.request_context, request_id: id(99) } }, 'STALE_SUBJECT'],
  ['Request version', { ...available, request_context: { ...available.request_context, request_version: 4 } }, 'STALE_SUBJECT'],
  ['Workspace', { ...available, request_context: { ...available.request_context, workspace_id: id(99) } }, 'RELATION_MISMATCH'],
  ['party audience', { ...available, request_context: { ...available.request_context,
    audience_party_snapshot: { party_ids: [id(99)], request_party_only: true } } }, 'PROVIDER_UNAVAILABLE'],
  ['evaluation time', { ...available, evaluated_at: 'private-clock' }, 'PROVIDER_UNAVAILABLE'],
]) {
  await check(`${name} result mismatch fails closed`, async () => {
    const { scope } = harness(row);
    const result = await resolveServiceRequestSubjectProviderV2(scope, command(), authority());
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, reason);
  });
}

await check('missing resolver row fails closed', async () => {
  const { scope } = harness(null);
  const result = await resolveServiceRequestSubjectProviderV2(scope, command(), authority());
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'SUBJECT_DENIED');
});

await check('migration uses canonical exact permission and module before and after locks', () => {
  const sql = readFileSync(new URL(
    '../supabase/migrations/20261013145654_service_request_subject_provider_v2.sql', import.meta.url,
  ), 'utf8');
  assert.equal((sql.match(/check_workspace_native_permission_v2\(/g) ?? []).length, 3);
  assert.match(sql, /'services\.orders\.read','services_orders'/);
  assert.match(sql, /requester_id=p_actor_id/);
  assert.match(sql, /beneficiary_party_id/);
  assert.match(sql, /for share/);
  assert.doesNotMatch(sql, /grant\s+execute|create\s+table|insert\s+into/i);
});

await check('provider imports Core contracts and the existing Request reference mapper directly', () => {
  const source = readFileSync(new URL(
    '../src/lib/customer/service-request-subject-provider-v2.ts', import.meta.url,
  ), 'utf8');
  assert.match(source, /CoreTransactionProvidersV2/);
  assert.match(source, /serviceRequestSubjectContextToCoreReferenceV1/);
  assert.match(source, /coreSubjectReferencesMatch/);
  assert.doesNotMatch(source, /catch\s*\(/);
});

console.log(`SERVICE Request Core provider V2: ${passed}/${passed} PASS`);
