import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
const BASE = '706c021a78947b4b28029582738ced051270a398';
const routePath = 'src/app/api/customer/v2/airprop/artifact-b2/route.ts', entryPath = join(root, routePath);
// Exact public Base fixture (Git blob577f1c8a38d1fc136f7f77d64ecf52885b51d06c); no subprocess/network needed.
const before = "import { createClient } from '@/lib/supabase/server';\nimport { createAirpropB2Api } from '@/lib/airprop/artifact-b2-api';\n\n// Explicitly unwired. This candidate neither creates a connection nor activates a command consumer.\nconst api = createAirpropB2Api({\n  runtime: null,\n  portfolio: null,\n  bind: async () => null,\n  async session() {\n    const db = await createClient();\n    const { data, error } = await db.auth.getClaims();\n    if (error || !data?.claims?.sub) return null;\n    return { actor_id: data.claims.sub, aal: String(data.claims.aal ?? '') };\n  },\n});\nexport const GET = api.GET;\nexport const POST = api.POST;\n";
const after = readFileSync(entryPath, 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
assert.equal(sha(before), '06f3e4ee226283326bdecedc58215ae87cb0abf5d7644fdaa0772e349b35a8c0');
const version = require('next/package.json').version;
assert.equal(version, '16.3.8', 'this witness is pinned to the reported Webpack generator');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')).packages;
for (const name of ['next', 'typescript', 'zod', '@types/react', '@types/node']) {
  assert.equal(require(`${name}/package.json`).version, lock[`node_modules/${name}`].version, `${name} must match this Base lock`);
}

// Invoke the UNMODIFIED installed Webpack plugin via its actual compilation and
// processAssets hooks. Only chunk enumeration is a fixture; no copied validator,
// regex-generated type rule, build-server startup or generated-file edit is used.
async function webpackGuard() {
  const { NextTypesPlugin } = require('next/dist/build/webpack/plugins/next-types-plugin');
  const { WEBPACK_LAYERS } = require('next/dist/lib/constants');
  const plugin = new NextTypesPlugin({ dir: root, appDir: join(root, 'src/app'), distDir: '.next',
    dev: false, isEdgeServer: false, pageExtensions: ['tsx', 'ts', 'jsx', 'js'] });
  let onCompilation, onAssets;
  const assets = new Map();
  plugin.apply({ hooks: { compilation: { tap: (_name, callback) => { onCompilation = callback; } } } });
  onCompilation({
    hooks: { processAssets: { tapAsync: (_options, callback) => { onAssets = callback; } } },
    chunkGroups: [{ chunks: [{ name: 'app/api/customer/v2/airprop/artifact-b2/route' }] }],
    chunkGraph: { getChunkModulesIterable: () => [{ resource: entryPath, layer: WEBPACK_LAYERS.reactServerComponents }] },
    emitAsset: (name, source) => assets.set(name, source.source().toString()),
  });
  await new Promise((resolve, reject) => { void onAssets({}, error => error ? reject(error) : resolve()); });
  const guards = Array.from(assets).filter(([name]) => name.endsWith('types/app/api/customer/v2/airprop/artifact-b2/route.ts'));
  assert.equal(guards.length, 1, 'actual plugin must emit the route guard exactly once');
  return guards[0][1];
}
function typeDiagnostics(guard, entrySource) {
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  assert.deepEqual(parsed.errors, []); assert.equal(parsed.options.strict, true);
  // Same config strictness; no global type/ParamCheck/undefined exclusion override.
  const options = { ...parsed.options, noEmit: true, incremental: false };
  const file = join(root, '.next/types/app/api/customer/v2/airprop/artifact-b2/route.ts');
  const host = ts.createCompilerHost(options), getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => {
    const normalized = resolve(path);
    if (normalized === file || normalized === entryPath) return ts.createSourceFile(path,
      normalized === file ? guard : entrySource, languageVersion, true);
    return getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile);
  };
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([file], options, host));
  return diagnostics.map(d => ({ code: d.code, file: d.file?.fileName,
    line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null,
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }));
}

let count = 0;
const check = async (name, fn) => { await fn(); console.log('PASS', ++count, name); };
const guard = await webpackGuard();
let beforeDiagnostics, afterDiagnostics;
await check('actual Next16.3.8 Webpack ParamCheck rejects exact Base optional exported GET', () => {
  beforeDiagnostics = typeDiagnostics(guard, before);
  assert.equal(beforeDiagnostics.length, 1, JSON.stringify(beforeDiagnostics));
  const d = beforeDiagnostics[0];
  assert.equal(d.code, 2344); assert.ok(d.file.endsWith('/artifact-b2/route.ts'));
  assert.match(d.message, /__tag__: "GET"/); assert.match(d.message, /ParamCheck/);
  assert.match(d.message, /NextRequest \| undefined/);
});
await check('identical unedited generated guard accepts required-request delegated export', () => {
  afterDiagnostics = typeDiagnostics(guard, after);
  assert.deepEqual(afterDiagnostics, []);
});

