import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(relativePath, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  const compiled = new Module(filename);
  compiled.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return compiled.exports;
}

const contracts = load('src/lib/platform/internal-work/contracts.ts');
const requestBody = load('src/lib/security/request-body.ts');
const sameOrigin = load('src/lib/security/same-origin.ts');
const gatewayModule = load('src/lib/platform/internal-work/gateway.ts', {
  'server-only': {},
  './contracts': contracts,
  '@/lib/security/request-body': requestBody,
  '@/lib/security/same-origin': sameOrigin,
  '@/lib/supabase/server': { createClient: async () => { throw new Error('Unexpected auth client call'); } },
});
const { NextRequest } = require('next/server');
const id = (suffix) => `17400000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const calls = [];
const adapter = {
  async listPackages(actor, input) { calls.push({ kind: 'list', actor, input }); return { items: [] }; },
  async getPackage(actor, program, packageId) { calls.push({ kind: 'get', actor, program, packageId }); return { package: { id: packageId } }; },
  async execute(actor, fn, command) { calls.push({ kind: 'execute', actor, fn, command }); return { ok: true, idempotent: false }; },
};
const aal2 = async () => ({ userId: id(1), aal: 'aal2' });
const origin = 'https://cladora.test';

const disabledGateway = gatewayModule.createPmGateway(adapter, { enabled: false, resolveCaller: aal2 });
const disabledResponse = await disabledGateway.list(new NextRequest(`${origin}/api/platform/v1/internal-work/packages?program_id=${id(2)}`));
assert.equal(disabledResponse.status, 404);
assert.equal(calls.length, 0, 'Disabled gateway must never reach auth or database adapter');

const gateway = gatewayModule.createPmGateway(adapter, { enabled: true, resolveCaller: aal2 });
const listResponse = await gateway.list(new NextRequest(`${origin}/api/platform/v1/internal-work/packages?program_id=${id(2)}&limit=20`));
assert.equal(listResponse.status, 200);
assert.equal(listResponse.headers.get('cache-control'), 'no-store, private');
assert.equal(calls.at(-1).kind, 'list');
assert.equal(calls.at(-1).actor, id(1));
assert.equal(calls.at(-1).input.limit, 20);

const getResponse = await gateway.get(new NextRequest(`${origin}/api/platform/v1/internal-work/packages/${id(3)}?program_id=${id(2)}`), id(3));
assert.equal(getResponse.status, 200);
assert.equal(calls.at(-1).kind, 'get');

const command = {
  program_id: id(2), baseline_id: id(4), workstream_id: id(5), package_key: 'PM01-RUNTIME-174',
  title: 'Gateway contract', bounded_scope: 'Synthetic bounded gateway request', expected_version: 0,
  request_id: id(6), idempotency_key: 'pm-runtime-174-register',
};
function post(body, headers = {}) {
  return new NextRequest(`${origin}/api/platform/v1/internal-work/packages`, {
    method: 'POST', body: JSON.stringify(body),
    headers: { origin, 'content-type': 'application/json', ...headers },
  });
}
const mutation = await gateway.mutate(post(command), contracts.registerPackageCommand, 'register_package_internal_v1');
assert.equal(mutation.status, 200);
assert.equal(calls.at(-1).kind, 'execute');
assert.equal(calls.at(-1).fn, 'register_package_internal_v1');
assert.equal('actor_id' in calls.at(-1).command, false, 'Client cannot submit actor identity');

const beforeBadRequests = calls.length;
assert.equal((await gateway.mutate(post(command, { origin: 'https://evil.test' }), contracts.registerPackageCommand, 'register_package_internal_v1')).status, 403);
assert.equal((await gateway.mutate(post(command, { 'content-type': 'text/plain' }), contracts.registerPackageCommand, 'register_package_internal_v1')).status, 415);
assert.equal((await gateway.mutate(post({ ...command, actor_id: id(99) }), contracts.registerPackageCommand, 'register_package_internal_v1')).status, 400);
const oversized = await gateway.mutate(post(command, { 'content-length': String(16 * 1024 + 1) }), contracts.registerPackageCommand, 'register_package_internal_v1');
assert.equal(oversized.status, 413);
assert.equal(oversized.headers.get('cache-control'), 'no-store, private');
assert.equal(calls.length, beforeBadRequests, 'Rejected requests never reach the adapter');

const aal1Gateway = gatewayModule.createPmGateway(adapter, { enabled: true, resolveCaller: async () => ({ userId: id(1), aal: 'aal1' }) });
assert.equal((await aal1Gateway.mutate(post(command), contracts.registerPackageCommand, 'register_package_internal_v1')).status, 403);

const failingAdapter = { ...adapter, async execute() { throw { code: '42501', message: 'private database detail' }; } };
const failingGateway = gatewayModule.createPmGateway(failingAdapter, { enabled: true, resolveCaller: aal2 });
const failure = await failingGateway.mutate(post(command), contracts.registerPackageCommand, 'register_package_internal_v1');
assert.equal(failure.status, 403);
assert.deepEqual(await failure.json(), { error: { code: 'ACCESS_DENIED' } });

const routeFiles = [
  'src/app/api/platform/v1/internal-work/packages/route.ts',
  'src/app/api/platform/v1/internal-work/packages/[id]/route.ts',
  'src/app/api/platform/v1/internal-work/cycles/[id]/transitions/route.ts',
  'src/app/api/platform/v1/internal-work/cycles/[id]/evidence/route.ts',
  'src/app/api/platform/v1/internal-work/cycles/[id]/tests/route.ts',
  'src/app/api/platform/v1/internal-work/cycles/[id]/decisions/route.ts',
  'src/app/api/platform/v1/internal-work/cycles/[id]/changes/route.ts',
];
for (const routeFile of routeFiles) {
  const source = readFileSync(fileURLToPath(new URL(`../${routeFile}`, import.meta.url)), 'utf8');
  assert.match(source, /disabledPmAdapter/);
  assert.match(source, /runtime = 'nodejs'/);
}

console.log('PM private runtime gateway passed: disabled default, bounded auth, validation, DTO and redacted errors.');
