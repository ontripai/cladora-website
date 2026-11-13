// AIRPROP-only offline packet tooling. Never connects, executes SQL or grants authority.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
export const BASE = '6cd4a6a593058da57d0884a13579f6e62cc02afc';
export const INPUTS = Object.freeze({
  'supabase/proposals/airprop_listing_selected_bindings_v1.sql': '124fc20a2dfb63d7da13290a1e1aaefc49655287d0e490c82d3dda85ab1640c1',
  'src/lib/airprop/listing-selected-binding-v1.ts': 'd10f1dcbfb0b4169a1e00465f7125c7534c4a75216e965e6189ac03b4f29d665',
  'src/lib/airprop/listing-publication-v1.ts': '905e2fdfeaf64c8a2fc123ff9b1e4018402ed8bee77195b5c3a5677a0d35d81a',
  'src/lib/airprop/listing-control-plan-v1.ts': '0a4c336cbf40161de4683c310eb547501dec7164e8bf66d96e8a3b2fad84d1f0',
  'src/lib/core/listing-command-binding-v1.ts': 'cc89f17fb7b9f2fb20a5c384a9c3ab204040f683541a3a09aac13d85f1a34b6e',
  'src/lib/core/current-unit-property-read-selector-v1.ts': '6be30696e2f75d94d62b105911f4e8df977383487baf8fe37bcfc8a574667844',
  'src/lib/core/functional-command-runtime-v1.ts': 'ec5ada6a57427d06dea947da621d0039f51078c8aaeca358349195b5b015f9c0',
});
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const contractPath = 'docs/airprop/listing-binding-adoption-v1/contract.json';
export const TABLE = 'airprop.listing_selected_bindings_v1';
const guards = ['guard_listing_selected_binding_v1', 'assert_listing_selected_binding_c03_v1'];
export const RELATIONS = [TABLE, 'airprop.market_listings', 'portfolio.unit_specification_versions',
  'portfolio.parties', 'platform.idempotency_keys', 'audit.events', 'platform.outbox_events'];
export const FUNCTIONS = guards.map(name => `airprop.${name}()`).concat([
  'customer_api.publish_airprop_listing_v1(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text)',
  'customer_api.control_airprop_listing_v1(uuid,uuid,uuid,text,integer,timestamptz,timestamptz,text,text)',
  'app_private.active_context_id()', 'app_private.active_tenant_id()', 'auth.uid()']);
