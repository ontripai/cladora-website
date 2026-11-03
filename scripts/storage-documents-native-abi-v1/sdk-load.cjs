'use strict';
// Real, cached SDK load only. No Auth session, request or simulated response.
const need = (v, reason) => { if (!v) throw new Error(reason); };

async function main() {
  const [{ default: fs }, { default: path }, { default: crypto }, { createRequire }] =
    await Promise.all([import('node:fs'), import('node:path'), import('node:crypto'), import('node:module')]);
  const req = createRequire('/workspace/cladora-website/package.json');
  const hash = b => crypto.createHash('sha256').update(b).digest('hex');
  need(process.argv.length === 2, 'ARGUMENTS_DENIED');
  const raw = fs.readFileSync(0, 'utf8');
  const { anon_key: anonKey } = JSON.parse(raw);
  need(typeof anonKey === 'string' && anonKey.length > 20, 'LOCAL_PUBLIC_KEY_REQUIRED');
  const root = '/workspace/cladora-website/node_modules';
  const pins = {
    '@supabase/supabase-js': '35c56301a441e47d1f4da848b57faced7e21d84b25f55ceac027bf01321a24fe',
    '@supabase/storage-js': 'e64331d730751c51c96419e0dd0a6e09a9262859f2a95faf8582e0e7e773cfb2',
    '@supabase/auth-js': 'a43ea0c523b8f4f8b8d59bc3b16b9ec9158cad05de53ffc92238fceb26d8bcfd',
  };
  const packages = Object.entries(pins).map(([name, pin]) => {
    const entry = req.resolve(name);
    need(entry.startsWith(root + '/'), 'SDK_EXTERNAL_ENTRY');
    need(fs.realpathSync(entry) === entry, 'SDK_ALIAS');
    const b = fs.readFileSync(entry);
    need(hash(b) === pin, 'SDK_ENTRY_DRIFT');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, name, 'package.json'), 'utf8'));
    need(pkg.name === name && pkg.version === '2.112.4', 'SDK_VERSION_DRIFT');
    return { name, version: pkg.version, entry: path.relative(root, entry), bytes: b.length, sha256: hash(b) };
  });
  const { createClient } = req('@supabase/supabase-js');
  need(typeof createClient === 'function', 'SDK_NOT_EXECUTABLE');
  let fetchAttempts = 0;
  const client = createClient('http://127.0.0.1:55421', anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: () => { fetchAttempts++; throw new Error('SDK_LOAD_NETWORK_DENIED'); } },
  });
  const storage = client.storage.from('sdk-load-only-no-request');
  for (const method of ['upload', 'update', 'info', 'download', 'remove']) {
    need(typeof storage[method] === 'function', 'SDK_METHOD_MISSING');
  }
  // Initialization reads the disabled session store; does not sign in or fetch.
  await client.auth.initialize();
  need(fetchAttempts === 0, 'SDK_LOAD_ATTEMPTED_FETCH');
  const loaded = Object.keys(req.cache).filter(p => p.startsWith(root + '/')).sort().map(p => {
    need(fs.realpathSync(p) === p, 'SDK_LOADED_ALIAS');
    const b = fs.readFileSync(p);
    return { path: path.relative(root, p), bytes: b.length, sha256: hash(b) };
  });
  need(loaded.length > 3, 'SDK_CLOSURE_INCOMPLETE');
  process.stdout.write(JSON.stringify({ contract: 'platform15.sdk-load.v1', packages,
    constructor: 'REAL_SDK_LOADED', storage_methods: 'PRESENT', loaded,
    fetch_attempts: fetchAttempts, session: 'NOT_CREATED', native_storage: 'NOT_RUN' }) + '\n');
}
main().catch(() => { process.stderr.write('SDK_LOAD_FAILED_PRIVATE_DIAGNOSTIC_REQUIRED\n'); process.exitCode = 1; });
