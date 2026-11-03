/** Read-only Git source overlay: no owner file copied/edited, no native execution. */
import ts from 'typescript';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),ref='4c3abd7c26d8ae393fdb6acb3f88330c7b887097';
const sourcePaths=['src/lib/customer/service-v14-execution/runtime-binding.ts','src/lib/customer/service-v14-execution/http.ts'];
const overlay=new Map(sourcePaths.map(path=>[resolve(root,path),execFileSync('git',['show',`${ref}:${path}`],{cwd:root,encoding:'utf8'})]));
const probe=resolve(root,'core15-service09-virtual-abi-check.ts');
overlay.set(probe,`import type {Pool} from 'pg';
import type {ServiceFunctionalRequestRuntimeBindingV1} from './src/lib/customer/service-v14-execution/runtime-binding';
import {createCoreServiceFunctionalBindingV1} from './src/lib/core/service-functional-binding-v1';
import type {CoreFunctionalDevelopmentTargetV1} from './src/lib/core/functional-command-runtime-v1';
declare const pool:Pool;declare const target:CoreFunctionalDevelopmentTargetV1;
const binding:ServiceFunctionalRequestRuntimeBindingV1=createCoreServiceFunctionalBindingV1({pool,target});void binding;`);
const cfg=ts.readConfigFile(resolve(root,'tsconfig.json'),ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(cfg.config,ts.sys,root);
const options={...parsed.options,incremental:false,noEmit:true};
if(options.target!==ts.ScriptTarget.ES5)throw Error('Existing ES5 contract changed');
const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
host.readFile=path=>overlay.get(resolve(path))??read(path);host.fileExists=path=>overlay.has(resolve(path))||exists(path);
const program=ts.createProgram([probe],options,host),diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));process.exitCode=1;}
else console.log(JSON.stringify({contract:'core15-service09-ABI',SERVICE:ref,ES5:'PASS',source_overlay:'READ_ONLY_ACTUAL_GIT',owner_files_changed:0,native:'NOT_RUN'}));
