import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

export function createB2Loader(mocks = {}) {
  const require = createRequire(import.meta.url), cache = new Map();
  const root = new URL('../../', import.meta.url);
  function load(path) {
    const url = path instanceof URL ? path : new URL(path, root);
    if (cache.has(url.href)) return cache.get(url.href);
    const mod = { exports: {} }; cache.set(url.href, mod.exports);
    const compiled = ts.transpileModule(readFileSync(url, 'utf8'), { fileName: url.pathname, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } });
    new Function('require', 'module', 'exports', compiled.outputText)(name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
      const target = name.startsWith('@/') ? new URL(`src/${name.slice(2)}`, root) : new URL(name, url);
      if (!/\.(tsx?|mjs)$/.test(target.pathname)) target.pathname += '.ts';
      return load(target);
    }, mod, mod.exports);
    cache.set(url.href, mod.exports); return mod.exports;
  }
  return load;
}
