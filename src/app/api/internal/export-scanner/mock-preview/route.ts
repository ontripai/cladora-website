import {createHash,timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server.js';
import {createMockExportScanner} from '../../../../../lib/server/export-scanner-contract.ts';
import {runExportScannerWorkerOnce,type ExportScanQueuePort} from '../../../../../lib/server/export-scanner-worker.ts';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const HEADERS={'Cache-Control':'no-store, private',Pragma:'no-cache','X-Content-Type-Options':'nosniff'};
const FIXTURE=Buffer.from('CLADORA preview-only scanner runtime fixture');

function authorized(value:string|null,secret:string){
  const expected=Buffer.from(`Bearer ${secret}`);const actual=Buffer.from(value??'');
  return expected.length===actual.length&&timingSafeEqual(expected,actual);
}

export async function GET(request:Request){
  if(process.env.VERCEL_ENV!=='preview')return NextResponse.json({error:{code:'NOT_FOUND'}},{status:404,headers:HEADERS});
  const secret=process.env.CRON_SECRET;
  if(!secret||secret.length<32)return NextResponse.json({error:{code:'PREVIEW_RUNTIME_NOT_CONFIGURED'}},{status:503,headers:HEADERS});
  if(!authorized(request.headers.get('authorization'),secret))return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:HEADERS});
  if(process.env.EXPORT_SCANNER_MOCK_PREVIEW_ENABLED!=='true')return NextResponse.json({error:{code:'MOCK_PREVIEW_DISABLED'}},{status:503,headers:HEADERS});

  const hash=createHash('sha256').update(FIXTURE).digest('hex');let completed=false;
  const queue:ExportScanQueuePort={
    async claim(){return {jobId:'preview-job-001',leaseToken:'preview-lease-001',artifactId:'preview-artifact-001',tenantId:'synthetic-preview',bucketId:'export-artifact-vault',objectPath:'synthetic-preview/runtime-fixture.txt',contentSha256:hash,byteSize:FIXTURE.length,mediaType:'text/plain',provider:'mock',attemptCount:1,maxAttempts:1,leaseUntil:new Date(Date.now()+60_000).toISOString()}},
    async complete(){completed=true},
    async fail(){return {state:'dead_letter',attemptCount:1,maxAttempts:1}}
  };
  const result=await runExportScannerWorkerOnce({workerId:'preview-mock-worker',scanner:createMockExportScanner({behavior:'clean',testSigningKey:'preview-fixture-key-not-a-secret'}),queue,objects:{async download(){return FIXTURE}},maxObjectBytes:1024});
  return NextResponse.json({mode:'synthetic_mock_preview',completed,result:result.outcome},{headers:HEADERS});
}
