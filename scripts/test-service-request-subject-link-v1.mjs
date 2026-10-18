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
  SERVICE_SUBJECT_LINK_CORE_BINDING_V1,
  buildServiceSubjectLinkCoreCommandV1,
  createServiceSubjectLinkCoreProvidersV1,
} = load(new URL('../src/lib/customer/service-request-subject-link-v1.ts', import.meta.url));
const { fingerprintServiceProviderInput } = load(new URL(
  '../src/lib/customer/service-collaboration-v14-schema.ts', import.meta.url,
));

const id = value => `51000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const intent = {
  context_id: id(1), workspace_id: id(2), service_request_id: id(3),
  expected_request_version: 4, reference_kind: 'message', reference_id: id(4),
  source_version: 7, relation: 'conversation', idempotency_key: 'subject-link-unit-01',
};
const command = buildServiceSubjectLinkCoreCommandV1(intent, {
  transaction_id: id(5), command_id: id(6), actor_id: id(7), authority_version: 11,
});
const authority = {
  contract_version: 'core-current-authority-decision-receipt.v1', receipt_version: 1,
  decision_id: id(8), context_id: intent.context_id, workspace_id: intent.workspace_id,
  actor_id: id(7), authority_version: 11, ...SERVICE_SUBJECT_LINK_CORE_BINDING_V1,
  transaction_context: {
    transaction_id: id(5), command_id: id(6), attempt: 1, isolation_level: 'serializable',
    lock: { kind: 'command_aggregate', workspace_id: intent.workspace_id,
      aggregate_type: 'service_request', aggregate_id: intent.service_request_id,
      acquired_at: '2026-10-18T16:00:00.000Z' },
  },
  evaluator: 'app_private.check_workspace_native_permission_v2', source_disclosure: 'status_only',
  source_reference: null, evaluated_at: '2026-10-18T16:00:00.001Z',
  rechecked_after_lock: true, transaction_bound: true, reusable_as_command_authority: false,
  current_authority_recheck_required_on_retry: true, decision: 'allowed', denial_reason: null,
};
const accepted = phase => ({
  decision: 'accepted', denial_reason: null,
  mutation_id: phase === 'validate' ? null : id(9),
  request_version: '5', message_version: '7',
  evaluated_at: '2026-10-18T16:00:00.002Z', write_applied: phase === 'apply',
});

function harness(rows = {}) {
  const calls = [];
  const scope = {
    transaction_id: command.transaction_id, database_transaction_id: '99',
    workspace_id: command.workspace_id, tenant_id: id(10), actor_id: command.actor_id, attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      assert.match(text, /app_private\.execute_service_request_message_link_v2/);
      const phase = values[0];
      const row = Object.hasOwn(rows, phase) ? rows[phase] : accepted(phase);
      return { rows: row ? [structuredClone(row)] : [], rowCount: row ? 1 : 0 };
    },
  };
  return { scope, calls };
}

function receipt() {
  return {
    contract_version: 'core-transaction-receipt.v2', receipt_version: 2, receipt_id: id(11),
    transaction_id: command.transaction_id, command_id: command.command_id,
    workspace_id: command.workspace_id, actor_id: command.actor_id,
    aggregate_type: command.aggregate_type, aggregate_id: command.aggregate_id,
    aggregate_version: command.aggregate_version, input_fingerprint: command.input_fingerprint,
    idempotency_key: command.idempotency_key, mutation_id: id(9),
    subject_reference: command.subject_reference,
    replay_validation: { contract_version: 'core-transaction-replay-provider-requirement.v1',
      provider_code: 'communications.private_message_request_audience' },
    provider_evidence: { provider_code: 'communications.private_message_request_audience' },
    authority, audit_event_id: '1', outbox_event_id: id(12),
    committed_at: '2026-10-18T16:00:00.003Z',
  };
}

let passed = 0;
async function check(name, run) {
  await run();
  console.log(`ok ${++passed} - ${name}`);
}

await check('collaboration intent maps to the exact Core V2 command', () => {
  assert.equal(command.aggregate_version, 5);
  assert.deepEqual(command.provider_source_ids, [intent.reference_id]);
  assert.deepEqual(command.subject_reference, {
    kind: 'message', id: intent.reference_id, version: 7,
    relation: 'subject_link', request_version: 7,
  });
  assert.equal(command.input_fingerprint, fingerprintServiceProviderInput(intent));
});

await check('subject-link authority is not substituted by request/read authority', () => {
  assert.equal(SERVICE_SUBJECT_LINK_CORE_BINDING_V1.permission_code, 'services.orders.subject_link');
  assert.notEqual(SERVICE_SUBJECT_LINK_CORE_BINDING_V1.permission_code, 'services.orders.read');
});

await check('provider requires current-state replay', () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  assert.equal(providers.provider_code, 'communications.private_message_request_audience');
  assert.equal(providers.replay_policy, 'provider_current_state_required');
  assert.equal(typeof providers.validateReplay, 'function');
});

await check('validate uses only the fixed private S2 validate phase', async () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  const { scope, calls } = harness();
  const result = await providers.validateProviders(scope, command, authority);
  assert.equal(result.decision, 'accepted');
  assert.equal(result.source_reference, null);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].values, ['validate', intent.context_id, intent.workspace_id, id(7),
    intent.service_request_id, 4, intent.reference_id, 7]);
});

await check('authority mismatch denies before SQL', async () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  const { scope, calls } = harness();
  const result = await providers.validateProviders(scope, command,
    { ...authority, authority_version: 12 });
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'SUBJECT_DENIED');
  assert.equal(calls.length, 0);
});

await check('stale phase result maps to bounded provider evidence', async () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  const { scope } = harness({ validate: { ...accepted('validate'), decision: 'denied',
    denial_reason: 'STALE_REQUEST', request_version: null, message_version: null } });
  const result = await providers.validateProviders(scope, command, authority);
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'STALE_SUBJECT');
});

await check('apply returns the S2 link identity and internally derived result version', async () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  const { scope, calls } = harness();
  assert.deepEqual(await providers.mutate(scope, command), { mutation_id: id(9) });
  assert.equal(calls[0].values[0], 'apply');
  assert.equal(calls[0].values.includes(command.transaction_id), false);
  assert.equal(calls[0].values.includes(command.command_id), false);
  assert.equal(calls[0].values.includes(command.idempotency_key), false);
});

await check('exact replay executes the read-only S2 replay phase', async () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  const { scope, calls } = harness();
  const result = await providers.validateReplay(scope, command, authority, receipt());
  assert.equal(result.decision, 'accepted');
  assert.equal(result.read_only, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values[0], 'replay');
});

await check('changed replay state is rejected without mutation', async () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  const { scope } = harness({ replay: { ...accepted('replay'), decision: 'denied',
    denial_reason: 'REPLAY_STATE_CHANGED', mutation_id: null,
    request_version: null, message_version: null } });
  const result = await providers.validateReplay(scope, command, authority, receipt());
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'REPLAY_STATE_CHANGED');
});

await check('mismatched Core binding denies before the S2 finalizer', async () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  const { scope, calls } = harness();
  const result = await providers.validateProviders(scope,
    { ...command, permission_code: 'services.orders.read' }, authority);
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'RELATION_MISMATCH');
  assert.equal(calls.length, 0);
});

await check('S2 migration freezes one private phase-aware signature', () => {
  const sql = readFileSync(new URL(
    '../supabase/migrations/20261018160000_service_request_message_link_finalizer_v2.sql',
    import.meta.url,
  ), 'utf8');
  assert.match(sql, /execute_service_request_message_link_v2/);
  assert.match(sql, /p_mode not in \('validate','apply','replay'\)/);
  assert.match(sql, /v_result_request_version:=p_expected_request_version\+1/);
  assert.match(sql, /resolve_private_message_request_audience_current_v2/);
  assert.match(sql, /from public,anon,authenticated,service_role/);
  assert.doesNotMatch(sql, /p_(transaction_id|command_id|idempotency_key|input_fingerprint)/);
  assert.doesNotMatch(sql, /grant execute|create table platform\.idempotency|create table audit\./i);
});

await check('S2 adds no route, credential or runtime activation', () => {
  const source = readFileSync(new URL(
    '../src/lib/customer/service-request-subject-link-v1.ts', import.meta.url,
  ), 'utf8');
  const sql = readFileSync(new URL(
    '../supabase/migrations/20261018160000_service_request_message_link_finalizer_v2.sql',
    import.meta.url,
  ), 'utf8');
  for (const forbidden of ['src/app', 'customer_api', 'grant execute', 'credential',
    'workspace_modules', 'workspace_entitlements']) {
    assert.equal(`${source}\n${sql}`.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});

console.log(`SERVICE S2 subject-link finalizer contract: ${passed}/${passed} PASS`);
