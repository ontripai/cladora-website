/** Full existing ES5 tsconfig with owner's verified Finance afterimages in memory. */
import ts from 'typescript';
import {resolve} from 'node:path';
import {readFileSync,readdirSync} from 'node:fs';
const root=resolve(new URL('..',import.meta.url).pathname),source=process.argv.find(a=>a.startsWith('--finance-source='))?.slice(17);
if(!source)throw Error('--finance-source required');
const files=[];function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.ts'))files.push(p);}}walk(resolve(source,'src'));
const overlay=new Map(files.map(f=>[resolve(root,f.slice(resolve(source).length+1)),readFileSync(f,'utf8')]));
const virtual=resolve(root,'core-finance30-assembly-type-proof.ts');
overlay.set(virtual,`import {createCoreFinanceMonthlyBindingV1} from './src/lib/core/finance-monthly-binding-v1';
import type {CoreFunctionalDevelopmentTargetV1} from './src/lib/core/functional-command-runtime-v1';
import type {Pool} from 'pg';
import {canonicalMonthlyCommandV1} from './src/lib/customer/finance-monthly-bridge-v1/schema';
import {monthlyCommandFingerprintV1} from './src/lib/customer/finance-monthly-bridge-v1/fingerprint';
import {createFinanceMonthlyProvidersV1,readFinanceMonthlyCommandV1} from './src/lib/customer/finance-monthly-bridge-v1/provider';
import {readFinanceMonthlyPlanV1} from './src/lib/customer/finance-monthly-bridge-v1/plan';
import type {FinanceMonthlyVerifiedRuntimeV1} from './src/lib/customer/finance-monthly-bridge-v1/http';
export function typeProof(pool:Pool,target:CoreFunctionalDevelopmentTargetV1):FinanceMonthlyVerifiedRuntimeV1 {
return createCoreFinanceMonthlyBindingV1({pool,target,domain:{canonicalMonthlyCommandV1,monthlyCommandFingerprintV1,createFinanceMonthlyProvidersV1,readFinanceMonthlyCommandV1,readFinanceMonthlyPlanV1}});}
`);
const config=ts.readConfigFile(resolve(root,'tsconfig.json'),ts.sys.readFile);if(config.error)throw Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);const options={...parsed.options,incremental:false,noEmit:true};
if(options.target!==ts.ScriptTarget.ES5)throw Error('ES5_REQUIRED');
const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
host.readFile=p=>overlay.get(resolve(p))??read(p);host.fileExists=p=>overlay.has(resolve(p))||exists(p);
const directory=host.directoryExists?.bind(host);host.directoryExists=p=>[...overlay.keys()].some(f=>f.startsWith(resolve(p)+'/'))||Boolean(directory?.(p));
const names=[...new Set([...parsed.fileNames,...overlay.keys()])],program=ts.createProgram(names,options,host);
const diagnostics=ts.getPreEmitDiagnostics(program);if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:p=>p,getNewLine:()=> '\n'}));process.exitCode=1;}else console.log(JSON.stringify({typecheck:'FULL_ES5_WITH_REAL_FINANCE_OVERLAY_PASS',virtual_owner_files:files.length,proof:'TYPE_COMPATIBILITY_NOT_NATIVE'}));
