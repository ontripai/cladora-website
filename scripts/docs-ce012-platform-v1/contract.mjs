/** Closed Documents admission. No Core consumer alias or request-selected code. */
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const DIR = 'scripts/docs-ce012-live-connection-v1/';
export const ENTRY = `${DIR}run.mjs`;
export const HISTORICAL = Object.freeze({
  head: 'f3b0a7626de1ffcbbe1b01350a252b92c3e841dc',
  request_sha256: '0751e1d5e4bb2362d37a5f32261a9d1551f6833069b1744ecd5385bf9cc86494',
  inventory_sha256: '6388b257096dbc094f9513e40a06cebaf9042f55720b89c93cfd89b68b717a11',
});
export const FILES = Object.freeze([
  'scripts/run-local-runtime-lane.py', 'scripts/local_runtime_consumer.py',
  'supabase/local-profiles/runtime-lane-v1.json',
  'scripts/run-docs-ce012-pgauth.py',
  'supabase/local-profiles/docs-ce012-pgauth-binding-v1.json',
  ...['contract.mjs', 'custody.mjs', 'transport.mjs', 'worker.mjs', 'runtime-collector.mjs', 'runtime-smoke.mjs', 'runtime-routes.mjs', 'runtime-route-policy.v1.json', 'runtime-routes-smoke.mjs'].map(p => `scripts/docs-ce012-platform-v1/${p}`),
]);
export const CASES = Object.freeze(['current_positive', 'documents_denied', 'replaced_fresh',
  'historical_disclosure', 'historical_revoked', 'cross_workspace', 'quarantined', 'shared_lock', 'serialization_retry']);
export const EFFECTS = Object.freeze(['catalog_and_fixture_read', 'verified_local_auth_user_read',
  'core_read_phase_and_row_locks', 'existing_committed_receipt_read',
  'fixture_only_permission_id_self_update_for_conflict', 'observer_state_hashes',
  'no_domain_or_core_durable_effect', 'no_install_grant_or_activation']);
export const TABLES = Object.freeze(['documents.documents','documents.document_versions','documents.upload_intents','documents.document_permissions','documents.document_links','documents.document_scan_attestations','documents.access_events','documents.lifecycle_events','experience.guides','experience.guide_steps','experience.guide_references','audit.events','platform.outbox_events','platform.idempotency_keys','platform.jurisdiction_domain_artifact_receipt_evidence']);
export const SEQUENCES=Object.freeze(['audit.events_id_seq']);
export const LIMITS = Object.freeze({ max_cases: 9, max_connections: 5,
  case_timeout_ms: 15000, total_timeout_ms: 180000, lock_probe_ms: 800 });
