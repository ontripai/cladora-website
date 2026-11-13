/** Real routing modules, controlled Auth only; no live login or business calls. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,join,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(process.argv[2]??fileURLToPath(new URL('../',import.meta.url)));
const require=createRequire(join(root,'package.json')),ts=require('typescript');
const currentProfile='core-service-real-app-assembly.v1';
let checks=0,failed=0;
async function check(name,run){checks++;try{await run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+error.message);}}
function fixture({privateProfile=true,publicProfile=true,browser=false,level='aal2',nextLevel='aal2',factor=true,claims=true,authError=false,rpcError=true}={}){
 const env={};if(privateProfile)env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE=currentProfile;
 if(publicProfile)env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY='v1';
 const calls=[];
 const client={auth:{getClaims:async()=>({data:{claims:claims?{sub:'synthetic-only'}:null},error:claims?null:Error('expired')}),mfa:{
  listFactors:async()=>({data:{totp:factor?[{id:'synthetic',status:'verified'}]:[]},error:authError?Error('Auth unavailable'):null}),
  getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level,nextLevel},error:authError?Error('Auth unavailable'):null}),
 }},schema(schema){return{async rpc(name){calls.push({schema,name});return{data:name==='has_platform_access_v1'?true:[],error:rpcError?Object.assign(Error('Invalid schema'),{code:'PGRST106'}):null};}};}};
 const mocks={
  'next/navigation':{redirect(path){throw Object.assign(Error('REDIRECT'),{path});}},
  '@/types':{isSupportedLocale:value=>['en','fa','ro'].includes(value)},
  '@/lib/supabase/server':{createClient:async()=>client},
  '@/lib/supabase/env':{isSupabaseConfigured:()=>true},
  '@/components/auth/MfaChallengeForm':{MfaChallengeForm:function Challenge(){}},
  '@/components/auth/AccountSecurityPanel':{AccountSecurityPanel:function Setup(){}},
  '@/components/customer/CustomerAppShell':{CustomerAppShell:function Shell(){}},
 };
 const modules=new Map();
 function load(path){
  if(modules.has(path))return modules.get(path).exports;
  const compiledModule={exports:{}};modules.set(path,compiledModule);
  if(path.endsWith('.json')){compiledModule.exports=JSON.parse(readFileSync(join(root,path),'utf8'));return compiledModule.exports;}
  const actualRequire=name=>{
   if(Object.hasOwn(mocks,name))return mocks[name];
   if(name==='server-only')return require('next/dist/compiled/server-only/empty');
   if(name.startsWith('@/')||name.startsWith('.')){
    const base=name.startsWith('@/')?join(root,'src',name.slice(2)):resolve(dirname(join(root,path)),name);
    const file=[base,base+'.ts',base+'.tsx',base+'.json'].find(p=>existsSync(p));
    assert.ok(file,`Source dependency exists: ${name}`);return load(relative(root,file));
   }
   return require(name);
  };
  const code=ts.transpileModule(readFileSync(join(root,path),'utf8'),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports','process','window',code)(actualRequire,compiledModule,compiledModule.exports,{env},browser?{location:{hostname:'localhost'}}:undefined);
  return compiledModule.exports;
 }
 const post=load('src/lib/auth/post-auth-route.ts');mocks['@/lib/auth/post-auth-route']=post;
 return{post,client,calls,load};
}
async function target(page,lang,next){
 try{return{tree:await page({params:Promise.resolve({lang}),searchParams:Promise.resolve({next}),children:'protected'})};}
 catch(error){if(error.path)return{path:error.path};throw error;}
}
for(const lang of ['en','fa','ro']){
 await check(lang+' public marker alone keeps server platform lookup',async()=>{
  const x=fixture({privateProfile:false,rpcError:false});assert.equal(await x.post.hasActivePlatformAccess(x.client),true);assert.equal(x.calls.length,1);
 });
 await check(lang+' public marker alone keeps platform MFA policy',async()=>{
  const x=fixture({privateProfile:false,rpcError:false,factor:false,level:'aal1',nextLevel:'aal1'});
  assert.equal(await x.post.resolvePostAuthRoute(x.client,lang),`/${lang}/mfa/setup?reason=platform_required`);
 });
 for(const page of ['mfa/page.tsx','mfa/setup/page.tsx'])await check(lang+' public marker does not bypass server RPC failure '+page,async()=>{
  const x=fixture({privateProfile:false});assert.equal((await target(x.load('src/app/[lang]/'+page).default,lang)).path,`/${lang}/login?reason=security`);assert.equal(x.calls.length,1);
 });
 for(const browser of [false,true])for(const level of ['aal1','aal2'])await check(lang+' owned Auth routing '+(browser?'browser':'server')+' '+level,async()=>{
  const x=fixture({privateProfile:!browser,browser,level});
  assert.equal(await x.post.resolvePostAuthRoute(x.client,lang),level==='aal2'?`/${lang}/app/services`:`/${lang}/mfa`);assert.equal(x.calls.length,0);
 });
 for(const page of ['mfa/page.tsx','mfa/setup/page.tsx'])for(const next of ['owner-portfolio','workspace-access','cases','invitation-continuation','pilot-reviewer','account'])await check(lang+' owned next stays within SERVICE '+page+' '+next,async()=>{
  const x=fixture();const result=await target(x.load('src/app/[lang]/'+page).default,lang,next);
  assert.equal(result.path,`/${lang}/app/services`);assert.equal(x.calls.length,0);
 });
 for(const [options,expected]of [[{claims:false},'login'],[{factor:false},'mfa/setup?reason=customer_required'],[{level:'aal1'},'mfa']])await check(lang+' owned layout blocks '+expected,async()=>{
  const x=fixture(options);const result=await target(x.load('src/app/[lang]/app/layout.tsx').default,lang);
  assert.equal(result.path,`/${lang}/${expected}`);assert.equal(x.calls.length,0);
 });
 await check(lang+' owned verified AAL2 layout has no legacy requirement RPC',async()=>{
  const x=fixture();const result=await target(x.load('src/app/[lang]/app/layout.tsx').default,lang);
  assert.equal(result.path,undefined);assert.equal(result.tree.type.name,'Shell');assert.equal(x.calls.length,0);
 });
 await check(lang+' official Auth failure cannot yield destination',async()=>{
  const x=fixture({authError:true});await assert.rejects(()=>x.post.resolvePostAuthRoute(x.client,lang),/Auth unavailable/);assert.equal(x.calls.length,0);
 });
 for(const raw of ['services?\nunsafe','account\r','cases#\u0000unsafe'])await check(lang+' controls rejected in next',async()=>{
  assert.equal(fixture().post.sanitizeAllowedNextRoute(raw,lang,true),null);
 });
 for(const next of ['owner-portfolio','workspace-access','cases','invitation-continuation','pilot-reviewer'])await check(lang+' standard next preserved '+next,async()=>{
  assert.equal(fixture({privateProfile:false,publicProfile:false}).post.sanitizeAllowedNextRoute(next,lang,false),`/${lang}/${next}`);
 });
}
console.log(JSON.stringify({checks,failed,proof:'REAL_ROUTING_MODULES_CONTROLLED_AUTH',native_Auth_DB:'NOT_RUN'}));
if(failed)process.exitCode=1;
