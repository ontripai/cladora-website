/** Limited isolated load/resolution smoke; never run.mjs, client.connect or Auth. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { sha, canonical, need, Hold } from './contract.mjs';
import { runtimeFiles, lockModules } from './worker.mjs';
import { fenceExternalNetwork } from './transport.mjs';
export function smoke(root,runtime){
  need(process.permission?.has('fs.read',root) && !process.permission.has('fs.write',root)
    && !process.permission.has('child') && !process.permission.has('addons'),'READ_ONLY_SMOKE_PERMISSION_REQUIRED');
  const pins=runtimeFiles(root,{runtime,artifacts:[]});
  const restore=lockModules(root,pins),result={loads:[],effects:'NONE',external_connection:'NOT_RUN',consumer_run:'NOT_RUN'};
  try{
    fenceExternalNetwork();
    const require=createRequire(path.join(root,'package.json'));
    const pg=require('pg');need(typeof pg.Client==='function'&&typeof pg.Pool==='function','PG_EXPORT_SHAPE');
    result.loads.push({module:'pg',status:'PASS_LOAD_ONLY'});
    const ts=require('typescript');need(ts.version==='5.9.3','TYPESCRIPT_VERSION');
    const compiled=ts.transpileModule('const value: number = 17;', {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
    need(compiled.outputText.includes('17'),'TYPESCRIPT_SMOKE');result.loads.push({module:'typescript',status:'PASS_IN_MEMORY_TRANSPILE'});
    const z=require('zod');need(z.z.object({value:z.z.number().int()}).parse({value:17}).value===17,'ZOD_SMOKE');
    result.loads.push({module:'zod',status:'PASS_IN_MEMORY_PARSE'});
    for(const mod of ['next/headers.js','@supabase/ssr']){
      try{require(mod);result.loads.push({module:mod,status:'PASS_LOAD_ONLY'});}
      catch(error){result.loads.push({module:mod,status:'BLOCKED',code:error.code??'UNRESOLVED_LOAD'});}
    }
    // Native/lazy/dynamic branches are not activated. Explicit negative resolution only.
    for(const name of ['pg-native','not-a-reviewed-runtime-package']){
      let rejected=false;try{require(name);}catch{rejected=true;}
      need(rejected,'UNREVIEWED_RESOLUTION_ACCEPTED');
    }
    result.result=result.loads.every(v=>v.status.startsWith('PASS'))?'PASS_LIMITED_SMOKE':'PARTIAL_LOAD_BLOCKED';
    result.closure_complete=runtime.graph.blocked.length===0;
    result.execution_admissible=false; // smoke evidence never grants runtime admission
    result.runtime_graph_sha256=runtime.graph_sha256;
    result.file_pins_sha256=sha(Buffer.from(canonical(runtime.files)));
    return result;
  }finally{restore();}
}
export function main(args=process.argv.slice(2)){
  need(args.length===4&&args[0]==='--root'&&args[2]==='--pins','CLOSED_SMOKE_CLI');
  const root=path.resolve(args[1]),runtime=JSON.parse(fs.readFileSync(args[3]));
  const result=smoke(root,runtime);console.log(JSON.stringify(result));return result.result==='PASS_LIMITED_SMOKE'?0:2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.exitCode=main();}catch(error){console.log(JSON.stringify({result:'BLOCKED',code:error instanceof Hold?error.code:error.code??'SMOKE_FAILED',effects:'NONE',execution_admissible:false}));process.exitCode=2;}
}
