import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyBracesDepthGuard, prepareBracesDepthGuard } from './apply-braces-depth-guard.mjs';

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
  check('all patch sources are verified before any write', () => {
    const drifted = join(fixture, 'drifted'); cpSync(reference, drifted, { recursive: true });
    writeFileSync(join(drifted, 'lib/expand.js'), '// unexpected bytes\n');
    assert.throws(() => applyBracesDepthGuard(drifted), /Unexpected braces source bytes/);
    assert.equal(sha(readFileSync(join(drifted, 'lib/parse.js'))), manifest.files[0].original_sha256);
    assert.equal(existsSync(join(drifted, 'lib/cladora-depth-limit.js')), false);
  });
  check('different release fails closed', () => {
    const changed = join(fixture, 'changed'); cpSync(reference, changed, { recursive: true });
    writeFileSync(join(changed, 'package.json'), JSON.stringify({ name: 'braces', version: '3.0.4' }));
    assert.throws(() => prepareBracesDepthGuard(changed), /Unexpected braces release/);
  });
  const cliFixture = (name, copies) => {
    const target = join(fixture, name);
    mkdirSync(join(target, 'scripts'), { recursive: true });
    mkdirSync(join(target, 'patches'), { recursive: true });
    cpSync(join(root, 'scripts/apply-braces-depth-guard.mjs'), join(target, 'scripts/apply-braces-depth-guard.mjs'));
    cpSync(join(root, 'patches/braces-3.0.3-depth-guard.json'), join(target, 'patches/braces-3.0.3-depth-guard.json'));
    writeFileSync(join(target, 'package.json'), '{}');
    writeFileSync(join(target, 'package-lock.json'), JSON.stringify({ packages: copies }));
    return { target, run: () => spawnSync(process.execPath, [join(target, 'scripts/apply-braces-depth-guard.mjs')], { encoding: 'utf8' }) };
  };
  check('installer supports omitted development-only copies', () => {
    const test = cliFixture('omitted', { 'node_modules/braces': { dev: true } });
    assert.equal(test.run().status, 0);
  });
  check('installer rejects missing non-development copies', () => {
    const test = cliFixture('missing', { 'node_modules/braces': {} });
    assert.notEqual(test.run().status, 0);
  });
  check('installer patches every locked installed copy', () => {
    const paths = ['node_modules/braces', 'node_modules/consumer/node_modules/braces'];
    const test = cliFixture('multiple', Object.fromEntries(paths.map((path) => [path, { dev: true }])));
    for (const path of paths) cpSync(reference, join(test.target, path), { recursive: true });
    assert.equal(test.run().status, 0);
    for (const path of paths) assert.ok(prepareBracesDepthGuard(join(test.target, path)).every((file) => !file.changed));
    assert.equal(test.run().status, 0);
  });
  check('unexpected nested copy prevents writes to all copies', () => {
    const paths = ['node_modules/braces', 'node_modules/consumer/node_modules/braces'];
    const test = cliFixture('multiple-drift', Object.fromEntries(paths.map((path) => [path, { dev: true }])));
    for (const path of paths) cpSync(reference, join(test.target, path), { recursive: true });
    writeFileSync(join(test.target, paths[1], 'lib/expand.js'), '// drift');
    assert.notEqual(test.run().status, 0);
    assert.equal(sha(readFileSync(join(test.target, paths[0], 'lib/parse.js'))), manifest.files[0].original_sha256);
  });
  const first = applyBracesDepthGuard(packageRoot);
  check('apply is idempotent and source identity remains 3.0.3', () => {
    assert.ok(first === 0 || first === 5); assert.equal(applyBracesDepthGuard(packageRoot), 0);
    assert.equal(require(join(packageRoot, 'package.json')).version, '3.0.3');
    assert.ok(prepareBracesDepthGuard(packageRoot).every((file) => !file.changed));
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
  check('parenthesis nesting is bounded too', () => assert.throws(() => patched.parse(nest(101, '(', ')')), /nesting exceeds maxDepth/));
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
  check('actual fast-glob consumer works with existing source patterns', () => {
    const glob = require('fast-glob'); assert.ok(glob.sync('src/lib/customer/*.{ts,tsx}', { cwd: root }).includes('src/lib/customer/billing-schema.ts'));
  });
  console.log(`Braces depth backport: ${assertions} checks, ${comparisons} compatibility comparisons passed`);
} finally { rmSync(fixture, { recursive: true, force: true }); }
