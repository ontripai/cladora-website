import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/supabase/env.ts', import.meta.url), 'utf8');
const keys = ['NODE_ENV', 'VERCEL', 'VERCEL_ENV', 'NEXT_PUBLIC_VERCEL_ENV',
  'NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE', 'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
const baseline = { NODE_ENV: 'development', NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'browser-safe-test-key' };
const helper = await import('../src/lib/supabase/env.ts');
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
let cases = 0;
function check(overrides, accepted, browserHost) {
  const environment = { ...baseline, ...overrides };
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
    let selected = helper;
    if (browserHost !== undefined) {
      // Model Next's literal environment replacements, including NODE_ENV. The
      // real Next server/browser compilation is additionally exercised by CI.
      const inlined = source.replace(/process\.env\.([A-Z_]+)/g, (_, key) => JSON.stringify(environment[key]) ?? 'undefined');
      const exports = {};
      vm.runInNewContext(ts.transpileModule(inlined, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
        { exports, URL, atob, window: { location: { hostname: browserHost } } });
      selected = exports;
    }
    if (accepted) assert.equal(selected.getPublicSupabaseEnv().url, environment.NEXT_PUBLIC_SUPABASE_URL);
    else assert.throws(() => selected.getPublicSupabaseEnv());
    cases += 1;
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}
for (const hostname of [undefined, '127.0.0.1']) {
  check({}, true, hostname);
  check({ NODE_ENV: 'test' }, true, hostname);
  for (const flag of [undefined, '', 'true', '0']) check({ NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE: flag }, false, hostname);
  for (const NODE_ENV of ['production', undefined]) check({ NODE_ENV }, false, hostname);
  for (const key of ['VERCEL', 'VERCEL_ENV', 'NEXT_PUBLIC_VERCEL_ENV']) check({ [key]: 'preview' }, false, hostname);
  for (const url of ['http://localhost:54321', 'http://[::1]:54321', 'https://localhost:8443']) check({ NEXT_PUBLIC_SUPABASE_URL: url }, true, hostname);
  check({ NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }, true, hostname);
  for (const url of [undefined, '', 'http://localhost', 'http://localhost:0', 'http://localhost:65536',
    'http://localhost:54321/', 'http://localhost:54321/path', 'http://localhost:54321?x=1',
    'http://localhost:54321#x', 'http://user:password@localhost:54321', 'http://0.0.0.0:54321',
    'http://127.1:54321', 'http://2130706433:54321', 'http://127.0.0.2:54321',
    'http://%6cocalhost:54321', 'http://localhost.:54321', 'http://localhost.evil.test:54321',
    'http://10.0.0.1:54321', 'http://169.254.169.254:80', 'https://example.test:443',
    'https://example.supabase.co/evil.supabase.co', 'https://u:p@example.supabase.co']) {
    check({ NEXT_PUBLIC_SUPABASE_URL: url }, false, hostname);
  }
  for (const key of [undefined, '', 'sb_secret_test', `x.${Buffer.from('{"role":"service_role"}').toString('base64url')}.x`]) {
    check({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }, false, hostname);
  }
}
check({}, false, 'preview.example.test');
assert.deepEqual(Object.fromEntries(keys.map(key => [key, process.env[key]])), original, 'caller environment restored');
console.log(JSON.stringify({ suite: 'supabase-local-env-contract', cases, environment_restoration: 'PASS',
  node_helper: 'PASS', browser_literal_replacements: 'PASS', actual_next_path: 'DEDICATED_CONNECTED_CI' }));
