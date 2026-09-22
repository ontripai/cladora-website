import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const path = new URL('../supabase/tests/fixtures/099_retention_manifest_vectors.json', import.meta.url);
const fixture = JSON.parse(readFileSync(path, 'utf8'));
assert.equal(fixture.specification, 'RFC 8785 JSON Canonicalization Scheme (JCS) / SHA-256 Digest');
assert.equal(fixture.vectors.length, 4);

for (const vector of fixture.vectors) {
  const bytes = Buffer.from(vector.canonical_jcs_payload, 'utf8');
  assert.equal(bytes.length, vector.byte_length, `${vector.vector_id} byte length`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), vector.sha256_digest, `${vector.vector_id} SHA-256`);

  const json = vector.includes_domain_prefix
    ? vector.canonical_jcs_payload.slice(fixture.domain_separation_prefix.length)
    : vector.canonical_jcs_payload;
  const documents = JSON.parse(json);
  assert.equal(documents.length, vector.document_count, `${vector.vector_id} document count`);
  assert.deepEqual([...documents].sort((a,b) => a.document_id.localeCompare(b.document_id)), documents,
    `${vector.vector_id} UUID order`);
  console.log(`ok - ${vector.vector_id}`);
}

console.log('Manifest contract passed: 4 independently hashed golden vectors.');
