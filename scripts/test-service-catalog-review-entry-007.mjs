import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const filename = fileURLToPath(file);
  const mod = new Module(filename);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('@/')
    ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url), mocks)
    : name.startsWith('.') ? load(new URL(`${name}.ts`, file), mocks) : require(name);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText, filename);
  return mod.exports;
}
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const contexts = [
  {context_id:id(1),scope_type:'unit',tenant_name:'Owner'},
  {context_id:id(2),scope_type:'tenant',tenant_name:'Pilot',role_code:'building_setup_reviewer'},
];
const management = {can_manage:false,can_publish:true,next_after:null,definitions:[],providers:[],offerings:[]};
let allow=true, errorCode=null, malformed=false, calls=[];
const db={schema: schema => {assert.equal(schema,'customer_api');return {rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='list_contexts_v1')return {data:contexts};
  assert.equal(args.p_context_id,id(2));
  if(name==='list_workspace_targets_v2')return {data:[{workspace_id:id(3)}]};
  assert.equal(name,'read_service_catalog_management_v1');assert.equal(args.p_workspace_id,id(3));
  return errorCode?{error:{code:errorCode}}:{data:malformed?{can_publish:true}:{...management,can_publish:allow}};
}};}};
const {listServiceReviewTargets}=load(new URL('../src/lib/customer/service-catalog-review-targets.ts',import.meta.url));
assert.deepEqual(await listServiceReviewTargets(db),[{contextId:id(2),workspaceId:id(3),label:'Pilot'}]);
assert.equal(calls.length,3);assert.ok(calls.every(c=>!/^mutate|assign|publish/.test(c.name)));
allow=false;assert.deepEqual(await listServiceReviewTargets(db),[]);
errorCode='42501';assert.deepEqual(await listServiceReviewTargets(db),[]);
errorCode='XX000';await assert.rejects(listServiceReviewTargets(db));
errorCode=null;malformed=true;await assert.rejects(listServiceReviewTargets(db));malformed=false;
function props(node,name){if(!node||typeof node!=='object')return [];return [...(node.type?.name===name?[node.props]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>props(child,name))];}
function links(node){if(!node||typeof node!=='object')return [];return [...(node.props?.href?[node.props.href]:[]),...React.Children.toArray(node.props?.children).flatMap(links)];}
for(const lang of ['fa','ro','en']){
  let signedIn=true,aal='aal2',targets=[{contextId:id(2),workspaceId:id(3),label:'Pilot'}];
  const authDb={auth:{getClaims:async()=>({data:{claims:signedIn?{sub:id(4)}:null}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal}})}},schema:()=>({rpc:async name=>({data:name==='list_contexts_v1'?contexts:name==='my_pilot_setup_reviewer_v1'?{}:false})})};
  const mocks={'next/link':function Link(){},'next/navigation':{notFound:()=>{throw Error('404');},redirect: url=>{throw Error(url);}},'@/lib/supabase/server':{createClient:async()=>authDb},'@/types':{isSupportedLocale:()=>true},'@/lib/customer/service-catalog-review-targets':{listServiceReviewTargets:async()=>targets},'@/components/customer/CustomerServiceManagement':{CustomerServiceManagement:function CustomerServiceManagement(){}},'@/components/auth/SignOutButton':{SignOutButton:()=>null}};
  const Page=load(new URL('../src/app/[lang]/service-review/page.tsx',import.meta.url),mocks).default;
  const request={params:Promise.resolve({lang})};
  assert.deepEqual(props(await Page(request),'CustomerServiceManagement')[0],{contextId:id(2),workspaceId:id(3),lang});
  const Account=load(new URL('../src/app/[lang]/account/page.tsx',import.meta.url),mocks).default;
  assert.ok(links(await Account({...request,searchParams:Promise.resolve({choose:'1'})})).includes(`/${lang}/service-review`));
  targets=[];assert.equal(props(await Page(request),'CustomerServiceManagement').length,0);
  assert.ok(!links(await Account({...request,searchParams:Promise.resolve({choose:'1'})})).includes(`/${lang}/service-review`));
  aal='aal1';await assert.rejects(Page(request),new RegExp(`/${lang}/mfa`));
  signedIn=false;await assert.rejects(Page(request),new RegExp(`/${lang}/login`));
}
assert.ok(existsSync(new URL('../src/app/[lang]/service-review/page.tsx',import.meta.url)));
console.log('PASS SERVICE review discovery: explicit guarded tuples, no unit/expired/denied access, malformed responses fail closed, AAL2 and three-locale entry routing');
