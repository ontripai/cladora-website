/** F01/F02 only. Actual launcher filter and real binding module; all secret,
 * filesystem and Pool values are synthetic. No network, PG or Auth calls. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {z} from 'zod';
import {coreServiceAssemblyChildEnvironmentV1} from './lib/core-service-assembly-environment-v1.mjs';
const require=createRequire(import.meta.url),base='686475cc9606888f41b46ffd7a0ef544484b6b30';
const launcherPath='scripts/run-core-service-app-assembly-17.mjs',bindingPath='src/lib/core/private-service-development-binding-v1.ts';
const before=path=>execFileSync('git',['show',base+':'+path],{encoding:'utf8'});
const launcher=readFileSync(launcherPath,'utf8'),binding=readFileSync(bindingPath,'utf8');
function filter(source,env,phase){const start=source.indexOf('const env='),end=source.indexOf('assert.ok(!env.VERCEL',start);assert.ok(start>=0&&end>start);return new Function('process','phase','coreServiceAssemblyChildEnvironmentV1',source.slice(start,end)+'return env;')({env},phase,coreServiceAssemblyChildEnvironmentV1);}
const secretNames=['CLADORA_STAGING_DATABASE_URL','CLADORA_STAGING_SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','GH_TOKEN','DATABASE_URL','PGPASSWORD','AWS_SECRET_ACCESS_KEY','NEXT_PUBLIC_OTHER_SELECTOR','CLADORA_CORE15_SERVICE_BINDING_FILE','CLADORA_CORE15_SERVICE_BINDING_SHA256','CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE','NODE_ENV'];
const inherited=Object.fromEntries(secretNames.map(k=>[k,'synthetic-sentinel-'+k]));
Object.assign(inherited,{PATH:'/synthetic/bin',NODE_OPTIONS:'--require=/synthetic/network-guard.cjs',HTTPS_PROXY:'http://synthetic-proxy',http_proxy:'http://synthetic-proxy',NO_PROXY:'127.0.0.1',NODE_EXTRA_CA_CERTS:'/synthetic/ca',SSL_CERT_FILE:'/synthetic/ca',CODEX_PERMISSION_PROFILE:'synthetic-guard',CODEX_EXEC_SERVER_PROXY_PRIVATE_IPS_VIA_UPSTREAM:'1',VERCEL_ENV:'synthetic-deployment-guard'});
let n=0;function check(name,fn){fn();console.log('PASS '+(++n)+' '+name);}
for(const phase of ['build','start']){
 check('predecessor '+phase+' reproduces three leaked sentinels',()=>{const e=filter(before(launcherPath),inherited,phase);for(const k of secretNames.slice(0,3))assert.equal(e[k],inherited[k]);});
 check('fixed '+phase+' excludes credentials and inherited app selectors',()=>{const e=filter(launcher,inherited,phase);for(const k of secretNames)assert.equal(Object.hasOwn(e,k),false,k);});
 check('fixed '+phase+' preserves proxy/CA/host and deployment guards without mutating parent',()=>{const e=filter(launcher,inherited,phase);for(const k of ['PATH','NODE_OPTIONS','HTTPS_PROXY','http_proxy','NO_PROXY','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','CODEX_PERMISSION_PROFILE','CODEX_EXEC_SERVER_PROXY_PRIVATE_IPS_VIA_UPSTREAM','VERCEL_ENV'])assert.equal(e[k],inherited[k]);assert.equal(inherited.GH_TOKEN,'synthetic-sentinel-GH_TOKEN');});
}
const targetSource=readFileSync('src/lib/core/functional-command-runtime-v1.ts','utf8');
const targetExpression=targetSource.slice(targetSource.indexOf('export const coreFunctionalDevelopmentTargetV1Schema='),targetSource.indexOf('export type CoreFunctionalDevelopmentTargetV1='));
const targetSchema=new Function('z',targetSource.match(/^const role=.*$/m)[0]+targetExpression.replace('export const','const')+'return coreFunctionalDevelopmentTargetV1Schema;')(z);
function fixture(source=binding){
 const config={contract:'core15-owned-service-private-binding.v1',platform:'794f5a12c3928ae0a3585ab679a3cbe60aab49a3',target:{contract:'core-functional-development-target.v1',backend_id:'core15-dev:'+'a'.repeat(32),purpose:'owned-isolated-persistent-development',host:'127.0.0.1',port:55422,database_name:'postgres',database_oid:1234,runtime_role:'cladora_core_runtime',auth_origin:'http://127.0.0.1:55421'},password:'b'.repeat(64)};
 const state={pools:0,runtimes:0,bytes:Buffer.from(JSON.stringify(config)),badMode:false};
 const env={NODE_ENV:'production',CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE:'core-service-real-app-assembly.v1',NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY:'v1',CLADORA_CORE15_SERVICE_BINDING_FILE:'/workspace/private/cladora-functional-dev-v1/core15/service-runtime-binding.json'};
 const reseal=()=>{state.bytes=Buffer.from(JSON.stringify(config));env.CLADORA_CORE15_SERVICE_BINDING_SHA256=createHash('sha256').update(state.bytes).digest('hex');};reseal();
 const imports={'server-only':{},'node:fs':{readFileSync:()=>state.bytes,lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false,nlink:1,mode:state.badMode?0o100644:0o100600,uid:1234,size:state.bytes.length})},pg:{Pool:class{constructor(){state.pools++;}on(){}}},'./service-functional-binding-v1':{createCoreServiceFunctionalBindingV1:()=>({binding:true})},'./functional-command-runtime-v1':{coreFunctionalDevelopmentTargetV1Schema:targetSchema,createCoreFunctionalCommandRuntimeV1:()=>{state.runtimes++;return{runtime:true};}}};
 const m={exports:{}};new Function('require','module','exports','process',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES5}}).outputText)(k=>Object.hasOwn(imports,k)?imports[k]:require(k),m,m.exports,{env,getuid:()=>1234});
 return{state,env,config,reseal,get:()=>m.exports.getCoreServiceAppRuntimeV1(new Request('http://localhost/synthetic'))};
}
check('predecessor reproduces warm selector removal',()=>{const x=fixture(before(bindingPath));assert.ok(x.get());delete x.env.CLADORA_CORE15_SERVICE_BINDING_FILE;assert.ok(x.get());assert.equal(x.state.runtimes,2);});
check('predecessor reproduces changed target silently reusing pool',()=>{const x=fixture(before(bindingPath));x.get();x.config.target.database_oid=4321;x.reseal();assert.ok(x.get());assert.equal(x.state.pools,1);});
check('cold absent binding has no runtime or pool',()=>{const x=fixture();delete x.env.CLADORA_CORE15_SERVICE_BINDING_FILE;assert.equal(x.get(),null);assert.equal(x.state.pools,0);});
check('cold valid identity constructs once and warm same identity reuses',()=>{const x=fixture();assert.ok(x.get());assert.ok(x.get());assert.equal(x.state.pools,1);assert.equal(x.state.runtimes,2);});
check('warm absent binding never invokes old read factory',()=>{const x=fixture();x.get();delete x.env.CLADORA_CORE15_SERVICE_BINDING_FILE;assert.equal(x.get(),null);assert.equal(x.state.runtimes,1);});
for(const [name,mutate]of [
 ['invalid digest',x=>{x.env.CLADORA_CORE15_SERVICE_BINDING_SHA256='0'.repeat(64);}],
 ['invalid selector',x=>{x.env.CLADORA_CORE15_SERVICE_BINDING_FILE='/tmp/not-approved';}],
 ['invalid profile',x=>{delete x.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE;}],
 ['invalid custody',x=>{x.state.badMode=true;}],
 ['valid changed target',x=>{x.config.target.database_oid=4321;x.reseal();}],
 ['valid changed password/digest',x=>{x.config.password='c'.repeat(64);x.reseal();}],
 ['valid changed mode/profile',x=>{x.env.NODE_ENV='test';}],
])for(const warm of [false,true])check((warm?'warm':'cold')+' '+name,()=>{const x=fixture();if(warm)x.get();mutate(x);if(!warm&&name.startsWith('valid changed')){assert.ok(x.get());assert.equal(x.state.pools,1);}else{assert.throws(x.get,name.startsWith('valid changed')?/RESTART_REQUIRED/:undefined);assert.equal(x.state.pools,warm?1:0);assert.equal(x.state.runtimes,warm?1:0);}});
check('rejected warm target cannot construct replacement; fresh module accepts explicit new identity',()=>{const x=fixture();x.get();x.config.target.database_oid=4321;x.reseal();assert.throws(x.get,/RESTART_REQUIRED/);assert.throws(x.get,/RESTART_REQUIRED/);assert.equal(x.state.pools,1);const fresh=fixture();fresh.config.target.database_oid=4321;fresh.reseal();assert.ok(fresh.get());});
console.log(JSON.stringify({review_r1_checks:n,network_PG_Auth_calls:0,native:'NOT_RUN',fresh_v3:'NOT_RUN',browser:'NOT_RUN'}));
