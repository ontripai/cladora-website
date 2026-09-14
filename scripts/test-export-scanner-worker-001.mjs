import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createMockExportScanner} from '../src/lib/server/export-scanner-contract.ts';
import {runExportScannerWorkerOnce} from '../src/lib/server/export-scanner-worker.ts';
import {exportArtifactStatusMessage} from '../src/lib/customer/export-artifact-errors.ts';

const bytes=Buffer.from('CLADORA synthetic export scanner worker fixture');
const sha256=createHash('sha256').update(bytes).digest('hex');
const fixedClock=()=>new Date('2026-09-14T10:30:00.000Z');
const scanner=(behavior)=>createMockExportScanner({behavior,testSigningKey:'fixture-only-key-not-a-secret',clock:fixedClock});

class MemoryQueue{
  constructor({maxAttempts=3,available=true}={}){this.maxAttempts=maxAttempts;this.available=available;this.attemptCount=0;this.state='pending';this.completed=[];this.failures=[];}
  async claim({provider,workerId,leaseSeconds}){
    if(!this.available||this.state==='completed'||this.state==='dead_letter')return null;
    this.attemptCount+=1;this.state='leased';this.leaseToken=`lease-${this.attemptCount}`;
    this.claimInput={provider,workerId,leaseSeconds};
    return {jobId:'job-001',leaseToken:this.leaseToken,artifactId:'artifact-001',tenantId:'tenant-001',bucketId:'export-artifact-vault',objectPath:'tenant-001/export-001/report.pdf',contentSha256:sha256,byteSize:bytes.length,mediaType:'application/pdf',provider,attemptCount:this.attemptCount,maxAttempts:this.maxAttempts,leaseUntil:'2026-09-14T10:32:00.000Z'};
  }
  async complete(input){assert.equal(input.leaseToken,this.leaseToken);this.completed.push(input);this.state='completed';}
  async fail(input){assert.equal(input.leaseToken,this.leaseToken);this.failures.push(input);this.state=this.attemptCount>=this.maxAttempts?'dead_letter':'retry';return {state:this.state,attemptCount:this.attemptCount,maxAttempts:this.maxAttempts};}
}
const objects={downloads:0,async download({bucketId,objectPath}){this.downloads+=1;assert.equal(bucketId,'export-artifact-vault');assert.equal(objectPath,'tenant-001/export-001/report.pdf');return bytes;}};
const run=(queue,scan=scanner('clean'),store=objects)=>runExportScannerWorkerOnce({workerId:'mock-worker-001',scanner:scan,queue,objects:store,leaseSeconds:120,retryAfterSeconds:5,maxObjectBytes:1024});

const idle=await run(new MemoryQueue({available:false}));
assert.deepEqual(idle,{outcome:'idle'});

const cleanQueue=new MemoryQueue();const clean=await run(cleanQueue);
assert.equal(clean.outcome,'completed');assert.equal(clean.verdict,'clean');assert.equal(cleanQueue.state,'completed');assert.equal(cleanQueue.completed.length,1);assert.equal(cleanQueue.completed[0].attestation.contentSha256,sha256);assert.match(cleanQueue.completed[0].attestation.signature,/^[0-9a-f]{64}$/);assert.deepEqual(cleanQueue.claimInput,{provider:'mock',workerId:'mock-worker-001',leaseSeconds:120});

for(const verdict of ['malicious','error']){const queue=new MemoryQueue();const result=await run(queue,scanner(verdict));assert.equal(result.outcome,'completed');assert.equal(result.verdict,verdict);assert.equal(queue.completed[0].attestation.verdict,verdict);}

const mismatchQueue=new MemoryQueue();const mismatchStore={async download(){return Buffer.alloc(bytes.length,88);}};
const mismatch=await run(mismatchQueue,scanner('clean'),mismatchStore);
assert.equal(mismatch.outcome,'retry');assert.equal(mismatch.errorCode,'WORKER_CONTENT_MISMATCH');assert.equal(mismatchQueue.completed.length,0);assert.equal(mismatchQueue.failures.length,1);

const completionQueue=new MemoryQueue();completionQueue.complete=async()=>{throw new Error('ambiguous completion transport');};
await assert.rejects(()=>run(completionQueue),/ambiguous completion transport/);assert.equal(completionQueue.failures.length,0);

const transportQueue=new MemoryQueue({maxAttempts:2});const brokenScanner={provider:'mock',async scan(){throw new Error('provider detail must not escape');}};
const first=await run(transportQueue,brokenScanner);assert.equal(first.outcome,'retry');assert.equal(first.errorCode,'WORKER_SCAN_FAILED');
const second=await run(transportQueue,brokenScanner);assert.equal(second.outcome,'dead_letter');assert.equal(transportQueue.state,'dead_letter');assert.equal(transportQueue.failures.length,2);assert.equal(transportQueue.failures[1].errorCode,'WORKER_SCAN_FAILED');
const exhausted=await run(transportQueue,brokenScanner);assert.equal(exhausted.outcome,'idle');

for(const lang of ['ro','en','fa']){
  assert.ok(exportArtifactStatusMessage('scanning_pending',lang).length>8);
  assert.ok(exportArtifactStatusMessage('clean',lang).length>8);
  assert.ok(exportArtifactStatusMessage('quarantined',lang).length>8);
  assert.ok(exportArtifactStatusMessage('scan_failed',lang).length>8);
}

const worker=fs.readFileSync('src/lib/server/export-scanner-worker.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20260914093410_export_scanner_provider_neutral_queue.sql','utf8');
assert.match(worker,/from 'node:crypto'/);assert.match(worker,/queue\.claim/);assert.match(worker,/queue\.complete/);assert.match(worker,/queue\.fail/);assert.match(worker,/export-artifact-vault/);assert.doesNotMatch(worker,/process\.env|service_role|SUPABASE_SERVICE_ROLE_KEY|fetch\(/i);
for(const gateway of ['claim_export_artifact_scan_job_v1','fail_export_artifact_scan_job_v1','complete_export_artifact_scan_job_v1'])assert.match(migration,new RegExp(gateway));
assert.equal(fs.readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).length,96);
console.log('CLADORA-P2-EXPORT-SCANNER-WORKER-001: mock worker E2E, retry/dead-letter and RO/EN/FA PASS.');
