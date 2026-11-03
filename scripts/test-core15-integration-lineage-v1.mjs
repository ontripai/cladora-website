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

// The earlier session checkpoint must retain its exact installer/native evidence
// while its source inventory follows the separately published Service successor.
const sessionArchivePath = 'docs/verification/CORE15-SESSION-a0a37.manifest.json';
const sessionArchive = read(sessionArchivePath);
assert.equal(hash(sessionArchive), 'eca5ea7cb2a200e9153ba9a956ef37397c1a70c9ee01ba2bf0092635a3c2e1ba');
const sessionBefore = JSON.parse(sessionArchive);
const sessionNow = JSON.parse(read('supabase/install/core-functional-runtime-v1/manifest.json'));
const sessionLineage = sessionNow.integration_lineage;
assert.equal(sessionLineage.contract, 'core15-session-inventory-successor.v1');
assert.equal(sessionLineage.original_manifest, sessionArchivePath);
assert.equal(sessionLineage.original_manifest_sha256, hash(sessionArchive));
assert.equal(sessionLineage.original_commit, 'a0a37f3c573558d14be2e62ba27e6e5475b9c4fe');
assert.equal(sessionLineage.runtime_source_successor, '580de7be74d7bc1000119b0b940cff644c6437ab');
assert.equal(sessionLineage.installer_units_and_session_native_evidence, 'UNCHANGED');
assert.equal(sessionLineage.controlled_runtime_groups, 35);
assert.match(sessionLineage.native_results, /NOT_RERUN_BY_COORDINATOR/);
assert.deepEqual(sessionLineage.changes.map(x => x.path), [
  'scripts/test-core-functional-runtime-v1.mjs',
  'src/lib/core/functional-command-runtime-v1.ts',
  'src/lib/core/service-functional-binding-v1.ts',
]);
const expectedSession = structuredClone(sessionBefore);
for (const change of sessionLineage.changes) {
  const entry = expectedSession.inventory.find(x => x.path === change.path);
  assert.deepEqual(change.before, entry);
  const source = read(change.path);
  const sourceHash = hash(source);
  if (change.path.startsWith('src/')) {
    assert.equal(sourceHash, original.inventory.find(x => x.path === change.path).after.sha256,
      'Runtime must be byte-exact with the published native Service cut');
  } else {
    assert.equal(sourceHash, '4881b3895067cdcc1390ed566f5f92e4c7d4efe3467ff566d2b530b3d1c9e0a4',
      'Only the reviewed controlled SSR Auth fixture and denial case may supersede this test');
  }
  const after = { path: change.path, bytes: source.length, sha256: sourceHash,
    git_blob: createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${source.length}\0`), source])).digest('hex') };
  assert.deepEqual(change.after, after);
  Object.assign(entry, after);
}
expectedSession.inventory_seal_sha256 = hash(Buffer.from(JSON.stringify(expectedSession.inventory)));
const { integration_lineage: sessionMetadata, ...sessionNativeFields } = sessionNow;
assert.equal(sessionMetadata, sessionLineage);
assert.deepEqual(sessionNativeFields, expectedSession, 'Installer bytes, session evidence and all other checkpoint fields remain unchanged');
console.log('PASS Core15 lineage: exact archived native/session manifests; identifier-only preparation and exact published runtime/test successors; SQL/native evidence unchanged, native NOT_RERUN');
