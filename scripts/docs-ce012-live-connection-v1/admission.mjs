import { validateClosure, validateScopedInstallation } from './closure.mjs';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const CONTRACT = 'documents-ce012-live-connection-request.v2';
export const BASE = 'f3b0a7626de1ffcbbe1b01350a252b92c3e841dc';
export const OFFLINE_BASE = 'd10d8b9dddee3055a75304cc29f9b16cea68702f';
export const CASES = Object.freeze(['current_positive', 'documents_denied', 'replaced_fresh',
  'historical_disclosure', 'historical_revoked', 'cross_workspace', 'quarantined',
  'shared_lock', 'serialization_retry']);
export const EFFECTS = Object.freeze(['catalog_and_fixture_read', 'verified_local_auth_user_read',
  'core_read_phase_and_row_locks', 'existing_committed_receipt_read',
  'fixture_only_permission_id_self_update_for_conflict', 'observer_state_hashes',
  'no_domain_or_core_durable_effect', 'no_install_grant_or_activation']);
export const TABLES = Object.freeze(['documents.documents', 'documents.document_versions',
  'documents.upload_intents', 'documents.document_permissions', 'documents.document_links',
  'documents.document_scan_attestations', 'documents.access_events', 'documents.lifecycle_events',
  'experience.guides', 'experience.guide_steps', 'experience.guide_references',
  'audit.events', 'platform.outbox_events', 'platform.idempotency_keys',
  'platform.jurisdiction_domain_artifact_receipt_evidence']);
export const SEQUENCES = Object.freeze(['audit.events_id_seq']);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])]));
  return value;
}
export class Gate extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function must(condition, code) { if (!condition) throw new Gate(code); }
export function exactKeys(object, keys, code) {
  must(object && typeof object === 'object' && !Array.isArray(object)
    && canonical(Object.keys(object).sort()) === canonical([...keys].sort()), code);
}
const digest = value => /^[a-f0-9]{64}$/.test(value ?? '');
export function localUrl(value, kind) {
  let u; try { u = new URL(value); } catch { throw new Gate('TARGET_SELECTOR_MISSING'); }
  must(['127.0.0.1', '[::1]'].includes(u.hostname), 'NON_LOOPBACK_TARGET');
  must(!u.search && !u.hash, 'TARGET_URL_OPTIONS_FORBIDDEN');
  if (kind === 'auth') must(u.protocol === 'http:' && !u.username && !u.password && u.pathname === '/', 'AUTH_TARGET_INVALID');
  else must(['postgres:', 'postgresql:'].includes(u.protocol)
    && /^\/docs_ce012_[a-f0-9]{16}$/.test(u.pathname), 'OWNED_DATABASE_REQUIRED');
  return u;
}
export function verifyFiles(root, inventory) {
  must(Array.isArray(inventory) && inventory.length > 0, 'SOURCE_INVENTORY_MISSING');
  const names = new Set();
  for (const item of inventory) {
    exactKeys(item, ['path', 'bytes', 'sha256'], 'SOURCE_PIN_SHAPE');
    must(typeof item.path === 'string' && !path.isAbsolute(item.path)
      && !item.path.split('/').includes('..') && !names.has(item.path) && digest(item.sha256), 'SOURCE_PIN_INVALID');
    names.add(item.path);
    const bytes = readFileSync(path.join(root, item.path));
    must(bytes.length === item.bytes && sha256(bytes) === item.sha256, 'SOURCE_BYTES_MISMATCH');
  }
}
export function validateRequest(request) {
  exactKeys(request, ['contract', 'base', 'entrypoint', 'source_inventory', 'source_inventory_sha256',
    'runtime_closure', 'runtime_closure_sha256', 'artifacts', 'cases', 'effects', 'measurement_tables', 'measurement_sequences', 'limits', 'live_default'], 'REQUEST_SHAPE');
  must(request.contract === CONTRACT && request.base === BASE && request.live_default === 'CLOSED', 'REQUEST_VERSION');
  must(request.entrypoint === 'scripts/docs-ce012-live-connection-v1/run.mjs'
    && request.source_inventory === 'scripts/docs-ce012-live-connection-v1/source-inventory.json'
    && digest(request.source_inventory_sha256)
    && request.runtime_closure === 'scripts/docs-ce012-live-connection-v1/runtime-closure.json'
    && digest(request.runtime_closure_sha256), 'ENTRYPOINT_PIN_REQUIRED');
  must(canonical(request.cases) === canonical(CASES) && canonical(request.effects) === canonical(EFFECTS)
    && canonical(request.measurement_tables) === canonical(TABLES)
    && canonical(request.measurement_sequences) === canonical(SEQUENCES), 'EFFECT_OR_CASE_EXPANSION');
  must(canonical(request.limits) === canonical({ max_cases: 9, max_connections: 5,
    case_timeout_ms: 15000, total_timeout_ms: 180000, lock_probe_ms: 800 }), 'LIMIT_EXPANSION');
  must(Array.isArray(request.artifacts) && request.artifacts.length === 5
    && canonical(request.artifacts.map(a => a.path).sort()) === canonical([
      'admission.mjs', 'measure.mjs', 'run.mjs', 'live.mjs', 'closure.mjs',
    ].map(p => `scripts/docs-ce012-live-connection-v1/${p}`).sort()), 'EXECUTION_ARTIFACT_SET');
  return request;
}

/** Pure admission only. Review signature uses a separately trusted coordinator
 * public-key fingerprint supplied by Platform custody, not a key/approved flag
 * inside the request. No key generation, DB construction or network occurs here.
 */
