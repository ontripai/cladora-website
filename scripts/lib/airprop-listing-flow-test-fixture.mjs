// SYNTHETIC ONLY. Fake transactional receipt storage/authority; no DB, provider or live permission.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), require = createRequire(import.meta.url);
export function loader(mocks = {}) {
  const cache = new Map();
  function load(path) {
    let file = resolve(root, path);
    if (!existsSync(file)) file += existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file); cache.set(file, mod);
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name]
      : name.startsWith('@/') ? load('src/' + name.slice(2))
        : name.startsWith('.') ? load(resolve(dirname(file), name)) : require(name);
    mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, file);
    return mod.exports;
  }
  return load;
}
export const id = n => `${n.toString(16).padStart(8, '0')}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
export const scope = { context_id: id(1), workspace_id: id(2) };
const time = '2026-11-02T09:00:00Z';
export function sourceRow() {
  const authority = { contract_version: 'workspace-native-effective-authority.v2', decision_id: id(15),
    workspace_id: id(2), permission_code: 'airprop.asset.read', module_code: 'airprop_commercial',
    target_scope_type: 'workspace', target_scope_id: id(2), evaluator: 'app_private.check_workspace_native_permission_v2',
    authority_policy_version: 2, source_disclosure: 'status_only', source_reference: null, evaluated_at: time,
    current_authority_recheck_required: true, reusable_as_command_authority: false,
    decision: 'allowed', reason_codes: ['current_effective_permission_allowed'] };
  return { ...scope, tenant_id: id(6), listing_id: id(30), listing_version: 1, property_id: id(8), unit_id: id(9), status: 'published',
    // SYNTHETIC stored binding for focused tests; never native persistence proof.
    selected_binding: { state: 'record', value: { ...scope, tenant_id: id(6), spec_version: 4, selection: {
      listing_id: id(30), listing_version: 1, property_id: id(8), unit_id: id(9), resource_id: id(9), resource_version: 4,
      resource_type: 'unit', party_id: id(7), party_kind: 'person', relationship_id: id(4), relationship_version: 2, relationship_kind: 'ownership',
    } } },
    available_from: '2026-11-02T10:00:00Z', available_until: null,
    core: {
      request: { contract_version: 'core-resource-authority.v1', evaluation_time: time,
        resource: { contract_version: 'canonical-resource-reference.v1', ...scope, resource_type: 'unit', resource_id: id(9), resource_version: 4, permission_code: 'airprop.asset.read', purpose: 'airprop.portfolio.read' },
        relationship: { relationship_id: id(4), relationship_version: 2, relationship_kind: 'ownership', required_scope_codes: ['listing'] },
        authority: { contract_version: authority.contract_version, decision_id: id(15), ...scope, permission_code: authority.permission_code, module_code: authority.module_code,
          target_scope_type: 'workspace', target_scope_id: id(2), evaluation_purpose: 'airprop.portfolio.read' } },
      companion: { item_kind: 'canonical_resource', source: { source_class: 'official_workspace_record', source_reference: 'private-source-marker', source_workspace_id: id(2), source_context_id: id(1) },
        canonical_reference: { contract_version: 'canonical-resource-reference.v1', reference_status: 'verified', tenant_id: id(6), workspace_id: id(2), resource_type: 'unit', resource_id: id(9), resource_version: 4,
          party_kind: null, display_name: 'Apartament sintetic Unirii', lifecycle_status: 'active', evaluated_at: time, action_authorization: 'not_evaluated' },
        relationship: { contract_version: 'resource-relationship.v1', relationship_id: id(4), relationship_version: 2, tenant_id: id(6), workspace_id: id(2), party_id: id(7), party_kind: 'person', resource_type: 'unit', resource_id: id(9),
          relationship_kind: 'ownership', scope_codes: ['listing'], valid_from: '2026-11-02T08:00:00Z', valid_until: '2026-11-03T09:00:00Z', evidence_reference: 'private-evidence-marker', relationship_status: 'effective', evaluated_at: time, action_authorization: 'not_evaluated' } },
      authority,
    } };
}
// The synthetic producer supplies separate manage evidence; read's not_evaluated is never promoted.
export function actionProjection(row, actor, selection, action, allowed = true) {
  const core = structuredClone(row.core);
  core.request.resource.permission_code = core.request.authority.permission_code = core.authority.permission_code = 'airprop.opportunity.manage';
  core.request.resource.purpose = core.request.authority.evaluation_purpose = 'airprop.b2';
  core.authority.decision = allowed ? 'allowed' : 'denied';
  core.authority.reason_codes = [allowed ? 'current_effective_permission_allowed' : 'current_effective_permission_denied'];
  return { actor_id: actor, context_id: row.context_id, workspace_id: row.workspace_id, selection, action, core };
}
export function fixture() {
  const load = loader(), contract = load('src/lib/airprop/listing-flow-contract-v1.ts');
  const { readListingFlow, ListingSourceReadUnavailable } = load('src/lib/airprop/listing-flow-read-v1.ts');
  const { createListingFlowApi } = load('src/lib/airprop/listing-flow-api-v1.ts');
  const state = { row: sourceRow(), actor: id(3), aal: 'aal2', manage: true, readDenied: false, writes: 0, bridgeCalls: 0,
    ledger: new Map(), malformed: false, mode: 'normal' };
  const read = async (actor, selectedScope) => {
    assert.equal(actor, state.actor);
    if (state.readDenied || selectedScope.context_id !== state.row.context_id || selectedScope.workspace_id !== state.row.workspace_id) throw new ListingSourceReadUnavailable('SCOPE_DENIED');
    const row = structuredClone(state.row);
    if (!Object.hasOwn(row, 'action_projections')) {
      const selection = (await readListingFlow(async () => [row], actor, selectedScope))[0].selection;
      row.action_projections = contract.listingActions.map(action => actionProjection(row, actor, selection, action, state.manage));
    }
    return [row];
  };
  const control = async (actor, request) => {
    state.bridgeCalls++;
    if (!state.manage || state.readDenied) return { status: 'denied' };
    let current;
    try { current = (await readListingFlow(read, actor, { context_id: request.command.context_id, workspace_id: request.command.workspace_id }))[0]; } catch { return { status: 'denied' }; }
    const c = request.command, old = state.ledger.get(c.idempotency_key);
    const compare = { ...current.selection, listing_version: request.selection.listing_version };
    if (!contract.sameSelection(compare, request.selection)) return { status: 'conflict' };
    if (old) return old.wire === JSON.stringify(request)
      ? { status: 'receipt', value: { ...old.value, receipt: { ...old.value.receipt, idempotent: true } } } : { status: 'conflict' };
    if (c.expected_version !== state.row.listing_version || state.row.status === 'reserved'
      || (c.action === 'republish_listing' ? state.row.status !== 'withdrawn' : state.row.status !== 'published')) return { status: 'conflict' };
    state.writes++; state.row.listing_version++;
    if (state.row.selected_binding?.state === 'record') state.row.selected_binding.value.selection.listing_version = state.row.listing_version;
    state.row.status = c.action === 'withdraw_listing' ? 'withdrawn' : 'published';
    if (c.action !== 'withdraw_listing') { state.row.available_from = c.available_from; state.row.available_until = c.available_until; }
    const value = { version: 1, ...scope, command_key: c.idempotency_key, selection: request.selection, core_receipt_id: id(100 + state.writes),
      receipt: { version: 1, listing_id: state.row.listing_id, listing_version: state.row.listing_version, status: state.row.status, idempotent: false } };
    state.ledger.set(c.idempotency_key, { wire: JSON.stringify(request), value });
    return { status: 'receipt', value: state.malformed ? { ...value, core_receipt_id: 'invalid' } : value };
  };
  const session = async () => state.actor ? { actor_id: state.actor, aal: state.aal } : null;
  return { state, read, control, session, contract, api: createListingFlowApi({ session, read, control }), createListingFlowApi,
    async command(action = 'edit_listing', key = 'listing-fixture-command-01') {
      const row = (await readListingFlow(read, state.actor, scope))[0];
      return { contract: 'airprop-listing-flow.v1', selection: row.selection, command: { version: 1, ...scope, action, listing_id: row.selection.listing_id,
        expected_version: row.selection.listing_version, idempotency_key: key, reason: 'Synthetic correction',
        ...(action === 'withdraw_listing' ? {} : { available_from: '2026-11-03T10:00:00Z', available_until: null }) } };
    } };
}
