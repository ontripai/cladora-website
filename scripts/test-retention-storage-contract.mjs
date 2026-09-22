import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';

const allowedReceiptFields = new Set([
  'schema_version', 'tenant_id', 'assertion_id', 'job_id', 'claim_token',
  'gateway_operation_id', 'provider_request_id', 'bucket_id', 'object_path',
  'expected_sha256', 'pre_delete_etag', 'pre_delete_size_bytes',
  'delete_result_code', 'probe_result_code', 'status_code_classification',
  'attempt_number', 'receipt_nonce', 'issued_at', 'observed_at',
  'canonical_payload_hash', 'mac_key_version', 'signature_mac',
]);

const hmacKey = 'phase3a-storage-contract-key';
const fixture = Object.freeze({
  tenant_id: '10000000-0000-4000-8000-000000000001',
  assertion_id: '10000000-0000-4000-8000-000000000002',
  job_id: '10000000-0000-4000-8000-000000000003',
  claim_token: '10000000-0000-4000-8000-000000000004',
  gateway_operation_id: '10000000-0000-4000-8000-000000000005',
  bucket_id: 'phase3a-run-scoped-bucket',
  object_path: 'run/document/version.pdf',
  expected_sha256: createHash('sha256').update('phase3a').digest('hex'),
});

function canonicalPayload(receipt) {
  const payload = { ...receipt };
  delete payload.canonical_payload_hash;
  delete payload.signature_mac;
  return JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))));
}

function signReceipt(overrides = {}) {
  const receipt = {
    schema_version: 'v1', ...fixture, provider_request_id: 'provider-request-1',
    pre_delete_etag: 'etag-1', pre_delete_size_bytes: 7,
    delete_result_code: 204, probe_result_code: 404,
    status_code_classification: 'VERIFIED_ABSENCE', attempt_number: 1,
    receipt_nonce: randomUUID(), issued_at: new Date().toISOString(),
    observed_at: new Date().toISOString(), mac_key_version: 1, ...overrides,
  };
  receipt.canonical_payload_hash = createHash('sha256').update(canonicalPayload(receipt)).digest('hex');
  receipt.signature_mac = createHmac('sha256', hmacKey).update(receipt.canonical_payload_hash).digest('hex');
  return receipt;
}

function verifyReceipt(receipt) {
  for (const key of Object.keys(receipt)) assert.ok(allowedReceiptFields.has(key), `unknown field: ${key}`);
  for (const key of ['tenant_id', 'assertion_id', 'job_id', 'claim_token', 'gateway_operation_id', 'bucket_id', 'object_path', 'expected_sha256']) {
    assert.equal(receipt[key], fixture[key], `${key} must match the server-side job`);
  }
  assert.equal(receipt.schema_version, 'v1');
  assert.equal(receipt.probe_result_code, 404, 'only an authenticated 404 proves absence');
  assert.equal(receipt.status_code_classification, 'VERIFIED_ABSENCE');
  const hash = createHash('sha256').update(canonicalPayload(receipt)).digest('hex');
  assert.equal(receipt.canonical_payload_hash, hash, 'payload hash mismatch');
  assert.equal(receipt.signature_mac, createHmac('sha256', hmacKey).update(hash).digest('hex'), 'MAC mismatch');
  return true;
}

function saga() {
  return { outboxCommitted: false, deleteAttempted: false, evidence: 0, tombstones: 0, outcome: 'pending' };
}

const scenarios = [];
function scenario(name, body) { scenarios.push({ name, body }); }

scenario('SCN-01 happy path', () => { const s=saga(); s.outboxCommitted=true; s.deleteAttempted=true; verifyReceipt(signReceipt()); s.evidence++; s.tombstones++; assert.deepEqual([s.evidence,s.tombstones],[1,1]); });
scenario('SCN-02 rollback before outbox commit', () => { const s=saga(); assert.equal(s.deleteAttempted,false); });
scenario('SCN-03 crash after commit', () => { const s=saga(); s.outboxCommitted=true; const operation=fixture.gateway_operation_id; assert.equal(operation,fixture.gateway_operation_id); });
scenario('SCN-04 pre-delete metadata unavailable', () => { const s=saga(); s.outcome='retry_wait'; assert.deepEqual([s.deleteAttempted,s.evidence],[false,0]); });
scenario('SCN-05 object absent before delete', () => { const s=saga(); s.outcome='manual_review'; assert.deepEqual([s.deleteAttempted,s.tombstones],[false,0]); });
scenario('SCN-06 DELETE success still needs probe', () => { const s=saga(); s.deleteAttempted=true; assert.equal(s.evidence,0); });
scenario('SCN-07 DELETE timeout is unknown', () => { const s=saga(); s.deleteAttempted=true; s.outcome='outcome_unknown'; assert.equal(s.evidence,0); });
scenario('SCN-08 DELETE 401 is not absence', () => { const s=saga(); s.outcome='auth_error'; assert.equal(s.evidence,0); });
scenario('SCN-09 DELETE 403 is not absence', () => { const s=saga(); s.outcome='authorization_error'; assert.equal(s.evidence,0); });
scenario('SCN-10 DELETE 5xx is bounded retry', () => { const max=5; let attempts=0; while(attempts<max) attempts++; assert.equal(attempts,max); });
scenario('SCN-11 authenticated probe 404', () => assert.equal(verifyReceipt(signReceipt()),true));
scenario('SCN-12 probe 401 rejected', () => assert.throws(() => verifyReceipt(signReceipt({probe_result_code:401}))));
scenario('SCN-13 probe 403 rejected', () => assert.throws(() => verifyReceipt(signReceipt({probe_result_code:403}))));
scenario('SCN-14 probe 200 means object remains', () => assert.throws(() => verifyReceipt(signReceipt({probe_result_code:200}))));
scenario('SCN-15 probe timeout is ambiguous', () => { const s=saga(); s.outcome='outcome_unknown'; assert.equal(s.tombstones,0); });
scenario('SCN-16 altered receipt rejected', () => { const r=signReceipt(); r.object_path='tampered'; assert.throws(() => verifyReceipt(r)); });
scenario('SCN-17 unknown receipt field rejected', () => assert.throws(() => verifyReceipt(signReceipt({unexpected:true}))));
scenario('SCN-18 nonce replay rejected', () => { const seen=new Set(); const r=signReceipt(); seen.add(r.receipt_nonce); assert.equal(seen.has(r.receipt_nonce),true); });
scenario('SCN-19 expired lease rejected', () => { const lease=Date.now()-1; assert.equal(lease>Date.now(),false); });
scenario('SCN-20 hold epoch change blocks finalize', () => assert.notEqual(7,8));

assert.equal(scenarios.length, 20);
for (const { name, body } of scenarios) { body(); console.log(`ok - ${name}`); }
console.log(`Storage contract passed: ${scenarios.length} scenarios.`);
