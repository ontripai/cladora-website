import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { z } from 'zod';
import { coreTransactionCommandV2Schema } from '../../src/lib/core/postgres-transaction-host-v1.ts';
import { currentAuthorityTransactionRequestV1Schema } from '../../src/lib/core/current-authority-transaction-port-v1.ts';
import {
  ce012GuideSaveCommandV1Schema,
  fingerprintCe012GuideSavePayload,
} from '../../src/lib/community/experience-guide-command-contract.ts';

export const COMPILER_CONTRACT = 'documents-ce012-case-plan-compiler.v1' as const;
export const PLATFORM_INPUT_CONTRACT = 'documents-ce012-platform-provenance-input.v1' as const;
export const DOCUMENTS_INPUT_CONTRACT = 'documents-ce012-documents-case-input.v1' as const;
export const PLAN_CONTRACT = 'documents-ce012-synthetic-fixture-plan.v1' as const;
export const HARNESS_SOURCE = 'c0caf3e70d97c3d09b16cbff91188367804cba6b' as const;
export const HARNESS_REQUEST_SHA256 = '3ca7a18b4789d262565dc3289cf029d633b36a0fa155c5f3a575dfeedc619873' as const;
export const RUNTIME_CLOSURE_SHA256 = '55093d835a860ceeb414fbd097d3b62af2520e60cee5b093763ff7f983f928ee' as const;
export const CASE_NAMES = Object.freeze(['current_positive', 'documents_denied', 'replaced_fresh',
  'historical_disclosure', 'historical_revoked', 'cross_workspace', 'quarantined',
  'shared_lock', 'serialization_retry'] as const);
type CaseName = typeof CASE_NAMES[number];
const uuid = z.string().uuid();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const version = z.number().int().positive().safe();
const instant = z.string().datetime({ offset: true });
const status = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const custody = z.strictObject({
  run_id: z.string().regex(/^cladora-lane-[a-f0-9]{12}$/),
  custody_nonce: z.string().regex(/^[a-f0-9]{32}$/),
  database: z.string().regex(/^docs_ce012_[a-f0-9]{16}$/),
  database_oid: z.string().regex(/^[1-9][0-9]*$/),
  system_identifier: z.string().regex(/^[1-9][0-9]*$/),
});
const harness = z.strictObject({
  source_commit: z.literal(HARNESS_SOURCE),
  request_sha256: z.literal(HARNESS_REQUEST_SHA256),
  runtime_closure_sha256: z.literal(RUNTIME_CLOSURE_SHA256),
});
export const platformInputSchema = z.strictObject({
  contract: z.literal(PLATFORM_INPUT_CONTRACT),
  consumer: z.literal('PLATFORM-DOCS-CE012-PGAUTH-BIND-05'),
  custody,
  database_provenance_sha256: digest,
  auth_provenance: z.strictObject({
    origin: z.string().url(),
    actor_id: uuid,
    session_id: uuid,
    assurance_level: z.literal('aal2'),
    source_evidence_sha256: digest,
  }),
  observed_at: instant,
  harness,
});
const document = z.strictObject({ id: uuid, tenant_id: uuid, workspace_id: uuid.nullable(),
  current_version: version, status, deleted_at: instant.nullable(), archived_at: instant.nullable(), disposition_status: status });
const documentVersion = z.strictObject({ id: uuid, tenant_id: uuid, document_id: uuid, version,
  scanning_status: status, checksum_status: status, sha256: digest });
const permission = z.strictObject({ id: uuid, tenant_id: uuid, document_id: uuid,
  membership_id: uuid, permission: z.literal('view'), valid_from: instant, valid_until: instant.nullable() });
const scan = z.strictObject({ version_id: uuid, tenant_id: uuid, provider: z.literal('clamav'),
  verdict: z.enum(['clean', 'quarantined']), content_sha256: digest, scanned_at: instant, recorded_at: instant });