export function makeContract(read = path => readFileSync(resolve(root, path))) {
  const inventory = Object.entries(INPUTS).map(([path, hash]) => {
    const bytes = read(path); if (sha256(bytes) !== hash) throw Error(`SOURCE_PIN:${path}`);
    return { path, bytes: bytes.length, sha256: hash };
  });
  const ddl = read(inventory[0].path).toString('utf8');
  const functions = guards.map(name => {
    const start = ddl.indexOf(`create function airprop.${name}()`), begin = ddl.indexOf('as $$', start) + 5;
    const end = ddl.indexOf('$$;', begin);
    if (start < 0 || begin < 5 || end < 0) throw Error('SOURCE_FUNCTION_BOUNDARY');
    return { signature: `airprop.${name}()`, body_sha256: sha256(ddl.slice(begin, end)),
      kind: 'f', result: 'trigger', security_definer: false, config: ['search_path=pg_catalog'] };
  });
  return {
    contract: 'airprop-listing-binding-adoption.v1', base: BASE, inventory,
    authority: 'SOURCE_ONLY_NOT_INSTALL_OR_ACTIVATION_AUTHORITY', activation: null,
    table: TABLE, owner: null, compiled_catalog: null, policy_adoption: null,
    functions, columns: [
      ['tenant_id', 'uuid', ''], ['workspace_id', 'uuid', ''], ['context_id', 'uuid', ''],
      ['listing_id', 'uuid', ''], ['listing_version', 'integer', ''], ['binding', 'jsonb', ''],
      ['unit_id', 'uuid', 's'], ['party_id', 'uuid', 's'], ['spec_id', 'uuid', 's'], ['spec_version', 'integer', 's'],
    ].map(([name, type, generated]) => ({ name, type, generated, not_null: true, identity: '' })),
    foreign_keys: [
      { source_columns: ['listing_id', 'tenant_id', 'workspace_id'], target: 'airprop.market_listings', target_columns: ['id', 'tenant_id', 'workspace_id'] },
      { source_columns: ['spec_id'], target: 'portfolio.unit_specification_versions', target_columns: ['id'] },
      { source_columns: ['party_id'], target: 'portfolio.parties', target_columns: ['id'] },
      { source_columns: ['unit_id', 'spec_version'], target: 'portfolio.unit_specification_versions', target_columns: ['unit_id', 'version'] },
    ].map(fk => ({ ...fk, delete_action: 'r', update_action: 'a', match_type: 's', validated: true, deferrable: false, initially_deferred: false })),
    primary_key: ['listing_id', 'listing_version'], check_count: 7,
    indexes: ['listing_selected_bindings_v1_pkey', 'listing_selected_binding_command_v1', 'listing_selected_binding_command_id_v1'],
    triggers: [
      { name: 'listing_selected_binding_immutable_v1', function: 'airprop.guard_listing_selected_binding_v1()', type: 29, deferrable: false, initially_deferred: false },
      { name: 'listing_selected_binding_no_truncate_v1', function: 'airprop.guard_listing_selected_binding_v1()', type: 34, deferrable: false, initially_deferred: false },
      { name: 'listing_selected_binding_c03_v1', function: 'airprop.assert_listing_selected_binding_c03_v1()', type: 5, deferrable: true, initially_deferred: true },
    ],
    policy_projection: [], rls: true, force_rls: true,
    projection_sql: 'supabase/proposals/airprop-listing-binding-adoption-v1/observe.sql',
    adoption: { ddl: inventory[0].path, guard: 'AIRPROP_LISTING_SELECTED_BINDING_ADOPTION_REQUIRED/55000',
      edits_to_guard: false, new_roles_grants_policies: false, historical_backfill: false,
      missing: ['PLATFORM_PRIVATE_TARGET_OWNER_AND_ROLE_CUSTODY', 'COMPILED_EXACT_CATALOG_SUCCESSOR',
        'LIMITED_ROLE_RLS_POLICY_AND_PRIVILEGE_ADOPTION', 'CORE_SELECTED_BINDING_READ_SQL_ADMISSION',
        'CORE_COMPLETE_VERSIONED_COMPANION_AND_POST_WAIT_CURRENTNESS', 'ORIGINAL_MAPPING_REPLAY_PRODUCER'] },
    action_mapping: [
      { action: 'publish_listing', source: 'src/lib/airprop/listing-publication-v1.ts', native: FUNCTIONS[2], native_action: null, first_listing_version: 1 },
      ...[['edit_listing','edit'],['withdraw_listing','withdraw'],['republish_listing','republish']].map(([action,native_action]) =>
        ({ action, source: 'src/lib/airprop/listing-control-plan-v1.ts', native: FUNCTIONS[3], native_action, expected_version: 'original', next_version: 'original+1' })),
    ],
    c03: { aggregate_type: 'portfolio.unit', aggregate_id: 'original selected.unit_id',
      provider_source_ids: ['unit_id','property_id','party_id','relationship_id','spec_id'],
      permission: 'airprop.opportunity.manage', module: 'airprop_commercial', purpose: 'airprop.b2',
      fingerprint: 'sha256:SHA256(original UTF8 wire)', receipt_owner: 'existing Core transaction host',
      mutate_result: 'mutation_id only; not receipt', replay_policy: 'provider_current_state_required',
      read_uses_command_receipt: false, session_storage_is_authority: false },
  };
}
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const object = z.record(z.string(), z.unknown());
const identity = z.strictObject({ database_name: z.string().min(1), database_oid: z.string().regex(/^[0-9]+$/),
  server_version_num: z.string().regex(/^[0-9]+$/), executor: z.string().min(1), session: z.string().min(1) });
const observationSchema = z.strictObject({ contract: z.literal('airprop-listing-binding-catalog.v1'), identity,
  observation: z.strictObject({ pid: z.number().int().positive(), at: z.string().min(1) }), overflow: z.literal(false),
  relations: z.array(z.strictObject({ name: z.string(), present: z.boolean(), catalog: object.nullable() })).length(7),
  functions: z.array(z.strictObject({ signature: z.string(), present: z.boolean(), catalog: object.nullable() })).length(7),
  roles: z.array(object).min(1).max(256), memberships: z.array(object).max(1024), default_acl: z.array(object).max(128), event_triggers: z.array(object).max(128), overloads: z.array(z.string()).max(32) });
