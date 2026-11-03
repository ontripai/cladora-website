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
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url))
    : name.startsWith('@/')
      ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url))
      : require(name),
  loaded, loaded.exports);
  cache.set(url.href, loaded.exports);
  return loaded.exports;
}

const { prepareCreateVersionedServiceOfferingV1, prepareTransitionVersionedServiceOfferingV1 } = load(
  new URL('../src/lib/customer/service-v14-execution/offering-command.ts', import.meta.url));
const { prepareCreateVersionedServiceRequestV1, executeCreateVersionedServiceRequestV1 } = load(
  new URL('../src/lib/customer/service-v14-execution/request-command.ts', import.meta.url));
const { serviceV14ExecutionResponseSchema } = load(
  new URL('../src/lib/customer/service-v14-execution/response-schema.ts', import.meta.url));

const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = '2026-10-26T10:00:00.000Z';
const ids = {
  context: id(1), workspace: id(2), actor: id(3), transaction: id(4), command: id(5),
  offering: id(6), revision: id(7), definition: id(8), provider: id(9), agreement: id(10),
  resource: id(11), request: id(12), beneficiary: id(13), decision: id(14), receipt: id(15),
};
const revision = {
  labels: { ro: 'Curățenie', en: 'Cleaning', fa: 'نظافت' },
  description: { ro: 'Curățenie unitate', en: 'Unit cleaning service', fa: 'خدمت نظافت واحد' },
  acquisition_mode: 'direct',
  price: { kind: 'fixed', amount: '25.00', currency: 'EUR', tax_display: 'included' },
  valid_from: '2026-10-01T00:00:00Z', valid_until: '2027-10-01T00:00:00Z',
  cancellation_terms: { ro: 'Anulare cu o zi înainte', en: 'Cancel one day before', fa: 'لغو یک روز قبل' },
  acceptance_criteria: { ro: 'Confirmare membru', en: 'Member confirmation', fa: 'تأیید عضو' },
  document_version_ids: [],
};
const baseTrusted = {
  actor_id: ids.actor, authority_version: 7,
  transaction_id: ids.transaction, command_id: ids.command,
};
const offeringInput = {
  context_id: ids.context, workspace_id: ids.workspace, definition_id: ids.definition,
  provider_party_id: ids.provider,
  provider_agreement: { agreement_id: ids.agreement, agreement_version: 3 },
  coverage: { kind: 'resources', resources: [{
    resource_id: ids.resource, resource_version: 4, resource_type: 'unit',
  }] },
  eligibility: { policy_version: 1, required_resource_types: ['unit'],
    required_capabilities: [], required_policy_codes: [] },
  revision, idempotency_key: 'service-v14-offer-001',
};

function readers(overrides = {}) {
  return {
    async resolveProviderAgreement(_scope, input) {
      return {
        contract_version: 'provider-agreement-verification.v1', agreement_status: 'effective',
        tenant_id: id(90), workspace_id: input.workspace_id, provider_party_id: ids.provider,
        provider_agreement_id: input.provider_agreement_id,
        provider_agreement_version: input.provider_agreement_version,
        valid_from: '2026-01-01', valid_until: null,
        allowed_service_scope: input.requested_service_scope,
        evaluated_at: now, action_authorization: 'not_evaluated',
      };
    },
    async resolveCanonicalResource(_scope, input) {
      return {
        contract_version: 'canonical-resource-reference.v1', reference_status: 'verified',
        tenant_id: id(90), workspace_id: input.workspace_id,
        resource_type: input.resource_type, resource_id: input.resource_id,
        resource_version: input.resource_version, party_kind: null,
        display_name: 'Unit 4', lifecycle_status: 'active', evaluated_at: now,
        action_authorization: 'not_evaluated',
      };
    },
    ...overrides,
  };
}

function authority(command) {
  return {
    contract_version: 'core-current-authority-decision-receipt.v1', receipt_version: 1,
    decision_id: ids.decision, context_id: command.context_id, workspace_id: command.workspace_id,
    actor_id: command.actor_id, authority_version: command.authority_version,
    permission_code: command.permission_code, module_code: command.module_code,
    evaluation_purpose: command.evaluation_purpose,
    transaction_context: {
      transaction_id: command.transaction_id, command_id: command.command_id, attempt: 1,
      isolation_level: 'serializable', lock: { kind: 'command_aggregate',
        workspace_id: command.workspace_id, aggregate_type: command.aggregate_type,
        aggregate_id: command.aggregate_id, acquired_at: '2026-10-26T09:59:59.000Z' },
    },
    evaluator: 'app_private.check_workspace_native_permission_v2', source_disclosure: 'status_only',
    source_reference: null, evaluated_at: now, rechecked_after_lock: true,
    transaction_bound: true, reusable_as_command_authority: false,
    current_authority_recheck_required_on_retry: true, decision: 'allowed', denial_reason: null,
  };
}