export function admit({ requestBytes, inventoryBytes, closureBytes, planBytes, envelope, trustedPublicKey,
  trustedKeySha256, now = Date.now(), root }) {
  const request = validateRequest(JSON.parse(requestBytes));
  must(sha256(inventoryBytes) === request.source_inventory_sha256, 'INVENTORY_BYTES_MISMATCH');
  must(closureBytes && sha256(closureBytes) === request.runtime_closure_sha256, 'RUNTIME_CLOSURE_BYTES_MISMATCH');
  must(typeof trustedPublicKey === 'string' && digest(trustedKeySha256)
    && sha256(trustedPublicKey) === trustedKeySha256, 'COORDINATOR_TRUST_ANCHOR_MISSING');
  exactKeys(envelope, ['payload', 'signature'], 'REVIEW_ENVELOPE_SHAPE');
  const r = envelope.payload;
  exactKeys(r, ['contract', 'request_sha256', 'inventory_sha256', 'plan_sha256', 'expires_at',
    'target', 'installation', 'decisions'], 'REVIEW_PAYLOAD_SHAPE');
  must(r.contract === 'documents-ce012-coordinator-admission.v2'
    && r.request_sha256 === sha256(requestBytes) && r.inventory_sha256 === sha256(inventoryBytes)
    && r.plan_sha256 === sha256(planBytes), 'REVIEW_BINDING_MISMATCH');
  const key = createPublicKey(trustedPublicKey);
  must(key.asymmetricKeyType === 'ed25519' && typeof envelope.signature === 'string'
    && verify(null, Buffer.from(canonical(r)), key, Buffer.from(envelope.signature, 'base64')), 'REVIEW_SIGNATURE_INVALID');
  must(Number.isFinite(Date.parse(r.expires_at)) && Date.parse(r.expires_at) > now
    && Date.parse(r.expires_at) <= now + 3600000, 'REVIEW_EXPIRED_OR_OVERLONG');
  exactKeys(r.target, ['database', 'database_oid', 'system_identifier', 'auth_origin', 'auth_issuer', 'auth_user_path', 'observer_role', 'conflict_role',
    'custody_nonce', 'exclusive_fixture', 'synthetic_only'], 'TARGET_BINDING_SHAPE');
  must(/^docs_ce012_[a-f0-9]{16}$/.test(r.target.database)
    && /^[1-9][0-9]*$/.test(r.target.database_oid) && /^[1-9][0-9]*$/.test(r.target.system_identifier)
    && /^[a-f0-9]{32}$/.test(r.target.custody_nonce) && r.target.exclusive_fixture === true
    && r.target.synthetic_only === true, 'TARGET_CUSTODY_INCOMPLETE');
  localUrl(`${r.target.auth_origin}/`, 'auth');
  must(typeof r.target.auth_issuer === 'string'
    && [r.target.auth_origin, `${r.target.auth_origin}/auth/v1`].includes(r.target.auth_issuer)
    && ['/user', '/auth/v1/user'].includes(r.target.auth_user_path), 'AUTH_ISSUER_OR_PATH_UNREVIEWED');
  must(typeof r.target.observer_role === 'string'
    && /^[a-z][a-z0-9_]{2,62}$/.test(r.target.observer_role)
    && !['postgres', 'service_role', 'supabase_admin', 'authenticated', 'anon'].includes(r.target.observer_role), 'OBSERVER_IDENTITY_UNREVIEWED');
  must(r.target.conflict_role === null || (typeof r.target.conflict_role === 'string'
    && /^[a-z][a-z0-9_]{2,62}$/.test(r.target.conflict_role)
    && !['postgres', 'supabase_admin', 'service_role', 'authenticated', 'anon', 'cladora_ce_guide_runtime'].includes(r.target.conflict_role)), 'CONFLICT_IDENTITY_UNREVIEWED');
  const inventory = JSON.parse(inventoryBytes);
  must(inventory.base === OFFLINE_BASE && Array.isArray(inventory.files), 'INVENTORY_VERSION');
  const runtimeClosure = validateClosure(JSON.parse(closureBytes), inventory);
  validateScopedInstallation(r.installation, runtimeClosure, closureBytes, inventoryBytes, inventory);
  exactKeys(r.decisions, ['source_request_accepted', 'save_host_mapping', 'neutral_label', 'live_dispatch_authorized'], 'DECISION_SHAPE');
  must(Object.values(r.decisions).every(v => v === true), 'JOINT_REVIEW_OR_DISPATCH_GATE_OPEN');
  if (root) { verifyFiles(root, inventory.files); verifyFiles(root, request.artifacts); }
  const plan = JSON.parse(planBytes);
  exactKeys(plan, ['contract', 'tenant_id', 'cases'], 'PLAN_SHAPE');
  must(plan.contract === 'documents-ce012-synthetic-fixture-plan.v1'
    && /^[a-f0-9-]{36}$/.test(plan.tenant_id) && Array.isArray(plan.cases)
    && canonical(plan.cases.map(c => c.name).sort()) === canonical([...CASES].sort()), 'CASE_PLAN_MISSING');
  // Per-case command/receipt absence blocks just that dispatch in live.mjs.
  for (const c of plan.cases) exactKeys(c, ['name', 'command', 'guide_command', 'receipt_id', 'receipt_hash'], 'CASE_PLAN_SHAPE');
  return { request, inventory, runtimeClosure, review: r, plan };
}