export const sha = b => createHash('sha256').update(b).digest('hex');
export function sorted(v) {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])]));
  return v;
}
export const canonical = v => JSON.stringify(sorted(v));
export class Hold extends Error { constructor(code) { super(code); this.code = code; } }
export const need = (v, code) => { if (!v) throw new Hold(code); };
export const hex = (v, n = 64) => typeof v === 'string' && new RegExp(`^[a-f0-9]{${n}}$`).test(v);
export function keys(v, expected, code = 'SHAPE') {
  need(v && typeof v === 'object' && !Array.isArray(v)
    && canonical(Object.keys(v).sort()) === canonical([...expected].sort()), code);
}
export function safeRead(root, relative, max = 16 * 1024 * 1024) {
  need(typeof relative === 'string' && relative.length > 0 && !path.isAbsolute(relative)
    && !relative.split('/').some(x => !x || x === '..' || x === '.'), 'RELATIVE_INPUT_ONLY');
  const base = realpathSync(root);
  let p = base;
  for (const name of relative.split('/')) {
    p = path.join(p, name); need(!lstatSync(p).isSymbolicLink(), 'SYMLINK_INPUT_FORBIDDEN');
  }
  const stat = lstatSync(p);
  need(stat.isFile() && stat.size <= max && realpathSync(p).startsWith(`${base}/`), 'INPUT_BOUND_OR_TYPE');
  return readFileSync(p);
}
export function pin(root, relative, expected) {
  keys(expected, ['bytes', 'sha256']); need(hex(expected.sha256) && Number.isSafeInteger(expected.bytes) && expected.bytes >= 0, 'PIN_SHAPE');
  const b = safeRead(root, relative); need(b.length === expected.bytes && sha(b) === expected.sha256, 'PIN_MISMATCH'); return b;
}
export function seal() {
  const files = Object.fromEntries(FILES.map(p => [p, sha(safeRead(ROOT, p))]));
  return { files, sha256: sha(Buffer.from(canonical(files))) };
}
export function sourceBinding() {
  return JSON.parse(safeRead(ROOT, 'supabase/local-profiles/docs-ce012-pgauth-binding-v1.json'));
}
export function reviewRegistry() {
  const r = JSON.parse(safeRead(ROOT, 'supabase/local-profiles/docs-ce012-pgauth-reviews-v1.json'));
  keys(r, ['format', 'reviews']); need(r.format === 'docs-ce012-platform-reviews.v1', 'REGISTRY_FORMAT'); return r.reviews;
}
export function validateDescriptor(d) {
  keys(d, ['format','run_id','attempt_id','custody_nonce','profile_sha256','platform_seal_sha256',
    'pg_cid','auth_cid','pg_name','auth_name','pg_config_sha256','auth_config_sha256','database','database_oid','system_identifier',
    'auth_origin','auth_issuer','auth_user_path','observer_role','conflict_role','synthetic_subject',
    'exclusive_fixture','synthetic_only','owner_uid','created_at','expires_at']);
  need(d.format === 'platform-owned-pg-auth-fixture.v1' && /^cladora-lane-[a-f0-9]{12}$/.test(d.run_id)
    && hex(d.attempt_id,32) && hex(d.custody_nonce,32), 'RUN_IDENTITY');
  need(hex(d.pg_config_sha256) && hex(d.auth_config_sha256) && hex(d.pg_cid) && hex(d.auth_cid) && d.pg_cid !== d.auth_cid
    && d.pg_name === `${d.run_id}-pg` && d.auth_name === `${d.run_id}-auth`, 'PG_AUTH_CUSTODY_REQUIRED');
  need(/^docs_ce012_[a-f0-9]{16}$/.test(d.database)
    && /^[1-9][0-9]*$/.test(d.database_oid) && /^[1-9][0-9]*$/.test(d.system_identifier), 'DATABASE_IDENTITY');
  need(d.auth_origin === 'http://127.0.0.1:9999'
    && [d.auth_origin,`${d.auth_origin}/auth/v1`].includes(d.auth_issuer)
    && ['/user','/auth/v1/user'].includes(d.auth_user_path), 'AUTH_ORIGIN_ISSUER');
  need(typeof d.observer_role === 'string' && /^[a-z][a-z0-9_]{2,62}$/.test(d.observer_role)
    && !['postgres','service_role','supabase_admin','authenticated','anon','cladora_ce_guide_runtime'].includes(d.observer_role), 'OBSERVER_ROLE');
  need(typeof d.conflict_role === 'string' && /^[a-z][a-z0-9_]{2,62}$/.test(d.conflict_role)
    && !['postgres','service_role','supabase_admin','authenticated','anon','cladora_ce_guide_runtime',d.observer_role].includes(d.conflict_role), 'CONFLICT_ROLE');
  need(/^[a-f0-9-]{36}$/.test(d.synthetic_subject) && d.exclusive_fixture === true && d.synthetic_only === true
    && Number.isSafeInteger(d.owner_uid) && d.owner_uid >= 0 && hex(d.profile_sha256) && hex(d.platform_seal_sha256), 'PLATFORM_OWNERSHIP');
  need(Number.isFinite(Date.parse(d.created_at)) && Date.parse(d.expires_at)>Date.parse(d.created_at)
    && Date.parse(d.expires_at)-Date.parse(d.created_at)<=3600000, 'DESCRIPTOR_TIME');
  return d;
}
export function prerequisite(value, kind, d, accepted) {
  keys(value, ['kind','producer_head','payload_sha256','evidence_sha256','run_id','attempt_id',
    'pg_cid','auth_cid','database_oid','system_identifier','state','commit_ack']);
  need(value.kind === kind && value.state === 'ACKNOWLEDGED' && value.commit_ack === true
    && hex(value.producer_head,40) && hex(value.payload_sha256) && hex(value.evidence_sha256), `NOT_READY_${kind.toUpperCase()}_PRODUCER_ACK`);
  for (const k of ['run_id','attempt_id','pg_cid','auth_cid','database_oid','system_identifier']) need(value[k]===d[k], 'PREREQUISITE_OTHER_RUN');
  need(accepted && sha(Buffer.from(canonical(value)))===accepted, 'PREREQUISITE_NOT_IN_PLATFORM_REVIEW');
}
export function admit(input, { binding=sourceBinding(), reviews=reviewRegistry(), now=Date.now(), currentSeal=seal() } = {}) {
  keys(input, ['format','consumer','source_head','request','inventory','closure','plan','descriptor',
    'prerequisites','platform_seal_sha256']);
  need(input.format==='docs-ce012-platform-invocation.v1' && input.consumer==='Documents/CE012', 'DOCUMENTS_CONSUMER_ONLY');
  need(hex(input.source_head,40) && input.source_head!==HISTORICAL.head
    && input.request?.sha256!==HISTORICAL.request_sha256, 'HISTORICAL_REQUEST_NOT_EXECUTABLE');
  need(binding.format==='docs-ce012-pgauth-binding.v1' && binding.accepted!==null,
    'NOT_READY_DOCUMENTS_LIVE_SCOPE_04_ACCEPTED_SHA_REQUEST_CLOSURE');
  const b=binding.accepted;
  need(input.source_head===b.head && canonical(input.request)===canonical(b.request)
    && canonical(input.inventory)===canonical(b.inventory) && canonical(input.closure)===canonical(b.closure), 'ACCEPTED_PRODUCER_BINDING');
  need(input.platform_seal_sha256===currentSeal.sha256, 'PLATFORM_SEAL_CHANGED');
  for (const k of ['request','inventory','closure','plan']) {
    keys(input[k],['bytes','sha256']); need(hex(input[k].sha256) && Number.isSafeInteger(input[k].bytes) && input[k].bytes>0,'HASH_PIN_REQUIRED');
  }
  validateDescriptor(input.descriptor);
  const d=input.descriptor;
  need(d.platform_seal_sha256===currentSeal.sha256 && d.profile_sha256===currentSeal.files['supabase/local-profiles/runtime-lane-v1.json'], 'PROFILE_OR_DESCRIPTOR_SEAL');
  const digest=sha(Buffer.from(canonical(input))), r=reviews[digest];
  need(r && Object.keys(r).length===10, 'PLATFORM_REVIEW_MISSING');
  keys(r,['invocation_sha256','seal_sha256','source_head','descriptor_sha256','plan_sha256','expires_at',
    'review','coordinator_key_sha256','prerequisites','single_use']);
  need(r.invocation_sha256===digest && r.seal_sha256===currentSeal.sha256 && r.source_head===input.source_head
    && r.descriptor_sha256===sha(Buffer.from(canonical(d))) && r.plan_sha256===input.plan.sha256
    && r.single_use===true && /^https:\/\/github.com\/ontripai\/cladora-website\/issues\/463#issuecomment-[0-9]+$/.test(r.review)
    && hex(r.coordinator_key_sha256), 'PLATFORM_REVIEW_BINDING');
  const ceiling=Math.min(Date.parse(r.expires_at),Date.parse(d.expires_at));
  need(Number.isFinite(ceiling) && ceiling>now && ceiling<=now+3600000 && Date.parse(d.created_at)<=now, 'PLATFORM_REVIEW_EXPIRED');
  keys(input.prerequisites,['installation','fixture','committed_receipt']);
  for (const k of ['installation','fixture','committed_receipt']) prerequisite(input.prerequisites[k],k,d,r.prerequisites[k]);
  return Object.freeze({ input:structuredClone(input), review:structuredClone(r), binding:structuredClone(b),
    ceiling, identity:sha(Buffer.from(canonical({digest,review:r}))), seal:currentSeal });
}
export function verifyMaterials(root, input, binding) {
  const request=pin(root,`${DIR}consumer-request.json`,input.request);
  const inventory=pin(root,`${DIR}source-inventory.json`,input.inventory);
  // Exact v2 runtime closure is data; offline inventory is not an install list.
  const closure=pin(root,`${DIR}runtime-closure.json`,input.closure);
  const req=JSON.parse(request);
  need(req.contract==='documents-ce012-live-connection-request.v2' && req.entrypoint===ENTRY && req.live_default==='CLOSED' && req.source_inventory===`${DIR}source-inventory.json`
    && req.source_inventory_sha256===input.inventory.sha256
    && req.runtime_closure===`${DIR}runtime-closure.json` && req.runtime_closure_sha256===input.closure.sha256 && canonical(req.cases)===canonical(CASES)
    && canonical(req.effects)===canonical(EFFECTS) && canonical(req.limits)===canonical(LIMITS)
    && canonical(req.measurement_tables)===canonical(TABLES) && canonical(req.measurement_sequences)===canonical(SEQUENCES), 'REQUEST_EFFECT_ENTRY_OR_LIMIT_EXPANSION');
  need(Array.isArray(binding.artifacts) && binding.artifacts.length===5
    && canonical(binding.artifacts.map(v=>v.path).sort())===canonical(['admission.mjs','run.mjs','live.mjs','measure.mjs','closure.mjs'].map(p=>DIR+p).sort())
    && canonical(req.artifacts)===canonical(binding.artifacts), 'FIXED_EXECUTION_ARTIFACTS');
  for(const entry of binding.artifacts) pin(root,entry.path,{bytes:entry.bytes,sha256:entry.sha256});
  const inv=JSON.parse(inventory);need(Array.isArray(inv.files) && inv.files.length>0,'SOURCE_INVENTORY');
  const seen=new Set();for(const entry of inv.files){need(!seen.has(entry.path),'DUPLICATE_SOURCE_PIN');seen.add(entry.path);pin(root,entry.path,{bytes:entry.bytes,sha256:entry.sha256});}
  return {request,inventory,closure};
}
