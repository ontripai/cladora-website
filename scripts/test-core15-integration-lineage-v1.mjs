/** Preserve native evidence while checking two preparation-only identifier renames. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const archivedPath = 'docs/verification/CORE15-SERVICE-CUT-580de7.manifest.json';
const archived = read(archivedPath);
assert.equal(hash(archived), '4c5fac4491094a5b96cecf703837ebc1280a98ea9f2e29e2f5e467115348fcb9');
const original = JSON.parse(archived);
const current = JSON.parse(read('supabase/install/core-functional-runtime-v1/service-native-v3/service-cut.manifest.json'));
const lineage = current.integration_lineage;
assert.equal(lineage.contract, 'core15-service-cut-lint-identifier-successor.v1');
assert.equal(lineage.source_commit, '580de7be74d7bc1000119b0b940cff644c6437ab');
assert.equal(lineage.native_manifest, archivedPath);
assert.equal(lineage.native_manifest_sha256, hash(archived));
assert.equal(lineage.native_dispatch, false);
assert.equal(lineage.runtime_source_bytes, 'UNCHANGED');
assert.equal(lineage.SQL_images, 'UNCHANGED');
assert.match(lineage.native_results, /NOT_RERUN/);
assert.deepEqual(lineage.changes.map(x => [x.path, x.identifier_before, x.identifier_after, x.occurrences]), [
  ['scripts/prepare-core15-service-native-v3.mjs', 'module', 'profileModule', 3],
  ['scripts/prepare-core15-service-synthetic-fixture-v1.mjs', 'module', 'serviceModule', 3],
]);

function restoreIdentifiers(source, change) {
  const parsed = ts.createSourceFile(change.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const replacements = [];
  function visit(node) {
    if (ts.isIdentifier(node) && node.text === change.identifier_after) {
      replacements.push([node.getStart(parsed), node.end]);
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.equal(replacements.length, change.occurrences);
  for (const [start, end] of replacements.reverse()) {
    source = source.slice(0, start) + change.identifier_before + source.slice(end);
  }
  assert.equal(hash(Buffer.from(source)), change.original_sha256);
}

const expected = structuredClone(original);
for (const change of lineage.changes) {
  const source = read(change.path);
  assert.equal(hash(source), change.successor_sha256);
  const oldEntry = original.inventory.find(x => x.path === change.path);
  assert.equal(change.original_sha256, oldEntry.after.sha256);
  restoreIdentifiers(source.toString('utf8'), change);
  expected.inventory.find(x => x.path === change.path).after = {
    bytes: source.length, sha256: hash(source),
    git_blob: createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${source.length}\0`), source])).digest('hex'),
  };
}
const { integration_lineage: ignored, ...currentNativeFields } = current;
assert.equal(ignored, lineage);
assert.deepEqual(currentNativeFields, expected, 'No native evidence, SQL image, runtime pin or result may change');
const fixture = lineage.changes[1];
const sqlMutation = read(fixture.path).toString('utf8').replace('module.services_orders', 'incorrect.services_orders');
assert.throws(() => restoreIdentifiers(sqlMutation, fixture), 'Identifier reconciliation must never normalize SQL literals');
console.log('PASS Core15 lineage: exact original native manifest, two identifier-only changes; SQL/runtime/evidence unchanged, native NOT_RERUN');