function scope(sourceOverrides = {}) {
  const calls = [];
  const source = {
    workspace_id: ids.workspace, offering_id: ids.offering, revision_id: ids.revision,
    offering_version: 2, revision_version: 1, provider_party_id: ids.provider,
    provider_agreement_id: ids.agreement, provider_agreement_version: 3,
    status: 'published', offering_available: true, coverage_kind: 'resources',
    coverage: { kind: 'resources', resources: [{
      resource_id: ids.resource, resource_version: 4, resource_type: 'unit',
    }] },
    required_resource_types: ['unit'],
    requires_capability_policy_resolution: false, ...sourceOverrides,
  };
  return {
    calls,
    value: {
      transaction_id: ids.transaction, database_transaction_id: '901',
      workspace_id: ids.workspace, tenant_id: id(90), actor_id: ids.actor, attempt: 1,
      async query(text, values) {
        calls.push({ text, values });
        if(text.includes('pg_catalog.to_jsonb(pg_catalog.clock_timestamp())'))return{rows:[{database_transaction_id:'901',actor_id:ids.actor,workspace_id:ids.workspace,evaluated_at:'2026-10-26T10:00:00.000123+00:00'}],rowCount:1};
        if (text.includes('resolve_service_v14_execution_source_v1')) {
          return { rows: [{ source }], rowCount: 1 };
        }
        if (text.includes('apply_service_v14_execution_v1')) {
          return { rows: [{ mutation_id: ids.request }], rowCount: 1 };
        }
        throw new Error(`unexpected query: ${text}`);
      },
    },
  };
}

