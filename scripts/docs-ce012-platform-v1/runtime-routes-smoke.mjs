/** Expanded pure operations, guarded source transpile and schema validation only. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {RuntimeRoutes,POLICY_SHA256} from './runtime-routes.mjs';
import {runtimeFiles,lockModules} from './worker.mjs';
import {need,Hold,sha,canonical} from './contract.mjs';
import {fenceExternalNetwork} from './transport.mjs';
export const SOURCES=Object.freeze([
 'src/lib/customer/documents-ce012-reference-contract.ts',
 'src/lib/community/experience-guide-command-contract.ts',
 'src/lib/core/current-authority-transaction-port-v1.ts',
 'src/lib/security/same-origin.ts',
]);
export function expandedSmoke(root,runtime){
  need(process.permission?.has('fs.read',root)&&!process.permission.has('fs.write',root)
    &&!process.permission.has('child')&&!process.permission.has('addons'),'READ_ONLY_SMOKE_PERMISSION_REQUIRED');
  const pins=runtimeFiles(root,{runtime,artifacts:[]});const guard=new RuntimeRoutes(root,runtime,{mode:'source-smoke'});
  const restoreGuard=guard.install(),restoreLoader=lockModules(root,pins,{routes:guard});
  const evidence={kind:'PURE_LIBRARY_AND_PINNED_SOURCE_ONLY',operations:[],consumer_run:'NOT_RUN',connection:'NOT_RUN',auth:'NOT_RUN'};
  try{
    fenceExternalNetwork();const ts=guard.require('typescript');
    for(const relative of SOURCES){
      const input=guard.readSource(relative),result=ts.transpileModule(input,{compilerOptions:{module:1,target:9}});
      need(result.outputText.length>0&&result.diagnostics.length===0,'PINNED_SOURCE_TRANSPILE_FAILED');
      evidence.operations.push({operation:'transpile_pinned_source',path:relative,input_sha256:sha(Buffer.from(input)),output_sha256:sha(Buffer.from(result.outputText)),status:'PASS_IN_MEMORY'});
    }
    // Real library parser, no Client/Pool construction and no network operation.
    const parser=guard.require('pg-connection-string',path.join(root,'node_modules/pg/lib/connection-parameters.js'));
    const parsed=parser.parse('postgresql://cladora_ce_guide_runtime@127.0.0.1:5432/docs_ce012_0000000000000000');
    need(parsed.host==='127.0.0.1'&&parsed.port==='5432'&&parsed.user==='cladora_ce_guide_runtime'&&!parsed.ssl,'FIXED_PG_PARSE');
    evidence.operations.push({operation:'fixed_connection_string_parse',status:'PASS_NO_CONNECTION',input_role:'SHAPE_ONLY_NOT_FIXTURE'});
    // Evaluate only this exact pinned pure schema module, never a provider/selector.
    const source=guard.readSource(SOURCES[0]);const output=ts.transpileModule(source,{compilerOptions:{module:1,target:9}}).outputText;
    const context=vm.createContext({require:name=>{need(name==='zod','SCHEMA_IMPORT');return guard.require(name);}}, {codeGeneration:{strings:false,wasm:false}});
    new vm.Script('var module={exports:{}};var exports=module.exports;').runInContext(context,{timeout:2000});
    new vm.Script(output,{filename:'pinned-documents-reference-schema.js'}).runInContext(context,{timeout:2000});
    context.__result=context.module.exports.docsCe012ReferenceRequestV1Schema.safeParse({});
    need(context.__result.success===false,'DOCUMENTS_SCHEMA_EMPTY_INPUT_MUST_DENY');
    evidence.operations.push({operation:'real_pinned_documents_schema',status:'PASS_EMPTY_SHAPE_REJECTED',fixture:'NONE'});
    const pg=guard.require('pg');need(typeof pg.Client==='function'&&typeof pg.Pool==='function','PG_EXPORTS');
    for(const name of ['next/headers.js','@supabase/ssr']){guard.require(name);evidence.operations.push({operation:'load',module:name,status:'PASS_LOAD_ONLY'});}
    guard.healthy();
    evidence.result='PASS_EXPANDED_SOURCE_SMOKE';evidence.policy_status=guard.status;
    evidence.policy_sha256=POLICY_SHA256;
    evidence.original_graph_sha256=runtime.graph_sha256;
    evidence.original_file_pins_sha256=sha(Buffer.from(canonical(runtime.files)));
    evidence.runtime_ready=false;evidence.execution_authorized=false;return evidence;
  }finally{restoreLoader();restoreGuard();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const args=process.argv.slice(2);need(args.length===4&&args[0]==='--root'&&args[2]==='--pins','CLOSED_ROUTE_SMOKE_CLI');
    console.log(JSON.stringify(expandedSmoke(path.resolve(args[1]),JSON.parse(fs.readFileSync(args[3])))));
  }catch(error){console.log(JSON.stringify({result:'BLOCKED',code:error instanceof Hold?error.code:error.code??'SOURCE_SMOKE_FAILED',connection:'NOT_RUN',execution_authorized:false}));process.exitCode=2;}
}
