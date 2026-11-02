import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
export function assertSourcePin(bytes, pin) {
  if (bytes.length !== pin.bytes || createHash('sha256').update(bytes).digest('hex') !== pin.sha256) {
    throw new Error('COMPILER_SOURCE_PIN_MISMATCH');
  }
}
/** Fixed source-code loader only. No input-selected module/require hook, target,
 * environment credential or secret file is read. Compiler itself performs no I/O.
 */
export function loadPinnedPlanCompiler() {
  const manifest = JSON.parse(readFileSync(new URL('./source-manifest.json', import.meta.url)));
  if (manifest.contract !== 'documents-ce012-case-plan-source-manifest.v1'
    || manifest.base !== 'c0caf3e70d97c3d09b16cbff91188367804cba6b') throw Error('COMPILER_SOURCE_MANIFEST_INVALID');
  const sources = new Map();
  for (const pin of manifest.files) {
    if (!/^(?:scripts\/docs-ce012-case-plan-v1\/|src\/lib\/|src\/types\/|package(?:-lock)?\.json$)/.test(pin.path)
      || pin.path.split('/').includes('..') || sources.has(pin.path)) throw Error('COMPILER_SOURCE_MANIFEST_INVALID');
    const bytes = readFileSync(path.join(root, pin.path));
    assertSourcePin(bytes, pin); sources.set(pin.path, bytes);
  }
  const require = createRequire(path.join(root, 'package.json'));
  const ts = require('typescript'), cache = new Map();
  const load = relative => {
    if (!sources.has(relative)) throw Error('COMPILER_UNPINNED_IMPORT');
    if (cache.has(relative)) return cache.get(relative).exports;
    const mod = { exports: {} }; cache.set(relative, mod);
    const compiled = ts.transpileModule(sources.get(relative).toString('utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    new Function('require', 'module', 'exports', compiled.outputText)(name => {
      if (!name.startsWith('.')) return require(name);
      const p = path.posix.normalize(path.posix.join(path.posix.dirname(relative), name));
      return load(p.endsWith('.ts') ? p : `${p}.ts`);
    }, mod, mod.exports);
    return mod.exports;
  };
  return load('scripts/docs-ce012-case-plan-v1/compiler.ts');
}
