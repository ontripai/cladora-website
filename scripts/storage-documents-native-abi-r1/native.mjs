// Real SDK worker. Entry is closed by curated admission AND the parent custody gate.
// Unit tests may import validators; they never stand in for native Storage/Auth.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { createRequire, isBuiltin } from 'node:module';
import Module from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export function need(v, message) { if (!v) throw new Error(message); }
export function failureEvidence(e, stage, phase) {
  return { phase, stage, name: String(e.name || 'Error'), code: e.code ?? null,
    cause_code: e.cause?.code ?? null, original_message: String(e.message || e) };
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LIMITS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/storage-documents-native-abi-r1/contract.json'))).capture;
const SDKROOT = '/workspace/cladora-website/node_modules';
const ORIGIN = 'http://127.0.0.1:55421';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const now = () => Date.now();

export function assertFixture(f) {
  need(Object.keys(f).sort().join(',') === 'actor_a,actor_b,bucket,path,run', 'FIXTURE_KEYS');
  need(/^[0-9a-f]{32}$/.test(f.run) && f.bucket === `platform15-${f.run}`, 'FIXTURE_BUCKET');
  need(f.path === 'owned/fixture.png' && UUID.test(f.actor_a) && UUID.test(f.actor_b)
    && f.actor_a !== f.actor_b, 'FIXTURE_ACTORS_PATH');
}

export function validateAck(raw, data, f) {
  need(raw && UUID.test(raw.Id) && raw.Key === `${f.bucket}/${f.path}`, 'UPLOAD_RAW_ACK');
  need(data && data.id === raw.Id && data.path === f.path && data.fullPath === raw.Key, 'UPLOAD_SDK_MAPPING');
  return raw.Id;
}

export function validateInfo(raw, data, f, id, bytes) {
  for (const k of ['id', 'name', 'bucket_id', 'content_type', 'size']) need(raw?.[k] != null, `INFO_MISSING_${k}`);
  need(raw.id === id && raw.name === f.path && raw.bucket_id === f.bucket, 'INFO_IDENTITY');
  need(raw.size === bytes.length && raw.content_type === 'image/png', 'INFO_SIZE_MIME');
  need(data.id === raw.id && data.name === raw.name && data.bucketId === raw.bucket_id
    && data.contentType === raw.content_type && data.size === raw.size, 'INFO_CAMEL_MAPPING');
  for (const k of ['version', 'etag']) need((data[k] ?? null) === (raw[k] ?? null), 'INFO_OPTIONAL_MAPPING');
  const state = (v, k) => !(k in v) ? 'MISSING' : v[k] === null ? 'NULL' : 'PRESENT';
  return Object.fromEntries(['version', 'etag'].map(k => [k, { raw: state(raw, k), sdk: state(data, k) }]));
}

export function validateDenied(result, response, kind) {
  need(result?.error && response && response.status >= 400 && response.status < 500, 'DENIAL_NOT_ESTABLISHED');
  // A malformed path/input/transport is not RLS denial. Duplicates may be409 or
  // provider's400 ResourceAlreadyExists; unauthorized private reads may be404.
  const code = String(result.error.statusCode ?? result.error.status ?? response.status);
  need(!['401', '408', '429'].includes(code) && ![401, 408, 429].includes(response.status), 'DENIAL_AUTH_TIMEOUT_OR_RATE_LIMIT');
  let raw;
  try { raw = JSON.parse(response.raw.toString('utf8')); } catch { throw new Error('DENIAL_ERROR_ABI_UNKNOWN'); }
  const label = String(raw.code ?? raw.error ?? '');
  const message = String(raw.message ?? '');
  need(!/jwt|expired token|invalid token/i.test(message), 'DENIAL_SESSION_INVALID');
  if (kind === 'duplicate') need(['Duplicate', 'ResourceAlreadyExists', 'KeyAlreadyExists'].includes(label), 'DUPLICATE_REASON_UNKNOWN');
  else need(['AccessDenied', 'Unauthorized', 'NoSuchKey', 'ObjectNotFound', 'not_found', ...(kind === 'anon-public' ? ['NoSuchBucket'] : [])].includes(label)
    || /row.level.security|permission denied/i.test(message), 'DENIAL_REASON_UNKNOWN');
  if (['duplicate', 'upsert', 'update'].includes(kind)) need(result.data == null, 'DENIED_MUTATION_RETURNED_DATA');
}

export function descriptor(actor, phase, method, rawUrl, f) {
  assertFixture(f);
  const u = new URL(rawUrl);
  need(u.origin === ORIGIN && !u.username && !u.password && !u.hash, 'FOREIGN_ORIGIN');
  const object = `/storage/v1/object/${f.bucket}/${f.path}`;
  const info = `/storage/v1/object/info/${f.bucket}/${f.path}`;
  const auth = /^([ab])-(login|user|claims|logout)$/.exec(phase);
  if (auth) {
    need(actor === auth[1], 'AUTH_ACTOR');
    const allowed = auth[2] === 'login' ? [['POST', '/auth/v1/token', '?grant_type=password']]
      : auth[2] === 'logout' ? [['POST', '/auth/v1/logout', '?scope=local']]
        : auth[2] === 'claims' ? [['GET', '/auth/v1/user', ''], ['GET', '/auth/v1/.well-known/jwks.json', '']]
          : [['GET', '/auth/v1/user', '']];
    need(allowed.some(([m, p, s]) => method === m && u.pathname === p && u.search === s), 'AUTH_ROUTE');
  } else {
    need(!u.search, 'STORAGE_QUERY_DENIED');
    const reads = /^check-(baseline|duplicate|upsert|update|foreign-info|foreign-download|anon-info|anon-download|anon-public)-(before|download|after)$/.exec(phase);
    if (reads) need(actor === 'a' && method === 'GET' && u.pathname === (reads[2] === 'download' ? object : info), 'OWNER_READ_ROUTE');
    else if (['upload', 'duplicate', 'upsert', 'update'].includes(phase)) need(actor === 'a' && method === (phase === 'update' ? 'PUT' : 'POST') && u.pathname === object, 'WRITE_ROUTE');
    else if (/^(foreign|anon)-(info|download)$/.test(phase)) need(actor === (phase.startsWith('foreign') ? 'b' : 'anon') && method === 'GET' && u.pathname === (phase.endsWith('info') ? info : object), 'NEGATIVE_READ_ROUTE');
    else if (phase === 'anon-public') need(actor === 'anon' && method === 'GET' && u.pathname === `/storage/v1/object/public/${f.bucket}/${f.path}`, 'PUBLIC_NEGATIVE_ROUTE');
    else if (phase === 'cleanup-object') need(actor === 'custodian' && method === 'DELETE' && u.pathname === `/storage/v1/object/${f.bucket}`, 'CLEAN_OBJECT_ROUTE');
    else if (phase === 'cleanup-bucket') need(actor === 'custodian' && method === 'DELETE' && u.pathname === `/storage/v1/bucket/${f.bucket}`, 'CLEAN_BUCKET_ROUTE');
    else throw new Error('PHASE_NOT_ADMITTED');
  }
  return { actor, phase, method, pathname: u.pathname, search: u.search };
}

export class Evidence {
  constructor(dir) {
    need(fs.realpathSync(dir) === dir && (fs.statSync(dir).mode & 0o077) === 0, 'EVIDENCE_CUSTODY');
    this.quarantined = false; this.lanes = {};
    this.used = { normal: 0, cleanup: 0 }; this.limits = { normal: LIMITS.normal_bytes, cleanup: LIMITS.cleanup_bytes };
    try {
      for (const lane of ['normal', 'cleanup']) this.lanes[lane] = { chain: '0'.repeat(64), seq: 0,
        fd: fs.openSync(path.join(dir, `sdk-http-${lane}.private.jsonl`), 'wx', 0o600) };
    } catch (e) { for (const l of Object.values(this.lanes)) fs.closeSync(l.fd); throw e; }
  }
  reserve(cleanup) {
    const lane = cleanup ? 'cleanup' : 'normal';
    need(cleanup || !this.quarantined, 'NORMAL_CAPTURE_QUARANTINED');
    need(this.used[lane] + LIMITS.slot_bytes <= this.limits[lane], 'HTTP_CAPTURE_CAPACITY_HOLD');
    this.used[lane] += LIMITS.slot_bytes; // never refunded/reused; independent cleanup reserve
  }
  record(value, cleanup = false) {
    need(cleanup || !this.quarantined, 'NORMAL_CAPTURE_QUARANTINED');
    const name = cleanup ? 'cleanup' : 'normal'; const l = this.lanes[name];
    const entry = { lane: name, sequence: l.seq + 1, previous: l.chain,
      normal_quarantined: this.quarantined, normal_stable_anchor: this.lanes.normal.chain, ...value };
    const bytes = Buffer.from(JSON.stringify(entry));
    const line = Buffer.concat([bytes, Buffer.from('\n')]);
    try {
      need(bytes.length < LIMITS.slot_bytes, 'HTTP_ENVELOPE_BREACH_UNKNOWN');
      need(fs.writeSync(l.fd, line) === line.length, 'HTTP_SHORT_WRITE_UNKNOWN'); fs.fsyncSync(l.fd);
      l.chain = sha(bytes); l.seq++;
    }
    catch (e) { this.quarantined = true; throw e; }
  }
  close() { let first; for (const l of Object.values(this.lanes)) { try { fs.closeSync(l.fd); } catch (e) { first ??= e; } } if (first) throw first; }
}

async function bodyBounded(response) {
  const reader = response.body?.getReader();
  const chunks = []; let n = 0;
  if (!reader) return Buffer.alloc(0);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      n += value.length;
      need(n <= LIMITS.response_body_bytes, 'HTTP_BODY_CAPTURE_BREACH_UNKNOWN');
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

function installSdkPins() {
  const pins = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/storage-documents-native-abi-r1/sdk-pins.json')));
  function check(file) {
    need(file.startsWith(SDKROOT + '/') && fs.realpathSync(file) === file, 'SDK_EXTERNAL_ALIAS');
    const rel = path.relative(SDKROOT, file); const pin = pins.files[rel];
    need(pin && fs.statSync(file).nlink === 1, 'SDK_UNPINNED_FILE');
    const b = fs.readFileSync(file); need(b.length === pin.bytes && sha(b) === pin.sha256, 'SDK_FILE_DRIFT');
  }
  for (const name of Object.keys(pins.files)) check(path.join(SDKROOT, name));
  const original = Module._load;
  Module._load = function (specifier, parent, isMain) {
    if (!isBuiltin(specifier)) check(Module._resolveFilename(specifier, parent, isMain));
    return Reflect.apply(original, this, [specifier, parent, isMain]);
  };
  const req = createRequire('/workspace/cladora-website/package.json');
  const sdk = req('@supabase/supabase-js');
  return { createClient: sdk.createClient, restore: () => { Module._load = original; } };
}

async function runNative(ctx, gate, currentness) {
  assertFixture(ctx.fixture); const f = ctx.fixture;
  need(ctx.origin === ORIGIN && ctx.worker_pid === process.pid, 'WORKER_BINDING');
  const result = { status: 'NOT_RUN', stages: {}, cleanup: {}, first_error: null, unknown: false, assurance: 'NOT_OBSERVED' };
  const tokens = {}; const clients = {}; const phases = {}; const seen = new Set(); const responses = {};
  const input = Buffer.from(ctx.fixture_bytes_base64, 'base64');
  const replacement = Buffer.from(ctx.replacement_bytes_base64, 'base64');
  need(input.length > 0 && input.length < 4096 && replacement.length < 4096 && sha(input) !== sha(replacement), 'FIXTURE_BYTES');
  const evidence = new Evidence(ctx.output);
  const sdk = installSdkPins();
  let completed = false;
  function fail(e) { result.first_error ??= String(e.message || e); result.unknown ||= evidence.quarantined || /UNKNOWN|BREACH|TIMEOUT|QUARANTIN/.test(String(e.message)); result.status = result.unknown ? 'UNKNOWN' : 'FAILED'; }
  function fetchFor(actor) {
    return async (url, init = {}) => {
      const phase = phases[actor];
      try {
      const cleanup = phase?.startsWith('cleanup-') || phase?.endsWith('-logout');
      const method = (init.method || 'GET').toUpperCase();
      const d = descriptor(actor, phase, method, String(url), f);
      const key = JSON.stringify(d); need(!seen.has(key), 'NO_AUTOMATIC_RESEND');
      const headers = new Headers(init.headers);
      const expected = actor === 'custodian' ? ctx.service_key : actor === 'anon' || phase.endsWith('-login') ? ctx.anon_key : tokens[actor];
      need(expected && headers.get('authorization') === `Bearer ${expected}`, 'CONSUMER_PRINCIPAL_BINDING');
      need(headers.get('apikey') === (actor === 'custodian' ? ctx.service_key : ctx.anon_key), 'API_BINDING_NO_SERVICE_CONSUMER');
      if (phase.endsWith('-login')) {
        const login = JSON.parse(init.body);
        need(login.email === ctx.users[actor].email && login.password === ctx.users[actor].password, 'LOGIN_ACTOR_BINDING');
      }
      if (phase === 'upload' || phase === 'duplicate' || phase === 'upsert' || phase === 'update') {
        need(headers.get('content-type') === 'image/png' && Buffer.isBuffer(init.body), 'UPLOAD_INPUT_TYPE');
        need(sha(init.body) === sha(phase === 'upload' ? input : replacement), 'UPLOAD_BYTES_BINDING');
        need(phase === 'update' || headers.get('x-upsert') === String(phase === 'upsert'), 'UPSERT_BINDING');
      }
      if (phase === 'cleanup-object') need(init.body === JSON.stringify({ prefixes: [f.path] }), 'CLEANUP_PREFIX_SCOPE');
      evidence.reserve(cleanup);
      // Parent rechecks current review, exact source/SDK and live custody for EVERY HTTP effect.
      const permit = await gate({ kind: 'http', ...d, cleanup });
      need(permit.expires_at > now() || cleanup && permit.cleanup_only === true, 'EFFECT_EXPIRED');
      need(permit.run === f.run && permit.request_sha256 === ctx.request_sha256, 'EFFECT_BINDING');
      currentness(cleanup);
      seen.add(key); evidence.record({ type: 'dispatch_intent', ...d, cleanup }, cleanup);
      // fsync and the asynchronous parent check do not extend the original ceiling.
      currentness(cleanup);
      let ioStage = 'driver';
      try {
        const response = await fetch(url, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
        ioStage = 'body_capture';
        const raw = await bodyBounded(response.clone());
        // Never retain Auth token/user response bodies. Storage raw evidence is private and lossless within the cap.
        const record = { type: 'response', ...d, status: response.status,
          content_type: response.headers.get('content-type'), bytes: raw.length, sha256: sha(raw),
          raw_base64: d.pathname.startsWith('/storage/') ? raw.toString('base64') : null,
          auth_body_retention: d.pathname.startsWith('/auth/') ? 'NOT_RETAINED' : null };
        ioStage = 'persistence';
        evidence.record(record, cleanup); responses[phase] = { ...record, raw };
        return response;
      } catch (e) {
        evidence.quarantined = true;
        result.transport_failures ??= [];
        result.transport_failures.push(failureEvidence(e, ioStage, phase));
        // Keep the actual first cause even when the SDK wraps a fetch rejection.
        throw new Error(`HTTP_UNKNOWN_${ioStage}:${e.code || e.name}:${e.message}`);
      }
      } catch (e) {
        result.first_error ??= `${phase}:${e.message || e}`;
        result.unknown ||= evidence.quarantined || /UNKNOWN|BREACH|TIMEOUT|QUARANTIN/.test(String(e.message));
        throw e;
      }
    };
  }
  async function action(actor, phase, operation) {
    need(!completed || phase.startsWith('cleanup-') || phase.endsWith('-logout'), 'POST_SETTLEMENT_OPERATION');
    phases[actor] = phase;
    const value = await operation();
    need(responses[phase], 'MISSING_HTTP_EVIDENCE');
    return value;
  }
  const jsonRaw = phase => JSON.parse(responses[phase].raw.toString('utf8'));
  try {
    await gate({ kind: 'worker_creation', cleanup: false });
    for (const actor of ['a', 'b']) {
      currentness(false);
      clients[actor] = sdk.createClient(ORIGIN, ctx.anon_key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchFor(actor) } });
      const login = await action(actor, `${actor}-login`, () => clients[actor].auth.signInWithPassword(ctx.users[actor]));
      need(!login.error && login.data.session?.access_token && login.data.user?.id === f[`actor_${actor}`], 'REAL_LOGIN_FAILED');
      tokens[actor] = login.data.session.access_token;
      const user = await action(actor, `${actor}-user`, () => clients[actor].auth.getUser(tokens[actor]));
      need(!user.error && user.data.user?.id === f[`actor_${actor}`], 'REAL_CURRENT_USER_FAILED');
      const claims = await action(actor, `${actor}-claims`, () => clients[actor].auth.getClaims(tokens[actor]));
      const c = claims.data?.claims;
      need(!claims.error && c?.sub === f[`actor_${actor}`] && c.role === 'authenticated' && c.iss === ORIGIN + '/auth/v1'
        && UUID.test(c.session_id) && c.exp * 1000 > now() + 60000 && c.aal === 'aal1', 'AUTH_CLAIMS_BINDING');
      result.stages[`${actor}_session`] = { status: 'OBSERVED_REAL_AUTH', session_id: c.session_id, assurance: c.aal };
    }
    result.assurance = 'REAL_AAL1_ONLY_AAL2_NOT_TESTED';
    currentness(false);
    clients.anon = sdk.createClient(ORIGIN, ctx.anon_key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchFor('anon') } });
    const own = clients.a.storage.from(f.bucket);
    const upload = await action('a', 'upload', () => own.upload(f.path, input, { upsert: false, contentType: 'image/png' }));
    need(!upload.error, 'NATIVE_UPLOAD_FAILED');
    const id = validateAck(jsonRaw('upload'), upload.data, f);
    result.stages.upload = { status: 'ACK_VALIDATED', id, path: upload.data.path, fullPath: upload.data.fullPath };
    let baseline;
    async function preserved(label) {
      const before = await action('a', `check-${label}-before`, () => own.info(f.path));
      need(!before.error, 'INFO_FAILED');
      const raw = jsonRaw(`check-${label}-before`);
      const optional = validateInfo(raw, before.data, f, id, input);
      const download = await action('a', `check-${label}-download`, () => own.download(f.path));
      need(!download.error && download.data instanceof Blob && download.data.type === 'image/png', 'DOWNLOAD_MIME');
      const b = Buffer.from(await download.data.arrayBuffer());
      need(b.equals(input) && sha(b) === sha(input), 'DOWNLOAD_BYTES');
      const after = await action('a', `check-${label}-after`, () => own.info(f.path));
      need(!after.error, 'INFO_AFTER_FAILED');
      validateInfo(jsonRaw(`check-${label}-after`), after.data, f, id, input);
      const stable = v => JSON.stringify([v.id, v.name, v.bucketId, v.size, v.contentType, v.version ?? null, v.etag ?? null]);
      need(stable(before.data) === stable(after.data), 'INFO_CHANGED_DURING_READBACK');
      baseline ??= stable(before.data);
      need(stable(before.data) === baseline, 'ORIGINAL_ID_GENERATION_BYTES_CHANGED');
      result.stages[`preserved_${label}`] = { status: 'MATCH', sha256: sha(b), bytes: b.length, optional_fields: optional };
    }
    await preserved('baseline');
    for (const phase of ['duplicate', 'upsert', 'update']) {
      const r = await action('a', phase, () => phase === 'update'
        ? own.update(f.path, replacement, { contentType: 'image/png' })
        : own.upload(f.path, replacement, { upsert: phase === 'upsert', contentType: 'image/png' }));
      validateDenied(r, responses[phase], phase);
      result.stages[phase] = { status: 'DENIED', http_status: responses[phase].status, code: r.error.statusCode ?? null };
      await preserved(phase);
    }
    for (const actor of ['b', 'anon']) for (const method of ['info', 'download']) {
      const phase = `${actor === 'b' ? 'foreign' : 'anon'}-${method}`;
      const r = await action(actor, phase, () => clients[actor].storage.from(f.bucket)[method](f.path));
      validateDenied(r, responses[phase], phase);
      result.stages[phase] = { status: 'DENIED', http_status: responses[phase].status, code: r.error.statusCode ?? null };
      await preserved(phase);
    }
    const publicUrl = clients.anon.storage.from(f.bucket).getPublicUrl(f.path).data.publicUrl;
    const publicResult = await action('anon', 'anon-public', async () => {
      const r = await fetchFor('anon')(publicUrl, { method: 'GET', headers: { apikey: ctx.anon_key, Authorization: `Bearer ${ctx.anon_key}` } });
      return { data: r.ok ? 'UNEXPECTED_PUBLIC_BYTES' : null, error: r.ok ? null : { statusCode: String(r.status) } };
    });
    validateDenied(publicResult, responses['anon-public'], 'anon-public');
    result.stages['anon-public'] = { status: 'DENIED', http_status: responses['anon-public'].status, source: 'SDK-generated public URL plus real GET; not getPublicUrl alone' };
    await preserved('anon-public');
    result.status = 'NATIVE_CASES_OBSERVED_PENDING_CLEANUP';
  } catch (e) { fail(e); }
  finally {
    completed = true;
    // Separate custodian only for exact cleanup. Never supplies a consumer result.
    try {
      currentness(true);
      clients.custodian = sdk.createClient(ORIGIN, ctx.service_key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchFor('custodian') } });
      const removed = await action('custodian', 'cleanup-object', () => clients.custodian.storage.from(f.bucket).remove([f.path]));
      need(!removed.error, 'OBJECT_CLEANUP_FAILED');
      if (result.stages.upload?.id) need(Array.isArray(removed.data) && removed.data.length === 1
        && removed.data[0].id === result.stages.upload.id && removed.data[0].name === f.path, 'CLEANUP_OBJECT_ACK_IDENTITY_UNKNOWN');
      result.cleanup.object = 'ACKNOWLEDGED_METADATA_AND_PROVIDER_DELETE_REQUEST';
      const bucket = await action('custodian', 'cleanup-bucket', () => clients.custodian.storage.deleteBucket(f.bucket));
      need(!bucket.error, 'BUCKET_CLEANUP_FAILED');
      result.cleanup.bucket = 'ACKNOWLEDGED';
    } catch (e) {
      const unknown = evidence.quarantined || !responses[phases.custodian] || /UNKNOWN/.test(String(e.message));
      result.cleanup.storage = unknown ? 'UNKNOWN' : 'FAILED'; result.cleanup.storage_error = String(e.message);
      result.unknown ||= unknown; result.first_error ??= String(e.message);
    }
    for (const actor of ['a', 'b']) {
      if (!tokens[actor]) { result.cleanup[`${actor}_session`] = [...seen].some(k => JSON.parse(k).phase === `${actor}-login`) ? 'UNKNOWN_LOGIN_DISPATCH_WITHOUT_SESSION_HANDLE' : 'NOT_CREATED'; continue; }
      try {
        const r = await action(actor, `${actor}-logout`, () => clients[actor].auth.signOut({ scope: 'local' }));
        need(!r.error, 'LOCAL_SIGNOUT_FAILED'); result.cleanup[`${actor}_session`] = 'LOCAL_SIGNOUT_ACK_ACCESS_JWT_NOT_IMMEDIATELY_REVOKED';
      } catch (e) { result.cleanup[`${actor}_session`] = 'UNKNOWN'; result.unknown = true; result.first_error ??= String(e.message); }
    }
    result.http_evidence_chain = Object.fromEntries(Object.entries(evidence.lanes).map(([name, l]) => [name, { chain: l.chain, sequence: l.seq }])); result.reserved_capture = evidence.used;
    try { evidence.close(); } catch (e) { result.first_error ??= String(e.message); }
    sdk.restore();
    if (result.first_error) result.status = result.unknown ? 'UNKNOWN' : 'FAILED';
  }
  return result;
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === '--loader-check') {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => { throw new Error('LOADER_CHECK_NETWORK_DENIED'); };
    try {
      const sdk = installSdkPins();
      try { need(typeof sdk.createClient === 'function', 'SDK_EXPORT');
        process.stdout.write('PINNED_LOADER_PASS_NATIVE_NOT_RUN\n');
      } finally { sdk.restore(); }
    } finally { globalThis.fetch = originalFetch; }
    return;
  }
  need(process.argv.length === 2, 'ARGUMENTS_DENIED');
  const reader = readline.createInterface({ input: process.stdin });
  const iterator = reader[Symbol.asyncIterator]();
  const first = await iterator.next(); need(!first.done, 'PRIVATE_PARENT_REQUIRED');
  const ctx = JSON.parse(first.value); need(ctx.type === 'start', 'PRIVATE_PARENT_START');
  const registry = path.join(ROOT, 'scripts/storage-documents-native-abi-r1/reviews.json');
  const candidatePath = '/workspace/private/platform-storage-documents-native-abi-15/acl-r1/candidate/execution-request.json';
  const requestBytes = fs.readFileSync(candidatePath); const candidate = JSON.parse(requestBytes);
  need(sha(requestBytes) === ctx.request_sha256 && JSON.stringify(ctx.fixture) === JSON.stringify(candidate.fixture)
    && ctx.source_seal === candidate.source_seal && ctx.output === `/workspace/private/platform-storage-documents-native-abi-15/acl-r1/run-${candidate.fixture.run}`, 'EXACT_PRIVATE_CANDIDATE_REQUIRED');
  for (const [name, field] of [['original', 'fixture_bytes_base64'], ['replacement', 'replacement_bytes_base64']]) {
    const b = Buffer.from(ctx[field], 'base64');
    need(b.length === candidate.input_bytes[name].bytes && sha(b) === candidate.input_bytes[name].sha256, 'PINNED_SYNTHETIC_INPUT_BYTES');
  }
  const privateJson = p => {
    need(fs.realpathSync(p) === p && fs.statSync(p).nlink === 1
      && fs.statSync(p).uid === process.getuid() && (fs.statSync(p).mode & 0o077) === 0, 'PRIVATE_BINDING_CUSTODY');
    return JSON.parse(fs.readFileSync(p));
  };
  const claim = privateJson(path.join(ctx.output, 'attempt.claim.json'));
  need(ctx.parent_pid === process.ppid && claim.parent_pid === process.ppid && claim.request_sha256 === ctx.request_sha256, 'PARENT_RUN_CLAIM');
  const parentCwd = fs.realpathSync(`/proc/${process.ppid}/cwd`);
  const parentArgs = fs.readFileSync(`/proc/${process.ppid}/cmdline`).toString().split('\0').filter(Boolean);
  need(fs.realpathSync(`/proc/${process.ppid}/exe`) === candidate.tools.python.path && parentCwd === ROOT
    && parentArgs.length === 3 && path.resolve(parentCwd, parentArgs[1]) === path.join(ROOT, 'scripts/storage-documents-native-abi-r1/harness.py')
    && parentArgs[2] === '--run', 'EXACT_PARENT_ENTRY');
  const local = '/workspace/private/cladora-functional-dev-v1';
  const users = privateJson(path.join(local, 'users.json')).users;
  const credentials = privateJson(path.join(local, 'secrets.json'));
  need(ctx.anon_key === credentials.anon_key && ctx.service_key === credentials.service_key, 'LOCAL_BINDING_SELECTOR');
  for (const [i, actor] of ['a', 'b'].entries()) need(users[i].id === ctx.fixture[`actor_${actor}`]
    && users[i].email === ctx.users[actor].email && credentials[users[i].password_key] === ctx.users[actor].password, 'EXACT_EXISTING_SYNTHETIC_ACTOR');
  const record = JSON.parse(fs.readFileSync(registry)).reviews[ctx.request_sha256];
  need(record && record.source_seal === ctx.source_seal && record.single_use === true, 'HOLD_NO_CURATED_REVIEW');
  const initialReview = JSON.stringify(record);
  const currentness = cleanup => {
    need(JSON.stringify(JSON.parse(fs.readFileSync(registry)).reviews[ctx.request_sha256]) === initialReview, 'CURATED_REVIEW_CHANGED');
    need(sha(fs.readFileSync(candidatePath)) === ctx.request_sha256, 'PRIVATE_REQUEST_CHANGED');
    need(cleanup && record.cleanup_only_after_expiry === true || record.expires_at * 1000 > now(), 'AUTHORIZATION_CEILING_EXPIRED');
    const seal = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/storage-documents-native-abi-r1/source-seal.json')));
    need(seal.sha256 === ctx.source_seal, 'SEAL_CHANGED');
    need(sha(Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(seal.files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))))) === seal.sha256, 'SEAL_ENCODING_CHANGED');
    for (const [name, hash] of Object.entries(seal.files)) {
      const p = path.join(ROOT, name);
      need(p.startsWith(ROOT + '/') && fs.realpathSync(p) === p && sha(fs.readFileSync(p)) === hash, 'SOURCE_CHANGED_AT_EFFECT');
    }
  };
  currentness(false);
  let sequence = 0;
  const gate = async d => {
    const seq = ++sequence; process.stdout.write(JSON.stringify({ type: 'gate', sequence: seq, ...d }) + '\n');
    const next = await iterator.next(); need(!next.done, 'PARENT_ACK_UNKNOWN');
    const value = JSON.parse(next.value); need(value.type === 'gate_ack' && value.sequence === seq, 'PARENT_CORRELATION');
    need(value.ok === true, 'PARENT_ADMISSION_HOLD'); return value;
  };
  const result = await runNative(ctx, gate, currentness);
  process.stdout.write(JSON.stringify({ type: 'result', result }) + '\n');
  reader.close(); process.exitCode = result.first_error ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { process.stderr.write('NATIVE_WORKER_HOLD_OR_UNKNOWN_PRIVATE_RECEIPT_REQUIRED\n'); process.exitCode = 2; });
}
