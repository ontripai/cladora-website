import {createHash,createHmac} from 'node:crypto';

export type ExportScanVerdict='clean'|'malicious'|'error';
export type ExportScanJob={jobId:string;leaseToken:string;artifactId:string;contentSha256:string;buffer:Buffer};
export type ExportScanAttestation={provider:string;providerScanId:string;verdict:ExportScanVerdict;contentSha256:string;keyId:string;signature:string;scannedAt:string};
export interface ExportMalwareScanner{readonly provider:string;scan(job:ExportScanJob):Promise<ExportScanAttestation>}

export function canonicalScanAttestation(value:Omit<ExportScanAttestation,'signature'>){
  return [value.provider,value.providerScanId,value.verdict,value.contentSha256,value.keyId,value.scannedAt].join('\n');
}

export function createMockExportScanner(options:{behavior:ExportScanVerdict;testSigningKey:string;clock?:()=>Date}):ExportMalwareScanner{
  if(options.testSigningKey.length<16)throw new Error('mock_scanner_test_key_too_short');
  return {provider:'mock',async scan(job){
    const actual=createHash('sha256').update(job.buffer).digest('hex');
    if(actual!==job.contentSha256)throw new Error('export_scan_content_mismatch');
    const unsigned={provider:'mock',providerScanId:`mock-${job.jobId}-${job.contentSha256.slice(0,12)}`,verdict:options.behavior,
      contentSha256:actual,keyId:'mock-test-key-v1',scannedAt:(options.clock?.()??new Date()).toISOString()};
    return {...unsigned,signature:createHmac('sha256',options.testSigningKey).update(canonicalScanAttestation(unsigned)).digest('hex')};
  }};
}
