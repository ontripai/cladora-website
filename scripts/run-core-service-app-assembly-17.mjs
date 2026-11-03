/** Official next build/start profile for the owned development backend only.
 * NODE_ENV is never spoofed; Next sets production itself. Build receives only
 * browser-safe local selectors, never the runtime password/binding file.
 */
import assert from 'node:assert/strict';
import {readFileSync,openSync,appendFileSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const phase=process.argv[2];assert.ok(['build','start'].includes(phase));assert.equal(process.argv.length,3);
const root='/workspace/private/cladora-functional-dev-v1',read=n=>JSON.parse(readFileSync(root+'/'+n));
execFileSync('python3',['-I','-B','-c',"import importlib.util;from pathlib import Path;p=Path('/workspace/work/platform12-core15-input-794f5a1/scripts/functional-dev-stack-v1/stack.py');s=importlib.util.spec_from_file_location('p12',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process()"],{stdio:'pipe'});
for(const [receipt,source] of [['core17-install-receipt.json','read-access.sql'],['core17-catalog-compatibility-receipt.json','catalog-compatibility.sql']]){const r=read(receipt);assert.equal(r.state,'COMMIT_AND_READYFORQUERY_I');assert.equal(r.sha256,createHash('sha256').update(readFileSync(new URL('../supabase/install/core-service-app-assembly-v1/'+source,import.meta.url))).digest('hex'));}
const env={...process.env};
// The application child has no use for staging/admin selectors or credentials.
for(const key of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','SUPABASE_PROJECT_REF','CLADORA_STAGING_PROJECT_REF','CLADORA_STAGING_SUPABASE_URL','CLADORA_STAGING_SUPABASE_PUBLISHABLE_KEY'])delete env[key];delete env.NODE_ENV;delete env.CLADORA_CORE15_SERVICE_BINDING_FILE;delete env.CLADORA_CORE15_SERVICE_BINDING_SHA256;
assert.ok(!env.VERCEL&&!env.VERCEL_ENV&&!env.NEXT_PUBLIC_VERCEL_ENV);
Object.assign(env,{CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE:'core-service-real-app-assembly.v1',NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY:'v1',NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55421',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:read('secrets.json').anon_key});
if(phase==='start'){const i=read('core15/private-binding-identity.json');Object.assign(env,{CLADORA_CORE15_SERVICE_BINDING_FILE:i.path,CLADORA_CORE15_SERVICE_BINDING_SHA256:i.sha256});execFileSync('python3',['-I','-c',"import socket;s=socket.socket();assert s.connect_ex(('127.0.0.1',3008))!=0,'PORT_COLLISION';s.close()"],{stdio:'pipe'});}
const log=openSync(root+'/core17-'+phase+'.private.log','a',0o600);
const next=createRequire(import.meta.url).resolve('next/dist/bin/next'),args=phase==='build'?['build','--webpack']:['start','--hostname','127.0.0.1','--port','3008'];
const sourcePins=Object.fromEntries(['next.config.mjs','src/lib/supabase/env.ts','src/lib/core/functional-command-runtime-v1.ts','src/lib/core/private-service-development-binding-v1.ts','src/lib/core/service-app-read-v1.ts','src/app/api/customer/v1/services/assembly-bootstrap/route.ts','src/app/api/customer/v1/services/catalog/route.ts','src/app/api/customer/v1/services/requests/route.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const record=state=>appendFileSync(root+'/core17-'+phase+'-attempts.private.ndjson',JSON.stringify({phase,state,sourcePins,private_runtime_binding_passed_to_build:false})+'\n',{mode:0o600});record('START_DISPATCHED');
const child=spawn(process.execPath,[next,...args],{env,stdio:['ignore',log,log]});
child.on('exit',code=>{record('EXIT_'+String(code));console.log(JSON.stringify({phase,exit:code,profile:'core-service-real-app-assembly.v1',NODE_ENV:'set_by_Next_not_overridden',private_log:true}));process.exitCode=code??1;});
process.once('SIGINT',()=>child.kill('SIGINT'));process.once('SIGTERM',()=>child.kill('SIGTERM'));