// Reference metadata only. There is no receipt body, committed flag, GET result
// or caller-supplied verifier/allow callback in this ABI.
const historicalReference = z.strictObject({
  source_contract: z.literal('core-transaction-receipt.v2'),
  source_store: z.literal('platform.idempotency_keys.response_ref'),
  ce_contract: z.literal('ce012-guide-command.v1'),
  core_receipt_id: uuid, core_receipt_hash: digest, ce_save_receipt_id: uuid,
  binding: z.strictObject({ command_id: uuid, context_id: uuid, workspace_id: uuid, guide_id: uuid,
    document_id: uuid, document_version_id: uuid, document_version: version,
    expected_guide_version: version, payload_fingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    idempotency_key: z.string().min(8).max(128) }),
});
const caseInputSchema = z.strictObject({
  name: z.enum(CASE_NAMES),
  source_artifact_sha256: digest,
  // Canonical parsing occurs per case: one missing/invalid source blocks just
  // that case, preserving independent cases and never generating identities.
  command: z.unknown().nullable().refine(v => v !== undefined),
  guide_command: z.unknown().nullable().refine(v => v !== undefined),
  documents_authority_request: z.unknown().nullable().refine(v => v !== undefined),
  core_fixture_source_sha256: digest.nullable(),
  context_membership_id: uuid,
  guide: z.strictObject({ id: uuid, tenant_id: uuid, workspace_id: uuid, version, status }),
  document,
  document_version: documentVersion,
  permissions: z.array(permission).max(2),
  scan_attestation: scan.nullable(),
  receipt_id: uuid.nullable(), receipt_hash: digest.nullable(),
  historical_reference: historicalReference.nullable(),
});
export const documentsInputSchema = z.strictObject({
  contract: z.literal(DOCUMENTS_INPUT_CONTRACT),
  platform_input_sha256: digest,
  custody,
  tenant_id: uuid,
  // Names come only from the existing nine-case set. Missing entries become
  // null-command BLOCKED slots; unknown/duplicate names invalidate the envelope.
  cases: z.array(z.unknown()).max(9),
});
type PlatformInput = z.infer<typeof platformInputSchema>;
type DocumentsInput = z.infer<typeof documentsInputSchema>;
type CaseInput = z.infer<typeof caseInputSchema>;
type Command = z.infer<typeof coreTransactionCommandV2Schema>;
type GuideCommand = z.infer<typeof ce012GuideSaveCommandV1Schema>;
type CaseResult = { name: CaseName; outcome: 'COMPILED_SHAPE' | 'BLOCKED'; code: string | null; producer: string; required_output: string };
type PlanRow = { name: CaseName; command: Command | null; guide_command: GuideCommand | null;
  receipt_id: string | null; receipt_hash: string | null };
