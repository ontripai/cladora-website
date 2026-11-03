import { existsSync, readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// Compile actual application modules in memory; resolve the same source alias
// and explicit .ts imports without writing generated runtime files into scripts/.
export function createApplicationTestModuleLoader({ server = false } = {}) {
  const modules = new Map();
  function load(url) {
    if (!existsSync(url) && url.pathname.endsWith('.ts')) url = new URL(url.href.replace(/\.ts$/, '.tsx'));
    if (modules.has(url.href)) return modules.get(url.href).exports;
    const mod = new Module(fileURLToPath(url)); modules.set(url.href, mod);
    mod.require = name => {
      if (server && name === 'server-only') return {};
      if (name.startsWith('@/')) return load(new URL(`../../src/${name.slice(2)}.ts`, import.meta.url));
      if (name.startsWith('.')) return load(new URL(/\.(?:tsx?|m?js)$/.test(name) ? name : `${name}.ts`, url));
      return require(name);
    };
    mod._compile(ts.transpileModule(readFileSync(url, 'utf8'), { fileName: fileURLToPath(url), compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    } }).outputText, fileURLToPath(url));
    return mod.exports;
  }
  return load;
}
