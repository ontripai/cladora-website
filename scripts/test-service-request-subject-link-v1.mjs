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
      acquired_at: '2026-10-13T17:00:00.000Z' },
  },
  evaluator: 'app_private.check_workspace_native_permission_v2', source_disclosure: 'status_only',
  source_reference: null, evaluated_at: '2026-10-13T17:00:00.001Z',
  rechecked_after_lock: true, transaction_bound: true, reusable_as_command_authority: false,
  current_authority_recheck_required_on_retry: true, decision: 'allowed', denial_reason: null,
};
const messageRow = {
  decision: 'accepted', denial_reason: null, message_id: intent.reference_id,
  message_version: String(intent.source_version), workspace_id: intent.workspace_id,
  lifecycle_state: 'available', participant_current: true, participant_revoked: false,
  evaluated_at: '2026-10-13T17:00:00.002Z',
};
const gateRow = { decision: 'accepted', denial_reason: null,
  current_actor_can_read: true, request_party_audience_only: true,
  evaluated_at: '2026-10-13T17:00:00.003Z' };

function harness({ message = messageRow, gate = gateRow, mutation = id(9), sqlError } = {}) {
  const calls = [];
  const scope = {
    transaction_id: command.transaction_id, database_transaction_id: '99',
    workspace_id: command.workspace_id, tenant_id: id(10), actor_id: command.actor_id, attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      if (sqlError) throw Object.assign(new Error('database failure'), { code: sqlError });
      if (text.includes('resolve_private_message_subject_v1')) {
        return { rows: message ? [structuredClone(message)] : [], rowCount: message ? 1 : 0 };
      }
      if (text.includes('resolve_private_message_request_audience_v1')) {
        return { rows: gate ? [structuredClone(gate)] : [], rowCount: gate ? 1 : 0 };
      }
      if (text.includes('insert_service_request_message_link_v1')) {
        return { rows: mutation ? [{ mutation_id: mutation }] : [], rowCount: mutation ? 1 : 0 };
      }
      throw new Error('unexpected query');
    },
  };
  return { scope, calls };
}

let passed = 0;
async function check(name, run) {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

await check('existing collaboration intent maps to exact Core V2 mutation command', () => {
  assert.equal(command.permission_code, 'services.orders.subject_link');
  assert.equal(command.module_code, 'services_orders');
  assert.equal(command.evaluation_purpose, 'service.request.subject_link');
  assert.equal(command.aggregate_type, 'service_request');
  assert.equal(command.aggregate_id, intent.service_request_id);
  assert.equal(command.aggregate_version, 4);
  assert.deepEqual(command.provider_source_ids, [intent.reference_id]);
  assert.deepEqual(command.subject_reference, {
    kind: 'message', id: intent.reference_id, version: 7,
    relation: 'subject_link', request_version: 7,
  });
  assert.equal(command.input_fingerprint, fingerprintServiceProviderInput(intent));
});

await check('read and request permissions are never substituted for subject-link authority', () => {
  assert.equal(SERVICE_SUBJECT_LINK_CORE_BINDING_V1.permission_code, 'services.orders.subject_link');
  assert.notEqual(SERVICE_SUBJECT_LINK_CORE_BINDING_V1.permission_code, 'services.orders.read');
  assert.notEqual(SERVICE_SUBJECT_LINK_CORE_BINDING_V1.permission_code, 'services.orders.request');
});

await check('CE-owned Communications Request audience provider accepts metadata only', async () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  const { scope, calls } = harness();
  const result = await providers.validateProviders(scope, command, authority);
  assert.equal(result.decision, 'accepted');
  assert.equal(result.provider_code, 'communications.private_message_request_audience');
  assert.equal(result.evaluated_at, gateRow.evaluated_at);
  assert.equal(result.source_reference, null);
  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /communications\.resolve_private_message_subject_v1/);
  assert.match(calls[1].text, /communications\.resolve_private_message_request_audience_v1/);
  assert.equal(JSON.stringify(result).includes('participant'), false);
  assert.equal(JSON.stringify(result).includes('beneficiary'), false);
});

