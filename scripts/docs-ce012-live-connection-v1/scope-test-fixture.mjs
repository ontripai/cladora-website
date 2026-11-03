// Offline admission fixture only. No real roles, catalog, native evaluator or
// source acceptance is established by these synthetic digests/signatures.
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
import { hash, COMPONENTS } from './closure.mjs';
import { canonical, sha256, CASES, TABLES } from './admission.mjs';
export function scopeFixture() {
  const requestBytes = readFileSync(new URL('./consumer-request.json', import.meta.url));
  const inventoryBytes = readFileSync(new URL('./source-inventory.json', import.meta.url));
  const closureBytes = readFileSync(new URL('./runtime-closure.json', import.meta.url));
  const closure = JSON.parse(closureBytes), inventory = JSON.parse(inventoryBytes);
  const catalog = {
    present: Object.fromEntries(['functions', 'relations', 'columns', 'triggers', 'rls', 'roles', 'role_edges', 'sequences'].map(k => [k, true])),
    function_bodies: closure.functions.map(f => ({ signature: f.signature, body_sha256: f.body_sha256 ?? 'a'.repeat(64) })),
    digests: Object.fromEntries(COMPONENTS.map(k => [k, 'a'.repeat(64)])),
  };
  const installation = { scope_contract: closure.contract, runtime_closure_sha256: sha256(closureBytes),
    source_inventory_sha256: sha256(inventoryBytes), catalog_sha256: hash(catalog), catalog_evidence: catalog,
    lineage: closure.source_inputs,
    compatibility: { contract: 'documents-ce012-bounded-compatibility.v1', closure_sha256: sha256(closureBytes), unresolved_impacts: [], guard300: 'unchanged' },
    observed_migration_versions: inventory.files.filter(f => f.path.startsWith('supabase/migrations/')).map(f => f.path.split('/').at(-1).split('_')[0]),
    fixture_source_sha256: 'd'.repeat(64), platform_lifecycle_source_sha256: 'e'.repeat(64), platform_profile_sha256: 'f'.repeat(64),
  };
  const planBytes = Buffer.from(JSON.stringify({ contract: 'documents-ce012-synthetic-fixture-plan.v1',
    tenant_id: '38000000-0000-4000-8000-000000000001', cases: CASES.map(name => ({ name,
      command: null, guide_command: null, receipt_id: null, receipt_hash: null })) }));
  const now = Date.now(), { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const trustedPublicKey = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const payload = { contract: 'documents-ce012-coordinator-admission.v2', request_sha256: sha256(requestBytes),
    inventory_sha256: sha256(inventoryBytes), plan_sha256: sha256(planBytes), expires_at: new Date(now + 600000).toISOString(),
    target: { database: 'docs_ce012_0123456789abcdef', database_oid: '1', system_identifier: '2',
      auth_origin: 'http://127.0.0.1:9999', auth_issuer: 'http://127.0.0.1:9999', auth_user_path: '/user',
      observer_role: 'offline_test_observer', conflict_role: null, custody_nonce: 'a'.repeat(32), exclusive_fixture: true, synthetic_only: true },
    installation,
    decisions: { source_request_accepted: true, save_host_mapping: true, neutral_label: true, live_dispatch_authorized: true } };
  const signed = p => ({ payload: p, signature: sign(null, Buffer.from(canonical(p)), privateKey).toString('base64') });
  const input = { requestBytes, inventoryBytes, closureBytes, planBytes, trustedPublicKey,
    trustedKeySha256: sha256(trustedPublicKey), envelope: signed(payload), now };
  return { input, signed, payload, catalog, closure, closureBytes, inventory };
}
export function observerFixture(payload, catalog) {
  let calls = 0;
  return { get calls() { return calls; }, async query() {
    const steps = [
      { rows: [{ ...payload.target, session_role: payload.target.observer_role, version: 170000, read_only: 'on' }] },
      { rows: [{ native: true, safety: true, documents: true, guides: true }] },
      { rows: [{ catalog }] },
      { rowCount: 1, rows: [{ rolsuper: false, rolcreaterole: false, rolcreatedb: false, rolreplication: false }] },
      { rowCount: TABLES.length, rows: TABLES.map(() => ({ readable: true, writable: false })) },
      { rowCount: 1, rows: [{ readable: true, writable: false }] },
    ]; return steps[calls++];
  } };
}
