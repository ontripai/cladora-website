/** Cold fixed library operation on all20 pinned sources; never execute output. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {need,Hold,sha} from './contract.mjs';
import {RuntimeRoutes,POLICY_SHA256,readPolicy} from './runtime-routes.mjs';
import {runtimeFiles,lockModules} from './worker.mjs';
import {verifyComplete} from './runtime-materialization.mjs';
import {fenceExternalNetwork} from './transport.mjs';
export function coldOperations(root,runtime){
  need(process.permission?.has('fs.read',root)&&!process.permission.has('fs.write',root)
    &&!process.permission.has('child')&&!process.permission.has('addons'),'READ_ONLY_SMOKE_PERMISSION_REQUIRED');
  const material=verifyComplete(root,root,runtime),pins=runtimeFiles(root,{runtime,artifacts:[]});fenceExternalNetwork();
  const operations=[];
  for(const pin of readPolicy().required_source_pins){
    // Fresh module cache, no-Node realm and compiler for EACH source. No emitted
    // source is evaluated, imported or used as a product/fixture/receipt.
    const guard=new RuntimeRoutes(root,runtime),r1=guard.install(),r2=lockModules(root,pins,{routes:guard});
    try{const ts=guard.require('typescript'),source=guard.readSource(pin.path),output=ts.transpileModule(source,{compilerOptions:{module:1,target:9}});
      need(output.diagnostics.length===0,'COLD_SOURCE_DIAGNOSTIC');guard.healthy();
      operations.push({path:pin.path,input_sha256:sha(Buffer.from(source)),output_bytes:Buffer.byteLength(output.outputText),output_sha256:sha(Buffer.from(output.outputText)),
        diagnostics:output.diagnostics.length,cold_realm:true,capability:guard.capabilityEvidence(),result:'PASS_FIXED_IN_MEMORY_OPERATION'});
    }finally{r2();r1();}
  }
  need(operations.length===20,'TWENTY_COLD_OPERATIONS_REQUIRED');
  return {format:'documents-ce012-twenty-cold-operations.v1',result:'PASS_SOURCE_OPERATION_ONLY',materialization_seal:material.sha256,material_files:material.count,
    verifyMaterials:material.verifyMaterials,policy_sha256:POLICY_SHA256,operations,output_execution:'NOT_RUN',producer_import:'NOT_RUN',consumer_run:'NOT_RUN',
    client_pool_construction:'NOT_RUN',connection:'NOT_RUN',sql:'NOT_RUN',auth:'NOT_RUN',session:'NOT_RUN',runtime_binding:null,live:'HOLD'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const a=process.argv.slice(2);need(a.length===4&&a[0]==='--root'&&a[2]==='--pins','CLOSED_COLD_CLI');
    console.log(JSON.stringify(coldOperations(path.resolve(a[1]),JSON.parse(fs.readFileSync(a[3])))));
  }catch(error){console.log(JSON.stringify({result:'BLOCKED',code:error instanceof Hold?error.code:error.code??'COLD_SOURCE_FAILED',live:'HOLD'}));process.exitCode=2;}
}
