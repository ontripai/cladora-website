import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const packageRoot = dirname(require.resolve('braces/package.json'));
const manifest = JSON.parse(readFileSync(join(root, 'patches/braces-3.0.3-depth-guard.json'), 'utf8'));
const fixture = mkdtempSync(join(root, '.braces-depth-test-'));
let assertions = 0;
const check = (name, fn) => { fn(); assertions++; console.log(`ok ${assertions} - ${name}`); };
const sha = (text) => createHash('sha256').update(text).digest('hex');
try {
  // Reconstruct the byte-pinned published reference, separate from the installed
  // package. This runs tests on actual code, not a reimplementation of its API.
  const reference = join(fixture, 'reference');
  cpSync(packageRoot, reference, { recursive: true });
  for (const file of manifest.files) {
    const path = join(reference, file.path);
    if (file.original_sha256 === null) { rmSync(path, { force: true }); continue; }
    let content = readFileSync(path, 'utf8');
    if (sha(content) === file.patched_sha256) {
      for (const replacement of [...file.replacements].reverse()) content = content.replace(replacement.after, replacement.before);
    }
    assert.equal(sha(content), file.original_sha256);
    writeFileSync(path, content);
  }
  check('installed vendored identity is explicitly internal', () => {
    assert.equal(require(join(packageRoot, 'package.json')).version, '3.0.4-cladora.2');
  });
  check('installed sources match every vendored source and metadata file', () => {
    const files = ['index.js', 'package.json', 'LICENSE', 'CLADORA-SECURITY.md', ...readdirSync(join(root, 'vendor/braces/lib')).map((path) => `lib/${path}`)];
    for (const path of files) assert.equal(sha(readFileSync(join(packageRoot, path))), sha(readFileSync(join(root, 'vendor/braces', path))), path);
  });
  check('all locked braces copies use the reviewed artifact and integrity', () => {
    const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
    const copies = Object.entries(lock.packages).filter(([path]) => /(^|\/)node_modules\/braces$/.test(path));
    assert.deepEqual(copies.map(([path]) => path), ['node_modules/braces']);
    const integrity = 'sha512-' + createHash('sha512').update(readFileSync(join(root, 'vendor/braces-3.0.4-cladora.2.tgz'))).digest('base64');
    for (const [, metadata] of copies) {
      assert.equal(metadata.version, '3.0.4-cladora.2');
      assert.equal(metadata.resolved, 'file:vendor/braces-3.0.4-cladora.2.tgz');
      assert.equal(metadata.integrity, integrity);
    }
  });
  check('shared toolchain consumers resolve the guarded installation', () => {
    for (const consumer of ['micromatch', 'chokidar']) {
      const consumerRequire = createRequire(require.resolve(`${consumer}/package.json`));
      assert.equal(dirname(consumerRequire.resolve('braces/package.json')), packageRoot);
    }
    const globRequire = createRequire(require.resolve('fast-glob/package.json'));
    const matchRequire = createRequire(globRequire.resolve('micromatch/package.json'));
    assert.equal(dirname(matchRequire.resolve('braces/package.json')), packageRoot);
  });
  const patched = require(packageRoot);
  const original = require(reference);
  const nest = (depth, left = '{', right = '}') => left.repeat(depth) + 'a,b' + right.repeat(depth);
  for (const depth of [101, 1000, 4998]) {
    for (const method of ['parse', 'compile', 'expand', 'stringify']) check(`${method} rejects string depth ${depth}`, () => assert.throws(() => patched[method](nest(depth)), /nesting exceeds maxDepth/));
  }
  for (const method of ['parse', 'compile', 'expand', 'stringify']) {
    check(`${method} bounds parenthesis-only input`, () => assert.throws(() => patched[method](nest(4998, '(', ')')), /nesting exceeds maxDepth/));
    check(`${method} bounds mixed parenthesis and brace nesting`, () => assert.throws(() => patched[method]('('.repeat(60) + nest(60) + ')'.repeat(60)), /nesting exceeds maxDepth/));
  }
  for (const method of ['parse', 'compile', 'expand', 'stringify']) {
    check(`${method} accepts the 100-level boundary`, () => assert.doesNotThrow(() => patched[method](nest(100))));
    check(`${method} preserves normal 100-level output`, () => {
      const expected = original[method](nest(100)); const actual = patched[method](nest(100));
      // ASTs have circular parent references; compare their rendered output.
      if (method === 'parse') assert.equal(patched.stringify(actual), original.stringify(expected));
      else assert.deepEqual(actual, expected);
    });
    check(`${method} honors stricter configured depth`, () => assert.throws(() => patched[method](nest(3), { maxDepth: 2 }), /nesting exceeds maxDepth/));
    check(`${method} floors fractional configured depth`, () => assert.throws(() => patched[method](nest(2), { maxDepth: 1.5 }), /nesting exceeds maxDepth/));
    check(`${method} cannot raise the safe cap`, () => assert.throws(() => patched[method](nest(101), { maxDepth: 10000 }), /nesting exceeds maxDepth/));
  }
  const ast = (depth) => { let node = { type: 'text', value: 'x' }; for (let i = 0; i < depth; i++) node = { type: 'root', nodes: [node] }; return node; };
  for (const method of ['compile', 'expand', 'stringify']) {
    check(`${method} rejects a direct 10000-level AST`, () => assert.throws(() => patched[method](ast(10000)), /nesting exceeds maxDepth/));
    check(`${method} bounds cyclic nodes`, () => { const node = { type: 'root', nodes: [] }; node.nodes.push(node); assert.throws(() => patched[method](node), /nesting exceeds maxDepth/); });
  }
  for (const value of [NaN, Infinity, -1, 0, '10']) check(`invalid maxDepth ${String(value)} rejected`, () => assert.throws(() => patched.parse('{a,b}', { maxDepth: value }), /finite positive number/));
  const patterns = ['{a,b}', '{{a}}', '{a,{b}}', '{{x}y}', '{a,{b,{c}}', '{}{a}', '{1..8}', '{01..05}', '{a..z}', '{a,b}/x', 'src/**/*.{ts,tsx}', '\\{a,b\\}', '[{}]', '"{a,b}"', '{a,b', '(a|b)', 'abc', ''];
  let comparisons = 0;
  for (const pattern of patterns) for (const method of ['compile', 'expand', 'stringify']) for (const escapeInvalid of [false, true]) {
    assert.deepEqual(patched[method](pattern, { escapeInvalid }), original[method](pattern, { escapeInvalid }), `${method}: ${pattern}`); comparisons++;
  }
  check(`${comparisons} compatibility comparisons preserve published outputs, including stringify escapeInvalid`, () => assert.equal(comparisons, 108));
  check('actual micromatch consumer preserves ordinary matching and rejects hostile input', () => {
    const micromatch = require('micromatch'); assert.deepEqual(micromatch(['a.ts', 'b.js', 'c.md'], '*.{ts,js}'), ['a.ts', 'b.js']);
    assert.throws(() => micromatch.braces(nest(101)), /nesting exceeds maxDepth/);
  });
  check('Next ESLint nested fast-glob resolves the reviewed braces', () => {
    const nextRequire = createRequire(require.resolve('@next/eslint-plugin-next/package.json'));
    const globRequire = createRequire(nextRequire.resolve('fast-glob/package.json'));
    const matchRequire = createRequire(globRequire.resolve('micromatch/package.json'));
    assert.equal(dirname(matchRequire.resolve('braces/package.json')), packageRoot);
  });
  check('actual fast-glob consumer works with existing source patterns', () => {
    const glob = require('fast-glob'); assert.ok(glob.sync('src/lib/customer/*.{ts,tsx}', { cwd: root }).includes('src/lib/customer/billing-schema.ts'));
  });
  console.log(`Braces depth backport: ${assertions} checks, ${comparisons} compatibility comparisons passed`);
} finally { rmSync(fixture, { recursive: true, force: true }); }
