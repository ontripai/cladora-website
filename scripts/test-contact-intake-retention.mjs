/** Actual contact handler + security helpers; in-memory persistence, no live transports. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';

const filename = fileURLToPath(import.meta.url);
const root = resolve(dirname(filename), '..');
// Never inherit real notifier/Supabase/lead secrets. Only the child sees synthetic configuration.
if (!process.argv.includes('--isolated')) {
  const result = spawnSync(process.execPath, [filename, '--isolated', ...process.argv.slice(2)], {
    encoding: 'utf8', env: { PATH: process.env.PATH, NODE_ENV: 'test' },
  });
  if (result.error) throw result.error;
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const require = createRequire(import.meta.url);
const ts = require('typescript');
const { NextRequest } = require('next/server.js');
const originalConsole = { error: console.error, warn: console.warn };
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
const realDateNow = Date.UTC(2026, 9, 31, 9, 0, 0);
Date.now = () => realDateNow;

const ENV = {
  NODE_ENV: 'test', NEXT_PUBLIC_SITE_URL: 'https://contact.test.invalid',
  NEXT_PUBLIC_SUPABASE_URL: 'https://contact-store.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-fixture',
  SUPABASE_SECRET_KEY: 'synthetic-admin-fixture-not-a-credential',
  LEAD_IP_HASH_SECRET: 'contact-retention-test-only-hmac-fixture-32-plus',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'synthetic-site-fixture',
  TURNSTILE_SECRET_KEY: 'synthetic-turnstile-fixture', TURNSTILE_REQUIRED: 'true',
};
let state;
function reset(options = {}) {
  for (const key of Object.keys(process.env)) if (key !== 'PATH') delete process.env[key];
  Object.assign(process.env, ENV);
  state = {
    rows: [], inserts: [], updates: [], notifications: [], rate: [], captcha: [], logs: [], refs: [],
    status: 'sent', insertErrors: [], updateMode: 'ok', rateCount: 1, captchaResult: { success: true },
    ...options,
  };
}
console.error = (...args) => state.logs.push(['error', ...args]);
console.warn = (...args) => state.logs.push(['warn', ...args]);
const clone = value => structuredClone(value);
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify', 'unexpected network target');
  assert.equal(options.method, 'POST');
  assert.equal(options.body.get('secret'), ENV.TURNSTILE_SECRET_KEY);
  assert.equal(options.body.get('response'), 'synthetic-response-fixture');
  state.captcha.push({ method: options.method });
  return Response.json(state.captchaResult);
};
const admin = {
  rpc: async (name, args) => {
    assert.equal(name, 'consume_marketing_rate_limit');
    assert.match(args.p_action_key, /^contact:[0-9a-f]{64}$/);
    assert.equal(args.p_max_requests, 5);
    state.rate.push(clone(args));
    if (state.rateError) return { data: null, error: { code: 'fixture', message: 'synthetic RPC failure' } };
    return { data: [{ allowed: state.rateCount <= 5, current_count: state.rateCount, retry_after_seconds: 37 }], error: null };
  },
  from: table => {
    assert.equal(table, 'marketing_leads');
    return {
      insert: async value => {
        // JSONB insert/update receive snapshots; replacement is not a recursive merge.
        state.inserts.push(clone(value));
        const error = state.insertErrors.shift();
        if (error === 'throw') throw Error('synthetic persistence exception');
        if (error) return { error };
        if (state.rows.some(row => row.submission_fingerprint === value.submission_fingerprint && row.fingerprint_bucket === value.fingerprint_bucket)) {
          return { error: { code: '23505', message: 'idx_marketing_leads_fingerprint_bucket' } };
        }
        state.rows.push(clone(value));
        return { error: null };
      },
      update: patch => ({ eq: async (key, id) => {
        assert.equal(key, 'reference_id');
        state.updates.push({ patch: clone(patch), id });
        if (state.updateMode === 'throw') throw Error('synthetic update exception');
        if (state.updateMode === 'error') return { error: { code: 'fixture', message: 'synthetic update failure' } };
        const row = state.rows.find(item => item.reference_id === id);
        assert.ok(row, 'update must target the saved reference');
        Object.assign(row, clone(patch));
        return { error: null };
      } }),
    };
  },
};

const actualSources = new Map();
const modules = new Map();
const sourcePaths = new Set([
  'src/app/api/public/contact/route.ts', 'src/lib/security/origin.ts',
  'src/lib/security/ip-hash.ts', 'src/lib/security/reference-id.ts',
  'src/lib/security/fingerprint.ts', 'src/lib/security/rate-limiter.ts',
  'src/lib/security/turnstile-server.ts', 'src/lib/security/request-body.ts',
  'src/lib/security/lead-security-config.ts', 'src/lib/supabase/env.ts', 'src/config/rate-limits.ts',
]);
function load(path) {
  const relative = path.slice(root.length + 1).replaceAll('\\', '/');
  if (relative === 'src/lib/supabase/admin.ts') return { createAdminClient: () => admin };
  if (relative === 'src/lib/notifications/lead-notifier.ts') return { notifyNewLead: async payload => {
    assert.equal(state.rows.length > 0, true, 'persist before notify');
    state.notifications.push(clone(payload));
    return { status: state.status, attemptedAt: '2026-10-31T09:00:01.000Z', ...(state.status === 'failed' ? { errorCode: 'SYNTHETIC_NOTIFICATION_FAILURE' } : {}) };
  } };
  assert.ok(sourcePaths.has(relative), `unexpected source import ${relative}`);
  if (modules.has(path)) return modules.get(path).exports;
  const source = readFileSync(path, 'utf8');
  actualSources.set(relative, createHash('sha256').update(source).digest('hex'));
  const mod = new Module(path);
  modules.set(path, mod);
  mod.require = specifier => {
    if (specifier.startsWith('.')) return load(resolve(dirname(path), specifier));
    if (specifier === 'node:crypto' && relative.endsWith('/reference-id.ts')) return {
      randomBytes: count => state.refs.length ? state.refs.shift() : randomBytes(count),
    };
    assert.ok(['node:crypto', 'next/server.js', 'zod'].includes(specifier), `unexpected package import ${specifier}`);
    return require(specifier);
  };
  mod._compile(ts.transpileModule(source, {
    fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, path);
  return mod.exports;
}

const fields = {
  fullName: 'Synthetic Contact Fixture', email: 'CONTACT-FIXTURE@example.invalid', phone: '+40 700 000 001',
  message: 'Synthetic intake request; no customer information.', locale: 'fa', sourcePage: '/fa/contact',
  consentPrivacy: true, turnstileToken: 'synthetic-response-fixture',
  role: 'association_board', propertyType: 'mixed_use', portfolioScope: 'multi_building_portfolio',
  stage: 'active_management', services: ['community_experience'], workspaceStatus: 'new_workspace',
  city: 'Synthetic City', unitsCount: '48', utm_source: 'synthetic', utm_medium: 'test', utm_campaign: 'retention',
};
const keys = ['role', 'propertyType', 'portfolioScope', 'stage', 'services', 'workspaceStatus', 'city', 'unitsCount'];
const structured = payload => Object.fromEntries(keys.map(key => [key, key === 'services' ? payload[key] ?? [] : payload[key]?.trim() || null]));
const notificationFree = metadata => { const result = clone(metadata); delete result.notification; return result; };
function request(payload = fields, headers = {}, body) {
  const combined = { origin: ENV.NEXT_PUBLIC_SITE_URL, 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.42', 'user-agent': 'SyntheticRetentionFixture', ...headers };
  for (const [key, value] of Object.entries(combined)) if (value === null) delete combined[key];
  return new NextRequest('https://contact.test.invalid/api/public/contact', { method: 'POST', headers: combined, ...(body === null ? {} : { body: body ?? JSON.stringify(payload) }) });
}

const checks = [];
async function check(name, fn) { await fn(); checks.push(name); }
try {
  reset();
  const { POST } = load(resolve(root, 'src/app/api/public/contact/route.ts'));
  const invoke = async (payload = fields, headers = {}, body) => {
    const response = await POST(request(payload, headers, body));
    return { response, body: await response.json() };
  };
  if (process.argv.includes('--expect-metadata-loss')) {
    const answer = await invoke();
    assert.equal(answer.response.status, 200);
    assert.deepEqual(state.inserts[0].metadata.structuredIntake, structured(fields));
    assert.equal(state.rows[0].metadata.structuredIntake, undefined);
    assert.equal(state.updates.length, 1);
    console.log(JSON.stringify({ mode: 'BASE_COUNTEREXAMPLE', observed: 'INSERT_HAS_STRUCTURED_INTAKE_UPDATE_REMOVES_IT', insert: true, update: true, status: 200, evidence: 'ACTUAL_HANDLER_CONTROLLED_MEMORY_ONLY' }));
  } else {
    for (const services of [['community_experience'], ['community_experience', 'airprop', 'service', 'operations', 'finance', 'governance']]) {
      for (const status of ['sent', 'skipped_no_config', 'failed']) {
        await check(`retain ${services.length} service(s), notification ${status}`, async () => {
          reset({ status });
          const payload = { ...fields, services };
          const { response, body } = await invoke(payload);
          assert.equal(response.status, 200); assert.equal(body.ok, true);
          const row = state.rows[0], inserted = state.inserts[0];
          assert.equal(state.rows.length, 1); assert.equal(state.updates.length, 1); assert.equal(state.notifications.length, 1);
          assert.deepEqual(row.metadata.structuredIntake, structured(payload));
          assert.deepEqual(notificationFree(row.metadata), notificationFree(inserted.metadata));
          assert.deepEqual(Object.keys(state.updates[0].patch), ['metadata']);
          assert.deepEqual({ ...row, metadata: inserted.metadata }, inserted);
          assert.deepEqual(row.metadata.notification, { status, attemptedAt: '2026-10-31T09:00:01.000Z', errorCode: status === 'failed' ? 'SYNTHETIC_NOTIFICATION_FAILURE' : null });
          assert.equal(inserted.metadata.notification.status, 'pending');
          assert.equal(row.message, fields.message); assert.equal(state.notifications[0].message, fields.message);
          assert.equal(row.email, fields.email.toLowerCase()); assert.equal(row.applicant_type, 'association');
          assert.equal(row.requested_workspace_type, 'mixed'); assert.equal(row.units_count, 48);
          assert.equal(body.referenceId, row.reference_id); assert.equal(state.notifications[0].referenceId, row.reference_id);
          assert.match(body.referenceId, /^CLD-C[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
          assert.match(row.ip_hash, /^[a-f0-9]{64}$/); assert.notEqual(row.ip_hash, '198.51.100.42');
          assert.equal(response.headers.get('X-RateLimit-Limit'), '5');
          assert.equal(response.headers.get('X-RateLimit-Remaining'), '4');
        });
      }
    }
    await check('schema trimming and empty optional intake are preserved', async () => {
      reset(); const payload = { ...fields, services: [' community_experience '], role: ' owner_single ', unitsCount: ' 2 ', city: ' Fixture ' };
      assert.equal((await invoke(payload)).response.status, 200);
      assert.deepEqual(state.rows[0].metadata.structuredIntake, { ...structured(payload), services: ['community_experience'] });
      reset(); const minimal = { ...fields }; for (const key of keys) delete minimal[key];
      assert.equal((await invoke(minimal)).response.status, 200);
      assert.deepEqual(state.rows[0].metadata.structuredIntake, structured(minimal));
    });
    for (const mode of ['error', 'throw']) await check(`metadata update ${mode} keeps persisted lead successful`, async () => {
      reset({ updateMode: mode, status: 'failed' }); const answer = await invoke();
      assert.equal(answer.response.status, 200); assert.equal(answer.body.referenceId, state.rows[0].reference_id);
      assert.deepEqual(state.rows[0], state.inserts[0]); assert.equal(state.rows[0].metadata.notification.status, 'pending');
      assert.deepEqual(state.rows[0].metadata.structuredIntake, structured(fields));
    });
    for (const error of [{ code: '42501', message: 'synthetic persistence failure' }, 'throw']) await check(`persistence ${typeof error} stays failed without notification`, async () => {
      reset({ insertErrors: [error] }); const answer = await invoke();
      assert.equal(answer.response.status, 500); assert.equal(answer.body.code, 'SUBMISSION_FAILED');
      assert.equal(state.rows.length, 0); assert.equal(state.notifications.length, 0); assert.equal(state.updates.length, 0);
    });
    const collision = { code: '23505', details: 'reference_id synthetic collision' };
    await check('reference collision retry uses successful reference for notification/update/response', async () => {
      reset({ insertErrors: [collision], refs: [Buffer.alloc(8, 0), Buffer.alloc(8, 1)] });
      const answer = await invoke(); assert.equal(answer.response.status, 200); assert.equal(state.inserts.length, 2);
      assert.notEqual(state.inserts[0].reference_id, state.inserts[1].reference_id);
      assert.deepEqual(state.inserts[0].metadata, state.inserts[1].metadata);
      assert.equal(answer.body.referenceId, state.inserts[1].reference_id);
      assert.equal(state.updates[0].id, answer.body.referenceId); assert.equal(state.notifications[0].referenceId, answer.body.referenceId);
      assert.deepEqual(state.rows[0].metadata.structuredIntake, structured(fields));
    });
    await check('reference collision exhaustion stays failed', async () => {
      reset({ insertErrors: [collision, collision, collision] }); const answer = await invoke();
      assert.equal(answer.response.status, 500); assert.equal(state.inserts.length, 3); assert.equal(state.rows.length, 0); assert.equal(state.notifications.length, 0);
    });
    await check('duplicate handling has no second notification/update or mutation', async () => {
      reset(); assert.equal((await invoke()).response.status, 200); const before = clone(state.rows);
      const second = await invoke(); assert.equal(second.response.status, 409); assert.equal(second.body.code, 'DUPLICATE_SUBMISSION');
      assert.equal(state.rows.length, 1); assert.equal(state.notifications.length, 1); assert.equal(state.updates.length, 1); assert.deepEqual(state.rows, before);
    });
    const denied = [
      ['privacy', { payload: { ...fields, consentPrivacy: false }, status: 400, code: 'VALIDATION_ERROR', field: 'consentPrivacy' }],
      ['invalid unit count', { payload: { ...fields, unitsCount: '0' }, status: 400, code: 'VALIDATION_ERROR' }],
      ['strict schema', { payload: { ...fields, untrusted: true }, status: 400, code: 'VALIDATION_ERROR' }],
      ['foreign origin', { headers: { origin: 'https://foreign.invalid' }, status: 403, code: 'FORBIDDEN_ORIGIN' }],
      ['missing origin/referer', { headers: { origin: null }, status: 403, code: 'FORBIDDEN_ORIGIN' }],
      ['content type', { headers: { 'content-type': 'text/plain' }, status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' }],
      ['declared body limit', { headers: { 'content-length': '40000' }, status: 413, code: 'PAYLOAD_TOO_LARGE' }],
      ['stream body limit', { raw: 'x'.repeat(32769), status: 413, code: 'PAYLOAD_TOO_LARGE' }],
      ['malformed JSON', { raw: '{', status: 400, code: 'INVALID_JSON' }],
      ['empty body', { raw: null, status: 400, code: 'EMPTY_BODY' }],
      ['Turnstile token missing', { payload: { ...fields, turnstileToken: null }, status: 400, code: 'CAPTCHA_TOKEN_MISSING' }],
    ];
    for (const [name, spec] of denied) await check(`${name} guard`, async () => {
      reset(); const answer = await invoke(spec.payload, spec.headers, spec.raw);
      assert.equal(answer.response.status, spec.status); assert.equal(answer.body.code, spec.code);
      if (spec.field) assert.equal(answer.body.field, spec.field);
      assert.equal(state.rows.length, 0); assert.equal(state.inserts.length, 0); assert.equal(state.notifications.length, 0); assert.equal(state.rate.length, 0);
    });
    await check('Turnstile rejection stops before rate and persistence', async () => {
      reset({ captchaResult: { success: false, 'error-codes': ['invalid-input-response'] } });
      const answer = await invoke(); assert.equal(answer.response.status, 400); assert.equal(answer.body.code, 'invalid-input-response');
      assert.equal(state.captcha.length, 1); assert.equal(state.rate.length, 0); assert.equal(state.inserts.length, 0); assert.equal(state.notifications.length, 0);
    });
    for (const options of [{ rateCount: 6 }, { rateError: true }]) await check(`rate denial ${JSON.stringify(options)} stays fail-closed`, async () => {
      reset(options); const answer = await invoke(); assert.equal(answer.response.status, 429); assert.equal(answer.body.code, 'RATE_LIMIT_EXCEEDED');
      assert.equal(state.rate.length, 1); assert.equal(state.inserts.length, 0); assert.equal(state.notifications.length, 0);
      assert.equal(answer.response.headers.get('X-RateLimit-Remaining'), '0'); assert.ok(Number(answer.response.headers.get('Retry-After')) > 0);
    });
    await check('short HMAC configuration fails before rate/persistence', async () => {
      reset(); process.env.NODE_ENV = 'production'; process.env.LEAD_IP_HASH_SECRET = 'short-fixture';
      const answer = await invoke(); assert.equal(answer.response.status, 503); assert.equal(answer.body.code, 'SERVICE_UNAVAILABLE');
      assert.equal(state.rate.length, 0); assert.equal(state.inserts.length, 0); assert.equal(state.notifications.length, 0);
    });
    await check('honeypot preserves silent discard with no writes', async () => {
      reset(); const answer = await invoke({ ...fields, honeypot: 'synthetic bot' }); assert.equal(answer.response.status, 200);
      assert.equal(state.inserts.length, 0); assert.equal(state.notifications.length, 0); assert.equal(state.rate.length, 0);
    });
    await check('referer origin fallback still accepts valid submission', async () => {
      reset(); const answer = await invoke(fields, { origin: null, referer: `${ENV.NEXT_PUBLIC_SITE_URL}/fa/contact` });
      assert.equal(answer.response.status, 200); assert.deepEqual(state.rows[0].metadata.structuredIntake.services, ['community_experience']);
    });

    // Separate known finding: evaluate the existing frontend template, NOT a replacement fingerprint.
    const form = readFileSync(resolve(root, 'src/components/contact/ContactForm.tsx'), 'utf8');
    const template = /const compiledMessage = (`[\s\S]*?`\.trim\(\));/.exec(form)?.[1];
    assert.ok(template, 'review actual frontend template if this contract changes');
    const names = ['role', 'portfolioScope', 'propertyType', 'stage', 'services', 'workspaceStatus', 'city', 'unitsCount', 'additionalNotes'];
    const compileMessage = new Function(...names, `return ${template};`);
    const make = services => { const payload = { ...fields, services }; payload.message = compileMessage(...names.map(key => key === 'additionalNotes' ? 'Synthetic notes only.' : payload[key])); return payload; };
    reset(); const first = make(['community_experience']), second = make(['operations']);
    assert.notEqual(first.message, second.message); assert.equal(first.message.slice(0, 60), second.message.slice(0, 60));
    assert.equal((await invoke(first)).response.status, 200);
    const duplicate = await invoke(second); assert.equal(duplicate.response.status, 409); assert.equal(duplicate.body.code, 'DUPLICATE_SUBMISSION');
    assert.equal(state.inserts[0].submission_fingerprint, state.inserts[1].submission_fingerprint);
    assert.equal(state.rows.length, 1); assert.equal(state.notifications.length, 1);
    console.log(JSON.stringify({ finding: 'CONTACT-FP-01', status: 'OPEN_SEPARATE_SCOPE', counterexample: 'same applicant and first60 chars; different service selections => second request409', sharedFingerprintChanged: false }));
    console.log(JSON.stringify({ task: 'CORE-CONTACT-INTAKE-RETENTION-01', result: 'PASS', checks: checks.length, cases: checks, routeAndRealSecuritySourceSHA256: Object.fromEntries(actualSources), toolchain: { node: process.version, next: require('next/package.json').version, zod: require('zod/package.json').version, typescript: ts.version }, evidence: 'ACTUAL_HANDLER_REAL_GUARDS_CONTROLLED_MEMORY_AND_TRANSPORT', hostedDB: 'NOT_RUN_NOT_PASS', realNotifier: 'NOT_IMPORTED_NOT_SENT' }, null, 2));
  }
} finally {
  globalThis.fetch = originalFetch; Date.now = originalNow;
  console.error = originalConsole.error; console.warn = originalConsole.warn;
}