for (const denial_reason of ['AUDIENCE_DENIED']) {
  await check(`${denial_reason} is bounded and produces no mutation`, async () => {
    const providers = createServiceSubjectLinkCoreProvidersV1();
    const { scope, calls } = harness({ gate: { decision: 'denied', denial_reason,
      current_actor_can_read: null, request_party_audience_only: null,
      evaluated_at: gateRow.evaluated_at } });
    const result = await providers.validateProviders(scope, command, authority);
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, 'SUBJECT_DENIED');
    assert.equal(calls.some(call => call.text.includes('insert_service_request_message_link_v1')), false);
  });
}

for (const denial_reason of ['STALE_REQUEST', 'STALE_SUBJECT']) {
  await check(`${denial_reason} maps to bounded stale evidence`, async () => {
    const providers = createServiceSubjectLinkCoreProvidersV1();
    const { scope } = harness({ gate: { decision: 'denied', denial_reason,
      current_actor_can_read: null, request_party_audience_only: null,
      evaluated_at: gateRow.evaluated_at } });
    const result = await providers.validateProviders(scope, command, authority);
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, 'STALE_SUBJECT');
  });
}

await check('mismatched Core binding denies before either provider query', async () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  const { scope, calls } = harness();
  const result = await providers.validateProviders(scope,
    { ...command, permission_code: 'services.orders.read' }, authority);
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'RELATION_MISMATCH');
  assert.equal(calls.length, 0);
});

await check('mutation uses one private callback and returns its domain link identity', async () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  const { scope, calls } = harness();
  const result = await providers.mutate(scope, command);
  assert.deepEqual(result, { mutation_id: id(9) });
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /app_private\.insert_service_request_message_link_v1/);
  assert.deepEqual(calls[0].values, [intent.context_id, intent.workspace_id, id(7),
    intent.service_request_id, 4, intent.reference_id, 7]);
});

await check('database serialization errors reach the Core host retry loop', async () => {
  const providers = createServiceSubjectLinkCoreProvidersV1();
  const { scope } = harness({ sqlError: '40001' });
  await assert.rejects(providers.validateProviders(scope, command, authority),
    error => error.code === '40001');
});

await check('migration keeps one SERVICE link store and reuses Core ledgers', () => {
  const sql = readFileSync(new URL(
    '../supabase/migrations/20261013170242_service_request_subject_link_v1.sql', import.meta.url,
  ), 'utf8');
  assert.match(sql, /create table service_catalog\.request_subject_links/);
  assert.equal((sql.match(/create table/g) ?? []).length, 1);
  for (const parallel of ['create table platform.idempotency', 'create table audit.',
    'create table platform.outbox', 'create table communications.private_messages']) {
    assert.equal(sql.includes(parallel), false);
  }
  assert.match(sql, /services\.orders\.subject_link/);
  assert.match(sql, /platform\.module_permission_bindings/);
  assert.match(sql, /communications\.resolve_private_message_request_audience_v1/);
  assert.doesNotMatch(sql, /identity\.membership_parties|communications\.private_participants/);
  assert.doesNotMatch(sql, /workspace_role_permissions|workspace_member_roles/);
  assert.match(sql, /revoke all[\s\S]*public,anon,authenticated,service_role/);
});

await check('package has no route, grant, notification or runtime activation', () => {
  const source = readFileSync(new URL(
    '../src/lib/customer/service-request-subject-link-v1.ts', import.meta.url,
  ), 'utf8');
  const sql = readFileSync(new URL(
    '../supabase/migrations/20261013170242_service_request_subject_link_v1.sql', import.meta.url,
  ), 'utf8');
  for (const forbidden of ['src/app', 'customer_api', 'grant execute', 'communications.notifications',
    'workspace_modules', 'workspace_entitlements']) {
    assert.equal(`${source}\n${sql}`.includes(forbidden), false, forbidden);
  }
});

console.log(`SERVICE subject-link contract and inactive Core binding: ${passed}/${passed} PASS`);