let passed = 0;
async function check(name, fn) {
  if(process.argv.includes('--clock-only')&&!['provider agreement and canonical resource accept only exact current bindings','changed replay current state is rejected','provider and replay evidence use the exact same-scope server clock'].includes(name))return;
  await fn();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

await check('create Offering pins revision, terms, provider agreement, coverage and eligibility', async () => {
  const dispatch = prepareCreateVersionedServiceOfferingV1({
    ...baseTrusted, offering_id: ids.offering, revision_id: ids.revision, input: offeringInput,
  }, readers());
  assert.equal(dispatch.command.contract_version, 'core-transaction-command.v2');
  assert.equal(dispatch.command.aggregate_version, 1);
  assert.equal(dispatch.command.subject_reference.id, ids.offering);
  assert.equal(dispatch.command.permission_code, 'services.catalog.manage');
  assert.match(dispatch.command.input_fingerprint, /^sha256:[a-f0-9]{64}$/);
});

await check('publish requires separate publish authority and exact versions', async () => {
  const dispatch = prepareTransitionVersionedServiceOfferingV1({
    ...baseTrusted, context_id: ids.context, workspace_id: ids.workspace,
    offering_id: ids.offering, revision_id: ids.revision,
    expected_offering_version: 2, expected_revision_version: 1,
    provider_party_id: ids.provider,
    provider_agreement: { agreement_id: ids.agreement, agreement_version: 3 },
    action: 'publish', reason: 'Reviewed by a separate publisher',
    idempotency_key: 'service-v14-publish-001',
  }, readers());
  assert.equal(dispatch.command.permission_code, 'services.catalog.publish');
  assert.equal(dispatch.command.aggregate_version, 3);
});

function requestDispatch(readerOverrides = {}) {
  return prepareCreateVersionedServiceRequestV1({
    ...baseTrusted, request_id: ids.request, expected_offering_version: 2,
    published_revision_version: 1, provider_party_id: ids.provider,
    input: {
      context_id: ids.context, workspace_id: ids.workspace, offering_id: ids.offering,
      published_revision_id: ids.revision,
      provider_agreement: { agreement_id: ids.agreement, agreement_version: 3 },
      resource: { resource_id: ids.resource, resource_version: 4, resource_type: 'unit' },
      beneficiary_party_id: ids.beneficiary, description: 'Clean the selected member unit',
      idempotency_key: 'service-v14-request-001',
    },
  }, readers(readerOverrides));
}

await check('Request command pins Offering/revision/resource and does not create an Order', async () => {
  const dispatch = requestDispatch();
  assert.equal(dispatch.command.aggregate_type, 'service_request');
  assert.equal(dispatch.command.aggregate_version, 1);
  assert.equal(dispatch.command.subject_reference.id, ids.revision);
  assert.deepEqual(dispatch.command.provider_source_ids,
    [ids.revision, ids.agreement, ids.resource].sort());
  assert.notEqual(dispatch.command.aggregate_type, 'service_order');
  assert.equal(Object.hasOwn(dispatch.command, 'order_id'), false);
});

function requestValue(overrides = {}) {
  return {
    ...baseTrusted, request_id: ids.request, expected_offering_version: 2,
    published_revision_version: 1, provider_party_id: ids.provider,
    input: {
      context_id: ids.context, workspace_id: ids.workspace, offering_id: ids.offering,
      published_revision_id: ids.revision,
      provider_agreement: { agreement_id: ids.agreement, agreement_version: 3 },
      resource: { resource_id: ids.resource, resource_version: 4, resource_type: 'unit' },
      beneficiary_party_id: ids.beneficiary, description: 'Clean the selected member unit',
      idempotency_key: 'service-v14-request-001',
    },
    ...overrides,
  };
}

await check('entry dispatches exact key/body through the Core host and requires its receipt', async () => {
  const harness = scope();
  let observed;
  const host = {
    async execute(command, providers) {
      observed = structuredClone(command);
      const boundAuthority = authority(command);
      const evidence = await providers.validateProviders(harness.value, command, boundAuthority);
      assert.equal(evidence.decision, 'accepted');
      const mutation = await providers.mutate(harness.value, command);
      return { status: 'committed', receipt: {
        contract_version: 'core-transaction-receipt.v2', receipt_version: 2,
        receipt_id: ids.receipt, transaction_id: command.transaction_id,
        command_id: command.command_id, workspace_id: command.workspace_id,
        actor_id: command.actor_id, aggregate_type: command.aggregate_type,
        aggregate_id: command.aggregate_id, aggregate_version: command.aggregate_version,
        input_fingerprint: command.input_fingerprint, idempotency_key: command.idempotency_key,
        replay_validation: { contract_version: 'core-transaction-replay-provider-requirement.v1',
          provider_code: 'service_v14_execution' },
        authority: boundAuthority, mutation_id: mutation.mutation_id,
        audit_event_id: '41', outbox_event_id: id(41),
        subject_reference: command.subject_reference, provider_evidence: evidence,
        committed_at: '2026-10-26T10:00:01.000Z',
      } };
    },
  };
  const result = await executeCreateVersionedServiceRequestV1(host, requestValue(), readers());
  assert.equal(result.status, 'committed');
  assert.equal(observed.idempotency_key, 'service-v14-request-001');
  assert.equal(observed.input_fingerprint,
    requestDispatch().command.input_fingerprint);
  assert.equal(harness.calls.filter(call => call.text.includes('apply_service')).length, 1);
});

await check('same key with changed body produces a different fingerprint', async () => {
  const first = requestDispatch().command;
  const second = prepareCreateVersionedServiceRequestV1(requestValue({
    input: { ...requestValue().input, description: 'Clean a different selected unit' },
  }), readers()).command;
  assert.equal(first.idempotency_key, second.idempotency_key);
  assert.notEqual(first.input_fingerprint, second.input_fingerprint);
});

await check('revoked actor denial creates no provider or mutation call', async () => {
  let providerCalled = false;
  const host = { async execute() {
    return { status: 'denied', code: 'AUTHORITY_DENIED' };
  } };
  const rejectingReaders = readers({
    async resolveProviderAgreement() { providerCalled = true; throw new Error('must not run'); },
  });
  const result = await executeCreateVersionedServiceRequestV1(host, requestValue(), rejectingReaders);
  assert.equal(result.status, 'denied');
  assert.equal(result.code, 'AUTHORITY_DENIED');
  assert.equal(providerCalled, false);
});

await check('rollback failure remains denied and never becomes success', async () => {
  const host = { async execute() {
    return { status: 'denied', code: 'TRANSACTION_FAILED' };
  } };
  const result = await executeCreateVersionedServiceRequestV1(host, requestValue(), readers());
  assert.deepEqual(result, { status: 'denied', code: 'TRANSACTION_FAILED' });
});

await check('provider agreement and canonical resource accept only exact current bindings', async () => {
  const dispatch = requestDispatch();
  const harness = scope();
  const evidence = await dispatch.providers.validateProviders(
    harness.value, dispatch.command, authority(dispatch.command));
  assert.equal(evidence.decision, 'accepted');
  assert.equal(evidence.source_disclosure, 'status_only');
  assert.equal(evidence.source_reference, null);
});

for (const [name, override, reason] of [
  ['expired agreement', { agreement_status: 'expired' }, 'SUBJECT_DENIED'],
  ['revoked agreement', { agreement_status: 'revoked' }, 'SUBJECT_DENIED'],
  ['stale agreement version', { provider_agreement_version: 2 }, 'STALE_SUBJECT'],
  ['cross-workspace agreement', { workspace_id: id(99) }, 'RELATION_MISMATCH'],
]) {
  await check(`${name} is bounded and denied before mutation`, async () => {
    const dispatch = requestDispatch({
      async resolveProviderAgreement(_scope, input) {
        return { contract_version: 'provider-agreement-verification.v1',
          agreement_status: override.agreement_status ?? 'effective', tenant_id: id(90),
          workspace_id: override.workspace_id ?? input.workspace_id, provider_party_id: ids.provider,
          provider_agreement_id: ids.agreement,
          provider_agreement_version: override.provider_agreement_version ?? 3,
          valid_from: '2026-01-01', valid_until: null,
          allowed_service_scope: input.requested_service_scope,
          evaluated_at: now, action_authorization: 'not_evaluated' };
      },
    });
    const harness = scope();
    const evidence = await dispatch.providers.validateProviders(
      harness.value, dispatch.command, authority(dispatch.command));
    assert.equal(evidence.decision, 'denied');
    assert.equal(evidence.denial_reason, reason);
    assert.equal(harness.calls.some(call => call.text.includes('apply_service')), false);
  });
}

await check('stale Offering revision is denied', async () => {
  const dispatch = requestDispatch();
  const harness = scope({ revision_version: 2 });
  const evidence = await dispatch.providers.validateProviders(
    harness.value, dispatch.command, authority(dispatch.command));
  assert.equal(evidence.decision, 'denied');
  assert.equal(evidence.denial_reason, 'STALE_SUBJECT');
});

await check('unpublished Offering is denied', async () => {
  const dispatch = requestDispatch();
  const harness = scope({ status: 'suspended' });
  const evidence = await dispatch.providers.validateProviders(
    harness.value, dispatch.command, authority(dispatch.command));
  assert.equal(evidence.decision, 'denied');
  assert.equal(evidence.denial_reason, 'SUBJECT_DENIED');
});

await check('expired Offering is denied without mutation', async () => {
  const dispatch = requestDispatch();
  const harness = scope({ offering_available: false });
  const evidence = await dispatch.providers.validateProviders(
    harness.value, dispatch.command, authority(dispatch.command));
  assert.equal(evidence.decision, 'denied');
  assert.equal(evidence.denial_reason, 'SUBJECT_DENIED');
  assert.equal(harness.calls.some(call => call.text.includes('apply_service')), false);
});

await check('resource outside pinned coverage is denied before mutation', async () => {
  const dispatch = requestDispatch();
  const harness = scope({ coverage: { kind: 'resources', resources: [{
    resource_id: id(88), resource_version: 1, resource_type: 'unit',
  }] } });
  const evidence = await dispatch.providers.validateProviders(
    harness.value, dispatch.command, authority(dispatch.command));
  assert.equal(evidence.decision, 'denied');
  assert.equal(evidence.denial_reason, 'SUBJECT_DENIED');
  assert.equal(harness.calls.some(call => call.text.includes('apply_service')), false);
});

await check('geography closes only the geography path as not ready', async () => {
  const dispatch = requestDispatch();
  const harness = scope({ coverage_kind: 'geographic' });
  const evidence = await dispatch.providers.validateProviders(
    harness.value, dispatch.command, authority(dispatch.command));
  assert.equal(evidence.decision, 'denied');
  assert.equal(evidence.denial_reason, 'PROVIDER_UNAVAILABLE');
});

await check('ordinary Workspace request needs neither PF nor valuation evidence', async () => {
  const dispatch = prepareCreateVersionedServiceRequestV1(requestValue({
    input: { ...requestValue().input, resource: null },
  }), readers());
  const harness = scope({ coverage_kind: 'workspace', coverage: { kind: 'workspace' },
    required_resource_types: [] });
  const evidence = await dispatch.providers.validateProviders(
    harness.value, dispatch.command, authority(dispatch.command));
  assert.equal(evidence.decision, 'accepted');
  assert.equal(dispatch.command.provider_source_ids.includes(ids.resource), false);
});

await check('unproved capability/policy source is not treated as authority', async () => {
  const dispatch = requestDispatch();
  const harness = scope({ requires_capability_policy_resolution: true });
  const evidence = await dispatch.providers.validateProviders(
    harness.value, dispatch.command, authority(dispatch.command));
  assert.equal(evidence.decision, 'denied');
  assert.equal(evidence.denial_reason, 'PROVIDER_UNAVAILABLE');
});

await check('malformed canonical resource receipt fails closed', async () => {
  const dispatch = requestDispatch({ async resolveCanonicalResource() { return { ok: true }; } });
  const harness = scope();
  const evidence = await dispatch.providers.validateProviders(
    harness.value, dispatch.command, authority(dispatch.command));
  assert.equal(evidence.decision, 'denied');
  assert.equal(evidence.denial_reason, 'PROVIDER_UNAVAILABLE');
});

await check('mutation uses the private mapper only after provider acceptance', async () => {
  const dispatch = requestDispatch();
  const harness = scope();
  const mutation = await dispatch.providers.mutate(harness.value, dispatch.command);
  assert.equal(mutation.mutation_id, ids.request);
  assert.equal(harness.calls.at(-1).text.includes('apply_service_v14_execution_v1'), true);
});

await check('provider and replay evidence use the exact same-scope server clock',async()=>{
 const dispatch=requestDispatch(),harness=scope(),expected='2026-10-26T10:00:00.000123+00:00';
 const evidence=await dispatch.providers.validateProviders(harness.value,dispatch.command,authority(dispatch.command));
 assert.equal(evidence.evaluated_at,expected);
 const replay=await dispatch.providers.validateReplay(harness.value,dispatch.command,authority(dispatch.command),{receipt_id:ids.receipt,contract_version:'core-transaction-receipt.v2'});
 assert.equal(replay.evaluated_at,expected);assert.equal(harness.calls.filter(x=>x.text.includes('pg_catalog.to_jsonb(pg_catalog.clock_timestamp())')).length,2);
});

await check('changed replay current state is rejected', async () => {
  const dispatch = requestDispatch({
    async resolveProviderAgreement(_scope, input) {
      return { contract_version: 'provider-agreement-verification.v1', agreement_status: 'revoked',
        tenant_id: id(90), workspace_id: input.workspace_id, provider_party_id: ids.provider,
        provider_agreement_id: ids.agreement, provider_agreement_version: 3,
        valid_from: '2026-01-01', valid_until: null, allowed_service_scope: input.requested_service_scope,
        evaluated_at: now, action_authorization: 'not_evaluated' };
    },
  });
  const harness = scope();
  const receipt = {
    receipt_id: ids.receipt, contract_version: 'core-transaction-receipt.v2',
  };
  const replay = await dispatch.providers.validateReplay(
    harness.value, dispatch.command, authority(dispatch.command), receipt);
  assert.equal(replay.decision, 'denied');
  assert.equal(replay.denial_reason, 'REPLAY_STATE_CHANGED');
});

await check('unknown commit stays READBACK_REQUIRED and is not success', async () => {
  assert.equal(serviceV14ExecutionResponseSchema.parse({
    status: 'unknown_commit', code: 'READBACK_REQUIRED',
  }).status, 'unknown_commit');
  assert.equal(serviceV14ExecutionResponseSchema.safeParse({
    status: 'committed', code: 'READBACK_REQUIRED',
  }).success, false);
});

await check('SQL mapper has zero public runtime grant and no parallel ledgers', async () => {
  const sql = readFileSync(new URL('../supabase/hosted-service-v14-execution/forward.sql', import.meta.url), 'utf8');
  assert.match(sql, /revoke all on function[\s\S]+from public,anon,authenticated,service_role;/);
  assert.doesNotMatch(sql, /grant\s+execute/i);
  assert.doesNotMatch(sql, /insert\s+into\s+(audit\.events|platform\.outbox_events|platform\.idempotency_keys)/i);
  assert.match(sql, /for update/);
  assert.match(sql, /This second canonical call is intentionally after every domain lock\/wait/);
});

await check('legacy provider receipt types and condition evidence are not redefined', async () => {
  const paths = [
    '../src/lib/customer/service-v14-execution/offering-command.ts',
    '../src/lib/customer/service-v14-execution/request-command.ts',
    '../src/lib/customer/service-v14-execution/provider-binding.ts',
  ];
  const text = paths.map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(text, /serviceConditionEvidenceV1Schema\s*=/);
  assert.doesNotMatch(text, /providerAgreementVerificationV1Schema\s*=\s*z\./);
  assert.match(text, /resource-contracts-v1/);
});

process.stdout.write(`SERVICE V14 EXECUTION ${passed}/${passed} PASS\n`);
