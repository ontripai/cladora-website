import {createHash} from 'node:crypto';
import type {ExportMalwareScanner,ExportScanAttestation} from './export-scanner-contract';

export type ExportScanLease={
  jobId:string;
  leaseToken:string;
  artifactId:string;
  tenantId:string;
  bucketId:'export-artifact-vault';
  objectPath:string;
  contentSha256:string;
  byteSize:number;
  mediaType:string;
  provider:string;
  attemptCount:number;
  maxAttempts:number;
  leaseUntil:string;
};

export type ExportScanFailure={state:'retry'|'dead_letter';attemptCount:number;maxAttempts:number};
export type ExportScanWorkerResult=
  |{outcome:'idle'}
  |{outcome:'completed';jobId:string;verdict:ExportScanAttestation['verdict']}
  |{outcome:'retry'|'dead_letter';jobId:string;errorCode:string;attemptCount:number;maxAttempts:number};

export interface ExportScanQueuePort{
  claim(input:{provider:string;workerId:string;leaseSeconds:number}):Promise<ExportScanLease|null>;
  complete(input:{jobId:string;leaseToken:string;attestation:ExportScanAttestation}):Promise<void>;
  fail(input:{jobId:string;leaseToken:string;errorCode:string;retryAfterSeconds:number}):Promise<ExportScanFailure>;
}

export interface ExportScanObjectStore{
  download(input:{bucketId:'export-artifact-vault';objectPath:string}):Promise<Buffer>;
}

export type ExportScannerWorkerOptions={
  workerId:string;
  scanner:ExportMalwareScanner;
  queue:ExportScanQueuePort;
  objects:ExportScanObjectStore;
  leaseSeconds?:number;
  retryAfterSeconds?:number;
  maxObjectBytes?:number;
};

const SHA256=/^[0-9a-f]{64}$/;
const SAFE_ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;

function validateLease(lease:ExportScanLease,provider:string,maxObjectBytes:number){
  if(lease.provider!==provider)throw new Error('WORKER_PROVIDER_MISMATCH');
  if(lease.bucketId!=='export-artifact-vault')throw new Error('WORKER_BUCKET_INVALID');
  if(!lease.objectPath||lease.objectPath.startsWith('/')||lease.objectPath.includes('..'))throw new Error('WORKER_OBJECT_PATH_INVALID');
  if(!SHA256.test(lease.contentSha256))throw new Error('WORKER_CONTENT_HASH_INVALID');
  if(!Number.isSafeInteger(lease.byteSize)||lease.byteSize<0||lease.byteSize>maxObjectBytes)throw new Error('WORKER_OBJECT_SIZE_INVALID');
  if(!lease.jobId||!lease.leaseToken||lease.attemptCount<1||lease.attemptCount>lease.maxAttempts)throw new Error('WORKER_LEASE_INVALID');
}

function failureCode(error:unknown){
  const message=error instanceof Error?error.message:'';
  if(/^WORKER_[A-Z0-9_]{3,72}$/.test(message))return message;
  if(message==='export_scan_content_mismatch')return 'WORKER_CONTENT_MISMATCH';
  return 'WORKER_SCAN_FAILED';
}

function validateAttestation(attestation:ExportScanAttestation,lease:ExportScanLease){
  if(attestation.provider!==lease.provider||attestation.contentSha256!==lease.contentSha256)throw new Error('WORKER_ATTESTATION_MISMATCH');
  if(!['clean','malicious','error'].includes(attestation.verdict))throw new Error('WORKER_VERDICT_INVALID');
  if(!SAFE_ID.test(attestation.providerScanId)||!SAFE_ID.test(attestation.keyId))throw new Error('WORKER_ATTESTATION_ID_INVALID');
  if(!/^[0-9a-f]{64,512}$/.test(attestation.signature))throw new Error('WORKER_SIGNATURE_INVALID');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(attestation.scannedAt))throw new Error('WORKER_SCANNED_AT_INVALID');
}

export async function runExportScannerWorkerOnce(options:ExportScannerWorkerOptions):Promise<ExportScanWorkerResult>{
  const leaseSeconds=options.leaseSeconds??120;
  const retryAfterSeconds=options.retryAfterSeconds??60;
  const maxObjectBytes=options.maxObjectBytes??25*1024*1024;
  if(!SAFE_ID.test(options.workerId))throw new Error('WORKER_ID_INVALID');
  if(!SAFE_ID.test(options.scanner.provider))throw new Error('WORKER_PROVIDER_INVALID');
  if(!Number.isInteger(leaseSeconds)||leaseSeconds<30||leaseSeconds>600)throw new Error('WORKER_LEASE_SECONDS_INVALID');
  if(!Number.isInteger(retryAfterSeconds)||retryAfterSeconds<5||retryAfterSeconds>86400)throw new Error('WORKER_RETRY_SECONDS_INVALID');

  const lease=await options.queue.claim({provider:options.scanner.provider,workerId:options.workerId,leaseSeconds});
  if(!lease)return {outcome:'idle'};

  let attestation:ExportScanAttestation;
  try{
    validateLease(lease,options.scanner.provider,maxObjectBytes);
    const buffer=await options.objects.download({bucketId:lease.bucketId,objectPath:lease.objectPath});
    if(buffer.length!==lease.byteSize)throw new Error('WORKER_OBJECT_SIZE_MISMATCH');
    const actualHash=createHash('sha256').update(buffer).digest('hex');
    if(actualHash!==lease.contentSha256)throw new Error('WORKER_CONTENT_MISMATCH');
    attestation=await options.scanner.scan({jobId:lease.jobId,leaseToken:lease.leaseToken,artifactId:lease.artifactId,contentSha256:lease.contentSha256,buffer});
    validateAttestation(attestation,lease);
  }catch(error){
    const errorCode=failureCode(error);
    const failed=await options.queue.fail({jobId:lease.jobId,leaseToken:lease.leaseToken,errorCode,retryAfterSeconds});
    return {outcome:failed.state,jobId:lease.jobId,errorCode,attemptCount:failed.attemptCount,maxAttempts:failed.maxAttempts};
  }
  // Completion is deliberately outside the failure handler: an ambiguous RPC/network
  // result must be replayed through Migration 96's idempotent completion path, never
  // converted into a conflicting failure write.
  await options.queue.complete({jobId:lease.jobId,leaseToken:lease.leaseToken,attestation});
  return {outcome:'completed',jobId:lease.jobId,verdict:attestation.verdict};
}