export const CASE_SEMANTICS = Object.freeze(CASE_NAMES.map(name => Object.freeze({
  name,
  evaluation_mode: name.startsWith('historical_') ? 'replay' : 'new_command',
  expected_documents_decision: name === 'replaced_fresh' ? 'stale'
    : ['documents_denied', 'historical_revoked', 'cross_workspace', 'quarantined'].includes(name) ? 'denied'
      : name === 'historical_disclosure' ? 'historical_authorized' : 'current_authorized',
  required_native_documents_read: !['documents_denied', 'historical_revoked'].includes(name),
  document_relation: name === 'cross_workspace' ? 'same_tenant_other_explicit_workspace' : 'exact_workspace',
  version_relation: ['replaced_fresh', 'historical_disclosure', 'historical_revoked'].includes(name) ? 'replaced_exact_immutable_version' : 'current_exact_immutable_version',
  scan: name === 'quarantined' ? 'quarantined' : 'clean_verified_exact_attestation',
  conflict_permission_rows: ['shared_lock', 'serialization_retry'].includes(name) ? 1 : null,
  historical_completion_in_this_base: false,
})));
const HISTORICAL_DEPENDENCY = Object.freeze({
  dependency: 'DOCS-CE012-CASE-PLAN-01/CE_SAVE_CORE_STORED_RELATION',
  producer: 'Core/CE',
  required_output: 'canonical verifier of persisted CE-save/Core receipt relation bound to exact command, immutable target and custody; not receipt JSON shape or current GET',
} as const);
export { fingerprintCe012GuideSavePayload as canonicalGuidePayloadFingerprint };
function sorted(value: unknown, stack = new Set<object>(), depth = 0): unknown {
  if (depth > 64) throw new Error('json_bound');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || types.isProxy(value) || stack.has(value)) throw new Error('not_json');
  if (Object.getOwnPropertySymbols(value).length) throw new Error('not_json');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(d => !('value' in d))) throw new Error('not_json');
  stack.add(value);
  let result: unknown;
  if (Array.isArray(value)) {
    if (value.length > 20000 || Object.keys(value).length !== value.length) throw new Error('json_bound');
    result = Array.from({ length: value.length }, (_, i) => {
      if (!descriptors[String(i)]) throw new Error('not_json');
      return sorted(descriptors[String(i)].value, stack, depth + 1);
    });
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error('not_json');
    const keys = Object.keys(descriptors).sort();
    if (keys.length > 20000) throw new Error('json_bound');
    result = Object.fromEntries(keys.map(k => [k, sorted(descriptors[k].value, stack, depth + 1)]));
  }
  stack.delete(value);
  return result;
}
export function canonicalJson(value: unknown): string {
  const text = JSON.stringify(sorted(value));
  if (Buffer.byteLength(text, 'utf8') > 1048576) throw new Error('json_bound');
  return text;
}
export function contentHash(value: unknown): string { return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex'); }
function same(a: unknown, b: unknown) { return canonicalJson(a) === canonicalJson(b); }
function noData(row: CaseName): PlanRow { return { name: row, command: null, guide_command: null, receipt_id: null, receipt_hash: null }; }
function blocked(name: CaseName, code: string, producer = 'Documents', required_output = 'exact Documents-owned case source binding') {
  return { name, outcome: 'BLOCKED' as const, code, producer, required_output };
}
function checkCase(c: CaseInput, p: PlatformInput, d: DocumentsInput): string | null {
  if (!c.command || !c.guide_command || !c.documents_authority_request) return 'CANONICAL_COMMAND_INPUT_MISSING';
  const commandResult = coreTransactionCommandV2Schema.safeParse(c.command);
  const guideResult = ce012GuideSaveCommandV1Schema.safeParse(c.guide_command);
  const authorityResult = currentAuthorityTransactionRequestV1Schema.safeParse(c.documents_authority_request);
  if (!commandResult.success || !guideResult.success || !authorityResult.success) return 'CANONICAL_COMMAND_INPUT_INVALID';
  const cmd = commandResult.data, guide = guideResult.data, req = authorityResult.data;
  if (!same(cmd, c.command) || !same(guide, c.guide_command) || !same(req, c.documents_authority_request)) return 'NON_CANONICAL_INPUT_REPRESENTATION';
  const target = guide.payload.document_target;
  if (!target) return 'IMMUTABLE_DOCUMENT_TARGET_MISSING';
  if (cmd.actor_id !== p.auth_provenance.actor_id || req.actor_id !== cmd.actor_id) return 'ACTOR_SESSION_REFERENCE_MISMATCH';
  if (cmd.context_id !== guide.context_id || cmd.workspace_id !== guide.workspace_id
    || cmd.aggregate_id !== guide.guide_id || cmd.command_id !== guide.command_id
    || cmd.aggregate_type !== 'experience_guide' || cmd.aggregate_version !== guide.expected_guide_version + 1
    || cmd.subject_reference.kind !== 'experience.guide' || cmd.subject_reference.id !== guide.guide_id
    || cmd.subject_reference.version !== guide.expected_guide_version
    || cmd.subject_reference.relation !== 'save_draft' || cmd.subject_reference.request_version !== 1
    || cmd.permission_code !== 'experience.guide.manage' || cmd.module_code !== 'experience_guides'
    || cmd.evaluation_purpose !== 'experience.guide.command'
    || cmd.idempotency_key !== guide.idempotency_key || cmd.input_fingerprint !== guide.payload_fingerprint
    || fingerprintCe012GuideSavePayload(guide) !== guide.payload_fingerprint
    || !cmd.provider_source_ids.includes(target.document_id) || !cmd.provider_source_ids.includes(target.document_version_id)) return 'CE_CORE_COMMAND_BINDING_MISMATCH';
  if (req.context_id !== cmd.context_id || req.workspace_id !== cmd.workspace_id
    || req.authority_version !== cmd.authority_version || req.permission_code !== 'documents.vault.read'
    || req.module_code !== 'documents' || req.evaluation_purpose !== 'documents.reference.read'
    || req.transaction_context.transaction_id !== cmd.transaction_id || req.transaction_context.command_id !== cmd.command_id
    || req.transaction_context.lock.workspace_id !== cmd.workspace_id
    || req.transaction_context.lock.aggregate_type !== cmd.aggregate_type || req.transaction_context.lock.aggregate_id !== cmd.aggregate_id
    || Date.parse(req.transaction_context.lock.acquired_at) > Date.parse(p.observed_at)) return 'CORE_DOCUMENTS_REQUEST_BINDING_MISMATCH';
  if (!c.core_fixture_source_sha256) return 'CORE_NATIVE_FIXTURE_SOURCE_MISSING';
  if (c.guide.id !== guide.guide_id || c.guide.tenant_id !== d.tenant_id
    || c.guide.workspace_id !== cmd.workspace_id || c.guide.status !== 'draft') return 'GUIDE_BINDING_MISMATCH';
  const historical = c.name.startsWith('historical_');
  if (historical ? c.guide.version < guide.expected_guide_version + 1 : c.guide.version !== guide.expected_guide_version) return 'GUIDE_VERSION_MISMATCH';
  const doc = c.document, v = c.document_version;
  if (doc.id !== target.document_id || doc.tenant_id !== d.tenant_id || v.tenant_id !== d.tenant_id
    || v.document_id !== doc.id || v.id !== target.document_version_id || v.version !== target.document_version) return 'DOCUMENT_VERSION_BINDING_MISMATCH';
  if (doc.workspace_id === null || (c.name === 'cross_workspace' ? doc.workspace_id === cmd.workspace_id : doc.workspace_id !== cmd.workspace_id)) return 'DOCUMENT_WORKSPACE_BINDING_MISMATCH';
  if (doc.status !== 'active' || doc.deleted_at !== null || doc.archived_at !== null
    || !['retained', 'review_due', 'legal_hold'].includes(doc.disposition_status)) return 'DOCUMENT_LIFECYCLE_MISMATCH';
  const replaced = historical || c.name === 'replaced_fresh';
  if (replaced ? doc.current_version <= v.version : doc.current_version !== v.version) return 'CASE_VERSION_RELATION_MISMATCH';
  const quarantine = c.name === 'quarantined', a = c.scan_attestation;
  if (v.scanning_status !== (quarantine ? 'quarantined' : 'clean') || v.checksum_status !== 'verified'
    || !a || a.version_id !== v.id || a.tenant_id !== d.tenant_id || a.content_sha256 !== v.sha256
    || a.verdict !== (quarantine ? 'quarantined' : 'clean')
    || Date.parse(a.scanned_at) > Date.parse(p.observed_at) || Date.parse(a.recorded_at) > Date.parse(p.observed_at)) return 'CASE_SCAN_BINDING_MISMATCH';
  const permissionIds = new Set(c.permissions.map(x => x.id));
  if (permissionIds.size !== c.permissions.length || c.permissions.some(x => x.tenant_id !== d.tenant_id
    || x.document_id !== doc.id || x.membership_id !== c.context_membership_id)) return 'PERMISSION_BINDING_MISMATCH';
  if (['shared_lock', 'serialization_retry'].includes(c.name) && c.permissions.length !== 1) return 'CONFLICT_PERMISSION_FIXTURE_MISMATCH';
  if (!['documents_denied', 'historical_revoked'].includes(c.name) && !c.permissions.some(x =>
    Date.parse(x.valid_from) <= Date.parse(p.observed_at)
    && (x.valid_until === null || Date.parse(x.valid_until) > Date.parse(p.observed_at)))) return 'PERMISSION_FIXTURE_NOT_CURRENT';
  return null;
}

/** Pure deterministic compiler: values in, private plan/result values out.
 * Provenance references are consistency inputs, never verified runtime facts.
 * No UUID/version/receipt generation, I/O, clocks, secrets or verifier callbacks.
 */
export function compileCasePlan(platformValue: unknown, documentsValue: unknown) {
  const invalid = (code: string) => ({ contract: COMPILER_CONTRACT, status: 'INVALID' as const,
    code, plan: null, plan_bytes: null, plan_sha256: null, case_results: [],
    reusable_as_live_authority: false as const, runtime_proof: 'NOT_RUN_NOT_PASS' as const });
  let platformHash: string, documentsHash: string;
  try { platformHash = contentHash(platformValue); documentsHash = contentHash(documentsValue); }
  catch { return invalid('INPUT_NOT_JSON'); }
  const pp = platformInputSchema.safeParse(platformValue), dd = documentsInputSchema.safeParse(documentsValue);
  if (!pp.success) return invalid('PLATFORM_INPUT_INVALID');
  if (!dd.success) return invalid('DOCUMENTS_INPUT_INVALID');
  const p = pp.data, d = dd.data;
  const authUrl = new URL(p.auth_provenance.origin);
  if (!['127.0.0.1', '[::1]'].includes(authUrl.hostname) || authUrl.protocol !== 'http:'
    || authUrl.username || authUrl.password || authUrl.search || authUrl.hash || authUrl.pathname !== '/') return invalid('PLATFORM_AUTH_REFERENCE_INVALID');
  if (d.platform_input_sha256 !== platformHash) return invalid('PLATFORM_INPUT_HASH_MISMATCH');
  if (!same(p.custody, d.custody)) return invalid('CUSTODY_BINDING_MISMATCH');
  const byName = new Map<CaseName, unknown>();
  for (const raw of d.cases) {
    const n = z.strictObject({ name: z.enum(CASE_NAMES) }).loose().safeParse(raw);
    if (!n.success || byName.has(n.data.name)) return invalid('CASE_SET_INVALID');
    byName.set(n.data.name, raw);
  }
  const rows: PlanRow[] = [];
  const results: CaseResult[] = [];
  for (const name of CASE_NAMES) {
    const parsed = caseInputSchema.safeParse(byName.get(name));
    if (!parsed.success) {
      rows.push(noData(name)); results.push(blocked(name, byName.has(name) ? 'CASE_INPUT_INVALID' : 'CASE_SOURCE_MISSING')); continue;
    }
    const c = parsed.data, error = checkCase(c, p, d);
    if (error) { rows.push(noData(name)); results.push(blocked(name, error,
      error.startsWith('CORE_') ? 'Core' : 'Documents', error.startsWith('CORE_') ? 'canonical Documents authority request and native fixture source binding' : 'exact Documents-owned case binding')); continue; }
    if (name.startsWith('historical_')) {
      const r = c.historical_reference;
      const missing = !r || c.receipt_id === null || c.receipt_hash === null;
      let code = missing ? 'CANONICAL_STORED_RELATION_MISSING' : 'CANONICAL_PERSISTED_RELATION_VERIFIER_UNAVAILABLE';
      if (r && (c.receipt_id !== r.core_receipt_id || c.receipt_hash !== r.core_receipt_hash)) code = 'HISTORICAL_RECEIPT_REFERENCE_MISMATCH';
      const cmd = coreTransactionCommandV2Schema.parse(c.command), guide = ce012GuideSaveCommandV1Schema.parse(c.guide_command);
      if (r && (!same(r.binding, { command_id: cmd.command_id, context_id: cmd.context_id, workspace_id: cmd.workspace_id,
        guide_id: guide.guide_id, document_id: guide.payload.document_target!.document_id,
        document_version_id: guide.payload.document_target!.document_version_id,
        document_version: guide.payload.document_target!.document_version,
        expected_guide_version: guide.expected_guide_version, payload_fingerprint: guide.payload_fingerprint,
        idempotency_key: guide.idempotency_key }))) code = 'HISTORICAL_RELATION_BINDING_MISMATCH';
      rows.push(noData(name)); results.push(blocked(name, code, HISTORICAL_DEPENDENCY.producer, HISTORICAL_DEPENDENCY.required_output));
      continue;
    }
    if (c.receipt_id !== null || c.receipt_hash !== null || c.historical_reference !== null) {
      rows.push(noData(name)); results.push(blocked(name, 'FRESH_CASE_HAS_HISTORICAL_EVIDENCE')); continue;
    }
    rows.push({ name, command: coreTransactionCommandV2Schema.parse(c.command),
      guide_command: ce012GuideSaveCommandV1Schema.parse(c.guide_command), receipt_id: null, receipt_hash: null });
    // A shape-valid plan is not evidence of current authority or an installed fixture.
    results.push({ name, outcome: 'COMPILED_SHAPE', code: null, producer: 'Documents', required_output: 'runtime revalidation remains mandatory' });
  }
  const plan = { contract: PLAN_CONTRACT, tenant_id: d.tenant_id, cases: rows };
  const planBytes = canonicalJson(plan);
  const planSha256 = createHash('sha256').update(planBytes, 'utf8').digest('hex');
  const inputSourceBinding = contentHash({ contract: COMPILER_CONTRACT, harness_source: HARNESS_SOURCE,
    harness_request_sha256: HARNESS_REQUEST_SHA256, runtime_closure_sha256: RUNTIME_CLOSURE_SHA256,
    platform_input_sha256: platformHash, documents_input_sha256: documentsHash, plan_sha256: planSha256 });
  return { contract: COMPILER_CONTRACT, status: results.some(r => r.outcome === 'COMPILED_SHAPE') ? 'PARTIAL' as const : 'BLOCKED' as const, code: null,
    harness_source: HARNESS_SOURCE, harness_request_sha256: HARNESS_REQUEST_SHA256,
    runtime_closure_sha256: RUNTIME_CLOSURE_SHA256,
    platform_input_sha256: platformHash, documents_input_sha256: documentsHash,
    plan, plan_bytes: planBytes, plan_sha256: planSha256, input_source_binding_sha256: inputSourceBinding,
    case_results: results, historical_dependency: HISTORICAL_DEPENDENCY,
    reusable_as_live_authority: false as const, runtime_proof: 'NOT_RUN_NOT_PASS' as const };
}

/** Validator regenerates the exact non-authorizing plan from both owned inputs.
 * A plan alone, a recomputed receipt hash or a changed custody cannot validate.
 */
export function validateCompiledPlan(platformValue: unknown, documentsValue: unknown, planValue: unknown, expectedPlanSha256: string, expectedInputSourceBindingSha256: string) {
  const compiled = compileCasePlan(platformValue, documentsValue);
  if (!compiled.plan || !digest.safeParse(expectedPlanSha256).success || !digest.safeParse(expectedInputSourceBindingSha256).success) return { valid: false, code: 'PLAN_OR_INPUT_INVALID', reusable_as_live_authority: false };
  try {
    if (canonicalJson(planValue) !== compiled.plan_bytes || contentHash(planValue) !== expectedPlanSha256
      || compiled.plan_sha256 !== expectedPlanSha256 || compiled.input_source_binding_sha256 !== expectedInputSourceBindingSha256) return { valid: false, code: 'PLAN_HASH_OR_INPUT_MISMATCH', reusable_as_live_authority: false };
  } catch { return { valid: false, code: 'PLAN_OR_INPUT_INVALID', reusable_as_live_authority: false }; }
  return { valid: true, code: 'VALID_NON_AUTHORIZING_PLAN', reusable_as_live_authority: false, runtime_proof: 'NOT_RUN_NOT_PASS' };
}

/** Strict JSON text boundary: JSON.parse validates syntax; this second bounded
 * traversal rejects duplicate keys before any source values can be compiled.
 * No reviver or caller callback is executed.
 */
export function parseInputJson(text: string): unknown {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 1048576) throw new Error('json_bound');
  const value: unknown = JSON.parse(text);
  let i = 0;
  const ws = () => { while (/\s/.test(text[i] ?? '') && i < text.length) i++; };
  const string = (): string => {
    const start = i++;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i++] === '"') return JSON.parse(text.slice(start, i));
    }
    throw new Error('invalid_json');
  };
  const scan = (depth: number): void => {
    if (depth > 64) throw new Error('json_bound');
    ws();
    if (text[i] === '{') {
      i++; ws(); const keys = new Set<string>();
      if (text[i] !== '}') for (;;) {
        const k = string(); if (keys.has(k)) throw new Error('duplicate_key'); keys.add(k);
        ws(); i++; scan(depth + 1); ws(); if (text[i] !== ',') break; i++; ws();
      }
      i++;
    } else if (text[i] === '[') {
      i++; ws(); if (text[i] !== ']') for (;;) { scan(depth + 1); ws(); if (text[i] !== ',') break; i++; }
      i++;
    } else if (text[i] === '"') string();
    else { while (i < text.length && !/[\s,}\]]/.test(text[i])) i++; }
  };
  scan(0); return value;
}
export function compileCasePlanJson(platformJson: string, documentsJson: string) {
  try {
    const compiled = compileCasePlan(parseInputJson(platformJson), parseInputJson(documentsJson));
    const rawPlatformHash = createHash('sha256').update(platformJson, 'utf8').digest('hex');
    const rawDocumentsHash = createHash('sha256').update(documentsJson, 'utf8').digest('hex');
    return { ...compiled, raw_platform_input_sha256: rawPlatformHash, raw_documents_input_sha256: rawDocumentsHash,
      raw_input_binding_sha256: compiled.plan ? contentHash({ input_source_binding_sha256: compiled.input_source_binding_sha256,
        raw_platform_input_sha256: rawPlatformHash, raw_documents_input_sha256: rawDocumentsHash }) : null };

  } catch { return { contract: COMPILER_CONTRACT, status: 'INVALID' as const, code: 'INPUT_JSON_INVALID_OR_DUPLICATE',
    plan: null, plan_bytes: null, plan_sha256: null, case_results: [], reusable_as_live_authority: false, runtime_proof: 'NOT_RUN_NOT_PASS' }; }
}

export function validateCompiledPlanJson(platformJson: string, documentsJson: string, planJson: string,
  expectedPlanSha256: string, expectedInputSourceBindingSha256: string, expectedRawInputBindingSha256: string) {
  try {
    const compiled = compileCasePlanJson(platformJson, documentsJson);
    if (!('raw_input_binding_sha256' in compiled) || compiled.raw_input_binding_sha256 !== expectedRawInputBindingSha256) {
      return { valid: false, code: 'RAW_INPUT_HASH_MISMATCH', reusable_as_live_authority: false };
    }
    const validation = validateCompiledPlan(parseInputJson(platformJson), parseInputJson(documentsJson), parseInputJson(planJson),
      expectedPlanSha256, expectedInputSourceBindingSha256);
    if (validation.valid && (planJson !== compiled.plan_bytes || createHash('sha256').update(planJson, 'utf8').digest('hex') !== expectedPlanSha256)) {
      return { valid: false, code: 'PLAN_BYTE_HASH_MISMATCH', reusable_as_live_authority: false };
    }
    return validation;
  } catch { return { valid: false, code: 'PLAN_OR_INPUT_INVALID', reusable_as_live_authority: false }; }
}
