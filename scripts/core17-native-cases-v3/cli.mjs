#!/usr/bin/env node
/** Default is local dry-run; execute/recover need an exact reviewed request digest. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {newPlan,dryRun,digest,validateRequest,exampleRequest} from './contract.mjs';
const [mode,file,expected,...extra]=process.argv.slice(2);assert.equal(extra.length,0);
if(mode==='example-request'){assert.equal(file,undefined);console.log(JSON.stringify(exampleRequest(),null,2));}
else if(mode==='new-plan'){assert.equal(file,undefined);console.log(JSON.stringify(newPlan(),null,2));}
else if(mode==='dry-run'){assert.ok(file);assert.equal(expected,undefined);console.log(JSON.stringify(dryRun(JSON.parse(readFileSync(file))),null,2));}
else if(['prepare-hook','bind-listener','execute','recover-readonly'].includes(mode)){
 assert.match(expected??'',/^[a-f0-9]{64}$/,'EXACT_REVIEWED_REQUEST_DIGEST_REQUIRED');
 const bytes=readFileSync(file);assert.equal(digest(bytes),expected,'EXECUTION_REQUEST_CHANGED');
 const request=validateRequest(JSON.parse(bytes));
 // Dynamic import is deliberately below digest/schema validation. A malformed
 // request cannot create a PG/Auth client, fixture or fault.
 if(mode==='prepare-hook'||mode==='bind-listener'){const hookModule=await import('./hook-control.mjs');const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));const value=mode==='prepare-hook'?hookModule.prepareHook(request,root):await hookModule.bindCurrentListener(request);console.log(JSON.stringify(value));process.exit(0);}
 const {executeCases}=await import('./operator.mjs');
 try{const evidence=await executeCases(request,{root:resolve(fileURLToPath(new URL('../../',import.meta.url))),recovery:mode==='recover-readonly'});console.log(JSON.stringify({state:evidence.state,private_evidence:true,run:request.plan.run}));}
 catch(error){console.error(JSON.stringify({state:'FAILED_OR_UNKNOWN_STOP',error_type:error.name,private_diagnostic:true,automatic_retry:false}));process.exitCode=1;}
}else throw Error('CLOSED_MODES: example-request (SYNTHETIC_NOT_EXECUTABLE_TARGET) | new-plan | dry-run REQUEST | prepare-hook REQUEST SHA256 | bind-listener REQUEST SHA256 | execute REQUEST SHA256 | recover-readonly REQUEST SHA256');