const stable = x => JSON.stringify(x, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b))) : value);
const same = (a,b) => stable(a) === stable(b);
function project(value) {
  const p = observationSchema.parse(value);
  if (!same(p.relations.map(r => r.name).sort(), [...RELATIONS].sort())
    || !same(p.functions.map(f => f.signature).sort(), [...FUNCTIONS].sort())) throw Error('OBSERVATION_COVERAGE');
  for (const r of [...p.relations, ...p.functions]) if (r.present !== (r.catalog !== null)) throw Error('OBSERVATION_PRESENCE');
  return p;
}
const stop = reason => ({ status: 'BLOCKED', reason, activation: null, business_unknown: 'UNCHANGED', next_sql: null });
/** Source/custody comparison only. Caller-supplied metadata cannot confer authority.
 * A transport-bound Platform observation + independent catalog acceptance is still
 * required. This module has no DB client or install/command dispatch API. */
export function assessProjection(value, expectedIdentity, owner, compiled = null, phase = 'preflight') {
  let p; try { p = project(value); identity.parse(expectedIdentity); } catch { return stop('OBSERVATION_INVALID'); }
  if (!same(p.identity, expectedIdentity)) return stop('TARGET_IDENTITY_MISMATCH');
  if (!['preflight','verify','recovery'].includes(phase)) return stop('PHASE_INVALID');
  if (!owner || !/^[a-z_][a-z0-9_]{0,62}$/.test(owner)) return stop('OWNER_UNBOUND');
  const contract = makeContract(), table = p.relations.find(r => r.name === TABLE);
  const missing = p.relations.filter(r => r.name !== TABLE && !r.present).map(r => r.name)
    .concat(p.functions.filter(f => !f.signature.startsWith('airprop.') && !f.present).map(f => f.signature));
  if (missing.length) return { ...stop('DEPENDENCY_NOT_READY'), missing };
  const functions = p.functions.filter(f => f.signature.startsWith('airprop.'));
  const expectedOverloads = [
    ...functions.filter(f=>f.present).map(f=>f.signature),
    ...p.functions.filter(f=>f.signature.startsWith('customer_api.') && f.present).map(f=>f.signature),
  ];
  // regprocedure renders timestamptz as its canonical SQL type name.
  const canonicalSignature = value => value.replaceAll('timestamptz','timestamp with time zone');
  if (!same(p.overloads.map(canonicalSignature).sort(),expectedOverloads.map(canonicalSignature).sort())) return stop('OVERLOAD_DRIFT');
  if (!table.present && functions.every(f => !f.present)) return {
    ...stop(phase === 'preflight' ? 'ABSENT_INSTALL_REVIEW_REQUIRED' : 'ABSENT_NOT_INSTALLED'), catalog_presence: 'absent' };
  if (!table.present || functions.some(f => !f.present)) return stop('PARTIAL_INSTALL_OR_DRIFT');
  const t = table.catalog;
  const required = ['oid','owner','kind','persistence','rls','force_rls','schema','columns','constraints','indexes','triggers','policies','rules','acl','effective'];
  if (!same(Object.keys(t).sort(), required.sort()) || required.filter(k => ['columns','constraints','indexes','triggers','policies','rules','effective'].includes(k)).some(k => !Array.isArray(t[k]))) return stop('CATALOG_INCOMPLETE');
  if (t.owner !== owner) return stop('OWNER_DRIFT');
  const role = p.roles.find(r => r.rolname === owner);
  if (!role || role.rolsuper !== false || role.rolbypassrls !== false) return stop('OWNER_CUSTODY_NOT_ADMITTED');
  if (t.kind !== 'r' || t.persistence !== 'p' || t.schema !== 'airprop' || t.rls !== true || t.force_rls !== true) return stop('TABLE_SECURITY_DRIFT');
  if (!same(t.columns.map(c => ({ name:c.name,type:c.type,generated:c.generated,not_null:c.not_null,identity:c.identity })),contract.columns)
    || t.columns.some(c => c.acl != null || (c.generated ? typeof c.expression !== 'string' : c.expression !== null))) return stop('COLUMN_DRIFT');
  const fks = t.constraints.filter(c => c.type === 'f').map(c => Object.fromEntries(Object.keys(contract.foreign_keys[0]).map(k => [k,c[k]])));
  if (!same(fks.map(stable).sort(),contract.foreign_keys.map(stable).sort())) return stop('FK_DRIFT');
  const pk = t.constraints.filter(c => c.type === 'p'), checks = t.constraints.filter(c => c.type === 'c');
  if (pk.length !== 1 || !same(pk[0].source_columns,contract.primary_key) || checks.length !== contract.check_count
    || t.constraints.length !== 12 || t.constraints.some(c => c.validated !== true)) return stop('CONSTRAINT_DRIFT');
  if (!same(t.indexes.map(i => i.name).sort(),contract.indexes.slice().sort())
    || t.indexes.some(i => !i.valid || !i.ready || !i.unique)) return stop('INDEX_DRIFT');
  const triggers = t.triggers.filter(x => !x.internal);
  if (triggers.length !== 3 || triggers.some(tr => tr.enabled !== 'O')
    || !same(triggers.map(tr => Object.fromEntries(Object.keys(contract.triggers[0]).map(k => [k,tr[k]]))).map(stable).sort(),contract.triggers.map(stable).sort())) return stop('TRIGGER_DRIFT');
  if (t.policies.length || t.rules.length) return stop('POLICY_OR_RULE_DRIFT');
  if (p.roles.some(r => !t.effective.some(e => e.role === r.rolname))) return stop('EFFECTIVE_ACL_INCOMPLETE');
  for (const e of t.effective) {
    const r = p.roles.find(r => r.rolname === e.role);
    if (!r) return stop('EFFECTIVE_ACL_INCOMPLETE');
    if (e.role !== owner && !r.rolsuper && !r.rolbypassrls
      && ['select','insert','update','delete','truncate','references','trigger'].some(k => e[k] !== false)) return stop('ACL_EXPANSION');
  }
  for (const f of functions) {
    const want = contract.functions.find(w => w.signature === f.signature), c = f.catalog;
    if (!c || c.owner !== owner || c.kind !== want.kind || c.result !== want.result || c.security_definer !== false
      || !same(c.config,want.config) || c.body_sha256 !== want.body_sha256) return stop('FUNCTION_DRIFT');
    if (!hash.safeParse(c.catalog_sha256).success || !Array.isArray(c.effective)
      || p.roles.some(r => !c.effective.some(e => e.role === r.rolname))) return stop('FUNCTION_CATALOG_INCOMPLETE');
    if (c.effective.some(e => { const r=p.roles.find(r => r.rolname===e.role); return !r || (e.role!==owner && !r.rolsuper && !r.rolbypassrls && e.execute!==false); })) return stop('FUNCTION_ACL_EXPANSION');
  }
  if (compiled === null) return { ...stop('COMPILED_CATALOG_UNOBSERVED'), source_shape: 'KNOWN_STRUCTURE_MATCH', runtime_access: 'NOT_ADOPTED' };
  let accepted; try { accepted = project(compiled); } catch { return stop('COMPILED_CATALOG_INVALID'); }
  if (!same({ ...p, observation: null },{ ...accepted, observation: null })) return stop('COMPILED_CATALOG_DRIFT');
  return { status: 'CATALOG_MATCH_NOT_ACTIVATED', source_shape: 'KNOWN_STRUCTURE_MATCH', runtime_access: 'NOT_ADOPTED', activation: null,
    business_unknown: 'UNCHANGED', next_sql: null };
}
/** Unknown INSTALL settlement only; never settles a business command from catalog. */
export function recoverProjection(before, after, expectedIdentity, owner, compiled = null, transportSettlement = 'unknown') {
  let a,b; try { a=project(before); b=project(after); } catch { return stop('RECOVERY_OBSERVATION_INVALID'); }
  if (!same(a.identity,expectedIdentity) || !same(b.identity,expectedIdentity)) return stop('TARGET_IDENTITY_MISMATCH');
  const compared = assessProjection(b,expectedIdentity,owner,compiled,'recovery');
  if (compared.status === 'CATALOG_MATCH_NOT_ACTIVATED') return { ...compared, settlement: transportSettlement === 'commit_ack' ? 'ACK_REQUIRES_INDEPENDENT_VERIFY' : 'UNKNOWN', repeat_install: false };
  if (!same({ ...a, observation:null },{ ...b, observation:null })) return { ...stop('RECOVERY_DRIFT_STOP'), repeat_install:false };
  return { ...compared, settlement:'UNKNOWN', repeat_install:false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bytes = JSON.stringify(makeContract(),null,2)+'\n';
  if (process.argv.includes('--write')) writeFileSync(resolve(root,contractPath),bytes);
  else if (process.argv.includes('--check')) {
    if (!isDeepStrictEqual(readFileSync(resolve(root,contractPath),'utf8'),bytes)) throw Error('CONTRACT_OUTPUT_DRIFT');
    console.log('PASS pinned AIRPROP packet source/contract; SQL/native NOT_RUN_NOT_PASS');
  } else throw Error('Use --check or --write; offline only');
}
