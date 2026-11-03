/** Affected shared-host controls + real Docs ABI in read-only Git source overlay. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
const doc='6f69db12455b9c750eae0c2a24c7a7c7faa16d3d';
const manifest=JSON.parse(readFileSync(resolve(root,'docs/contracts/core-ce012-replay-joint-seal-v1/manifest.json'),'utf8'));
const p=manifest.inventory.find(x=>x.path==='src/lib/core/postgres-transaction-host-v1.ts');assert.ok(p);
assert.equal(createHash('sha256').update(readFileSync(resolve(root,p.path))).digest('hex'),p.sha256);
const out=execFileSync(process.execPath,['scripts/test-core-host-terminal-lifecycle-11.mjs'],{cwd:root,encoding:'utf8'});assert.match(out,/"new_groups":22/);console.log('PASS 22 affected Core11 lifecycle/default write/rollback/UNKNOWN controls');
const path='scripts/test-core-host-terminal-regressions-11.mjs',text=readFileSync(resolve(root,path),'utf8');
assert.equal(text,execFileSync('git',['show','1eb8b5a1e522a529b39af02e32748756ee04dfec:'+path],{cwd:root,encoding:'utf8'}));
const old='../docs/contracts/core-host-terminal-lifecycle-v1/manifest.json',current='../docs/contracts/core-ce012-replay-joint-seal-v1/manifest.json';assert.equal(text.split(old).length,2);
const tmp=resolve(root,`scripts/.core13-regression-${randomUUID()}.mjs`);
try{writeFileSync(tmp,text.replace(old,current),{flag:'wx'});const out=execFileSync(process.execPath,[tmp],{cwd:root,encoding:'utf8'});assert.match(out,/"affected_regressions":11/);console.log('PASS 11 selected Core/CE/S01/SERVICE controls; exact current host pin, historical pins retained');}finally{unlinkSync(tmp);}
const missing=execFileSync(process.execPath,['scripts/test-core-ce012-replay-joint-seal-13.mjs','--missing-docs-module'],{cwd:root,encoding:'utf8'});assert.match(missing,/"new_groups":1/);console.log('PASS isolated missing-official-module fail-closed control');
// This overlay reads official owner source; no owner file or local shim is written.
const gitFiles=execFileSync('git',['ls-tree','-r','--name-only',doc,'--','src/lib/customer'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(x=>x.startsWith('src/lib/customer/documents-')&&x.endsWith('.ts'));
const paths=new Set(gitFiles.map(x=>resolve(root,x))),overlay=new Map();
const probe=resolve(root,'.core13-docs-abi-probe.ts');
overlay.set(probe,"import * as actual from './src/lib/customer/documents-ce012-target-disclosure-port-v1';\nimport type {CoreDocumentsJointOwnerModuleV1} from './src/lib/core/ce012-documents-joint-candidate-v1';\nconst bound:CoreDocumentsJointOwnerModuleV1=actual;void bound;\n");
const config=ts.readConfigFile(resolve(root,'tsconfig.json'),ts.sys.readFile);assert.equal(config.error,undefined);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
const options={...parsed.options,noEmit:true,incremental:false};
const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
host.fileExists=p=>overlay.has(resolve(p))||paths.has(resolve(p))||exists(p);
host.readFile=p=>{p=resolve(p);if(overlay.has(p))return overlay.get(p);if(paths.has(p)){const value=execFileSync('git',['show',doc+':'+relative(root,p)],{cwd:root,encoding:'utf8'});overlay.set(p,value);return value;}return read(p);};
host.getSourceFile=(p,target)=>{const text=host.readFile(p);return text===undefined?undefined:ts.createSourceFile(p,text,target,true);};
const program=ts.createProgram([probe],options,host),diagnostics=ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:p=>p,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
console.log(JSON.stringify({task:'CORE-CE012-REPLAY-JOINT-SEAL-13',affected_regressions:33,isolated_missing_module:1,official_Docs_ES5_ABI:'PASS_READ_ONLY_GIT_OVERLAY',source:doc,owner_files_written:0,sql_pg_auth:'NOT_RUN'}));