const { NextRequest } = require('next/server');
const factoryPath = 'src/lib/airprop/artifact-b2-api.ts';
assert.equal(sha(readFileSync(join(root, factoryPath), 'utf8')), '653bdf8f58dc867752f78faad8d4e43f467a168310aa802c3d784c2c0849682d', 'internal factory must remain byte-identical to Base');
let auth = { data: { claims: { sub: 'synthetic-actor', aal: 'aal2' } }, error: null }, authCalls = 0;
const supabase = { createClient: async () => ({ auth: { getClaims: async () => {
  authCalls++; if (auth === 'throw') throw Error('SYNTHETIC_AUTH_UNAVAILABLE'); return auth;
} } }) };
function loader(routeSource, mocks = {}) {
  const cache = new Map();
  function load(path) {
    const filename = resolve(root, path);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename); cache.set(filename, mod);
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name]
      : name === '@/lib/supabase/server' ? supabase
        : name.startsWith('@/') ? load('src/' + name.slice(2) + '.ts')
          : name.startsWith('.') ? load(resolve(dirname(filename), name.endsWith('.ts') ? name : name + '.ts')) : require(name);
    mod._compile(ts.transpileModule(filename === entryPath ? routeSource : readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
  }
  return load;
}
const nativeFetch = globalThis.fetch;
globalThis.fetch = () => { throw Error('REAL_NETWORK_FORBIDDEN'); };
try {
  await check('wrapper forwards exact request and returns original promise; POST remains direct', () => {
    let actual, composition;
    const promise = Promise.resolve(new Response('synthetic'));
    const api = { GET: request => { actual = request; return promise; }, POST: () => promise };
    const route = loader(after, { '@/lib/airprop/artifact-b2-api': { createAirpropB2Api: input => { composition = input; return api; } } })(routePath);
    const request = new NextRequest('https://cladora.test/api/customer/v2/airprop/artifact-b2');
    assert.equal(route.GET(request), promise); assert.equal(actual, request); assert.equal(route.POST, api.POST);
    assert.equal(composition.runtime, null); assert.equal(composition.portfolio, null);
  });
  const original = loader(before)(routePath), fixed = loader(after)(routePath);
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const command = { version: 1, context_id: id(1), workspace_id: id(2), idempotency_key: 'conformance-only-command',
    action: 'withdraw_listing', listing_id: id(3), expected_version: 1, reason: 'Synthetic conformance' };
  const request = (method, query = '', body = command, headers = {}) => new NextRequest('https://cladora.test/api/customer/v2/airprop/artifact-b2' + query,
    method === 'GET' ? undefined : { method, headers: { Origin: 'https://cladora.test', 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const cases = [
    ['GET controls', 'GET', '', null, {}, 'aal2', 200],
    ['GET optional factory/no-argument remains supported', 'GET', undefined, null, {}, 'aal2', 200],
    ['GET anonymous', 'GET', '', null, {}, 'anonymous', 401],
    ['GET claims error', 'GET', '', null, {}, 'auth-error', 401],
    ['GET session failure', 'GET', '', null, {}, 'throw', 503],
    ['GET malformed query', 'GET', '?context_id=bad', null, {}, 'aal2', 400],
    ['GET duplicated query', 'GET', `?context_id=${id(1)}&workspace_id=${id(2)}&context_id=${id(1)}`, null, {}, 'aal2', 400],
    ['GET private portfolio stays pre-activation', 'GET', `?context_id=${id(1)}&workspace_id=${id(2)}`, null, {}, 'aal2', 403],
    ['POST bad origin', 'POST', '', command, { Origin: 'https://other.test' }, 'aal2', 403],
    ['POST bad media', 'POST', '', command, { 'Content-Type': 'text/plain' }, 'aal2', 415],
    ['POST malformed JSON', 'POST', '', '{', {}, 'aal2', 400],
    ['POST strict body', 'POST', '', { ...command, actor_id: id(9) }, {}, 'aal2', 400],
    ['POST bounded body', 'POST', '', ' '.repeat(65537), {}, 'aal2', 413],
    ['POST anonymous', 'POST', '', command, {}, 'anonymous', 401],
    ['POST MFA unchanged', 'POST', '', command, {}, 'aal1', 403],
    ['POST runtime stays pre-activation', 'POST', '', command, {}, 'aal2', 403],
  ];
  for (const [name, method, query, body, headers, identity, expected] of cases) await check(name + ' baseline/fixed parity', async () => {
    auth = identity === 'throw' ? 'throw' : identity === 'anonymous' ? { data: null, error: null }
      : identity === 'auth-error' ? { data: null, error: { message: 'synthetic' } }
        : { data: { claims: { sub: 'synthetic-actor', aal: identity } }, error: null };
    const observe = async route => {
      authCalls = 0;
      const response = method === 'GET' ? await route.GET(query === undefined ? undefined : request(method, query)) : await route.POST(request(method, query, body, headers));
      return { status: response.status, body: await response.text(), headers: Array.from(response.headers), authCalls };
    };
    const a = await observe(original), b = await observe(fixed);
    assert.deepEqual(b, a); assert.equal(b.status, expected);
    assert.match(new Headers(b.headers).get('Cache-Control'), /no-store.*private/);
    if (method === 'POST' && ['POST bad origin', 'POST bad media', 'POST malformed JSON', 'POST strict body', 'POST bounded body'].includes(name)) assert.equal(b.authCalls, 0);
  });
} finally { globalThis.fetch = nativeFetch; }
console.log(JSON.stringify({ scope: 'generated-webpack-route-validator-and-controlled-wire-only', base: BASE, next: version, typescript: ts.version,
  generator_sha256: sha(readFileSync(require.resolve('next/dist/build/webpack/plugins/next-types-plugin'), 'utf8')),
  generated_guard_sha256: sha(guard), before_route_sha256: sha(before), after_route_sha256: sha(after),
  before_diagnostics: beforeDiagnostics, after_diagnostics: afterDiagnostics, checks: count,
  generated_files_written: 0, full_webpack_build: 'NOT_RUN_NOT_PASS', actual_Auth_DB_business_network: 'NOT_RUN_NOT_PASS',
  existing_Turbopack_Preview_PASS: 'SEPARATE_PRESERVED_EVIDENCE' }, null, 2));
