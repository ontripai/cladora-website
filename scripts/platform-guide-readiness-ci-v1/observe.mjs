/** Same-lane read-only observation; workflow SHA is distinct from App/tool SHA. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {openSync,readFileSync,realpathSync,statSync,writeSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const need=(x,code)=>assert.ok(x,code);
const sha=b=>createHash('sha256').update(b).digest('hex');
const temp=process.env.RUNNER_TEMP;
const stage='same-lane-job-cli';
function save(name,value){
 const data=Buffer.from(JSON.stringify(value,null,2)+'\n');need(data.length<65536,'RECEIPT_BOUND');
 const path=join(temp,'guide-readiness-receipts',name),fd=openSync(path,'wx',0o600);
 try{let at=0;while(at<data.length){const n=writeSync(fd,data,at);need(n>0,'RECEIPT_SHORT_WRITE');at+=n;}fsyncSync(fd);}finally{closeSync(fd);}
 need(readFileSync(path).equals(data),'RECEIPT_READBACK');
}
async function getJson(suffix){
 const response=await fetch('https://api.github.com/repos/ontripai/cladora-website/actions/runs/'+suffix,
  {headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN},
   redirect:'error',signal:AbortSignal.timeout(15000)});
 need(response.ok,'NATIVE_JOB_API_FAILED');
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 try{for(;;){const x=await reader.read();if(x.done)break;bytes+=x.value.byteLength;
  if(bytes>262144){await reader.cancel();throw Error('API_BOUND');}chunks.push(Buffer.from(x.value));}}
 finally{reader.releaseLock();}
 return JSON.parse(Buffer.concat(chunks,bytes).toString('utf8'));
}
function snapshot(path){
 const realpath=realpathSync(path),s=statSync(realpath);need(s.isFile()&&s.size>0&&s.size<=134217728,'CLI_FILE_BOUND');
 return {realpath,device:s.dev,inode:s.ino,bytes:s.size,sha256:sha(readFileSync(realpath))};
}
async function main(){
 need(temp&&realpathSync(temp)===temp,'RUNNER_TEMP_ALIAS');
 const e=process.env;
 need(e.GITHUB_ACTIONS==='true'&&e.GITHUB_REPOSITORY==='ontripai/cladora-website'
  &&e.GITHUB_EVENT_NAME==='workflow_dispatch'&&e.GITHUB_REF==='refs/heads/main'
  &&e.GITHUB_JOB==='guide-owned-preflight'&&e.GITHUB_TOKEN,'FIXED_ACTUAL_JOB_REQUIRED');
 const closure=JSON.parse(readFileSync(join(temp,'guide-readiness-receipts/source-closure.json'),'utf8'));
 need(closure.source.Head==='9064c7844657d7f0bfc16c20461100356b673362'
  &&closure.source.Tree==='ea64978b0fd3ecbb33b5ce8416e60e524b7b6ae2'
  &&closure.tool.Head==='aba19c2855973258e6edac80a5d4ba68e2c24e01'
  &&closure.history.Head==='26f8df8a023095c6adbd7184445eee62fc3ddff9'
  &&closure.result.complete_closure===true,'SOURCE_CLOSURE_REQUIRED');
 const workflow=execFileSync('git',['-C',e.GITHUB_WORKSPACE,'rev-parse','HEAD'],
  {encoding:'utf8',timeout:10000,maxBuffer:8192}).trim();
 need(workflow===e.GITHUB_SHA,'WORKFLOW_CHECKOUT_MISMATCH');
 const {checkJob,checkCli}=await import(pathToFileURL(join(temp,'guide-readiness-tool/scripts/platform-guide-ci-lane-v1/job-proof.mjs')).href);
 const ctx={actions:true,repository:e.GITHUB_REPOSITORY,event:e.GITHUB_EVENT_NAME,ref:e.GITHUB_REF,
  job:e.GITHUB_JOB,runId:e.GITHUB_RUN_ID,attempt:e.GITHUB_RUN_ATTEMPT,sha:workflow};
 const observe=async()=>checkJob(ctx,await getJson(ctx.runId),
  await getJson(ctx.runId+'/attempts/'+ctx.attempt+'/jobs?per_page=100'),workflow);
 await observe();
 const path=execFileSync('which',['supabase'],{encoding:'utf8',timeout:10000,maxBuffer:8192}).trim();
 const before=snapshot(path);let version;
 for(const args of [['--version'],['start','--help'],['status','--help'],['stop','--help']]){
  const output=execFileSync(before.realpath,args,{encoding:'utf8',timeout:10000,maxBuffer:131072});
  if(args[0]==='--version')version=output;
  checkCli(before,version,snapshot(path));
 }
 const job=await observe(),cli=checkCli(before,version,snapshot(path));
 save('job-cli-preflight.json',{contract:'platform.guide-readiness-ci-observation.v1',workflow_source:workflow,
  application:closure.source,tool:closure.tool,history:closure.history,job,cli,
  source_projection:closure.materialization,source_closure:'MATCH_SOURCE_ONLY',
  preflight:'HOLD',open_gates:['target','role/lease','resources/capture/watchdog/fence','window','observer','execution_admission'],
  target:null,permit:null,execution_approval:false,native_ACK:false,native:'NOT_RUN',mutation_dispatches:0});
 console.log('GUIDE_JOB_CLI_OBSERVED_PREFLIGHT_HOLD');
}
try{await main();}catch(error){
 const code=/^[A-Z0-9_]+$/.test(error.message??'')?error.message:'JOB_CLI_OBSERVATION_UNKNOWN';
 try{save('first-error.json',{stage,code,preflight:'HOLD',job_CLI:'NOT_VERIFIED',native:'NOT_RUN',permit:null});}catch{}
 console.error('GUIDE_JOB_CLI_HOLD');process.exitCode=2;
}
