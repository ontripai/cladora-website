import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createMockExportScanner} from '../src/lib/server/export-scanner-contract.ts';
import {exportArtifactStatusMessage} from '../src/lib/customer/export-artifact-errors.ts';

const migration=fs.readFileSync('supabase/migrations/20260914093410_export_scanner_provider_neutral_queue.sql','utf8');
const test=fs.readFileSync('supabase/tests/083_export_scanner_provider_neutral_queue.test.sql','utf8');
const route=fs.readFileSync('src/app/api/customer/v1/exports/[id]/route.ts','utf8');
const badge=fs.readFileSync('src/components/customer/ExportArtifactScanStatus.tsx','utf8');
for(const contract of ['skip locked','dead_letter','export_scan_job_lease_invalid','record_export_artifact_scan_v1','export-artifact-vault'])assert.match(migration,new RegExp(contract,'i'));
assert.match(test,/select plan\(43\)/);
assert.match(route,/status_message:exportArtifactStatusMessage/);assert.match(route,/no-store, private/);
assert.match(badge,/role="status"/);assert.match(badge,/ExportArtifactScanStatus/);
const buffer=Buffer.from('CLADORA scanner fixture only');
const contentSha256=createHash('sha256').update(buffer).digest('hex');
for(const behavior of ['clean','malicious','error']){
  const scanner=createMockExportScanner({behavior,testSigningKey:'fixture-only-key-not-a-secret',clock:()=>new Date('2026-09-14T09:00:00.000Z')});
  const result=await scanner.scan({jobId:'job-001',leaseToken:'lease-001',artifactId:'artifact-001',contentSha256,buffer});
  assert.equal(result.provider,'mock');assert.equal(result.verdict,behavior);assert.equal(result.contentSha256,contentSha256);assert.match(result.signature,/^[0-9a-f]{64}$/);
}
await assert.rejects(()=>createMockExportScanner({behavior:'clean',testSigningKey:'fixture-only-key-not-a-secret'}).scan({jobId:'job-002',leaseToken:'lease-002',artifactId:'artifact-002',contentSha256:'0'.repeat(64),buffer}),/export_scan_content_mismatch/);
for(const lang of ['ro','en','fa'])for(const status of ['not_materialized','scanning_pending','clean','quarantined','scan_failed'])assert.ok(exportArtifactStatusMessage(status,lang).length>8);
console.log('CLADORA-P2-EXPORT-SCANNER-001A: provider-neutral queue, mock scanner and RO/EN/FA status PASS.');
