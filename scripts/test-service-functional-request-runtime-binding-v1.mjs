import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require=createRequire(import.meta.url),root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),cache=new Map();
function load(filename){filename=extname(filename)?filename:`${filename}.ts`;if(cache.has(filename))return cache.get(filename).exports;
 if(filename.endsWith('.json')){const mod={exports:JSON.parse(readFileSync(filename,'utf8'))};cache.set(filename,mod);return mod.exports;}
 const mod={exports:{}};cache.set(filename,mod);const compiled=ts.transpileModule(readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,moduleResolution:ts.ModuleResolutionKind.NodeNext}}).outputText;
 const localRequire=specifier=>specifier==='server-only'?{}:specifier.startsWith('@/')?load(resolve(root,'src',specifier.slice(2))):specifier.startsWith('.')?load(resolve(dirname(filename),specifier)):require(specifier);
 new Function('require','module','exports',compiled)(localRequire,mod,mod.exports);return mod.exports;}
const {createServiceOfferingRequestFlowHandlers}=load(resolve(root,'src/lib/customer/service-v14-execution/http.ts'));
const runtime=load(resolve(root,'src/lib/customer/service-v14-execution/runtime-binding.ts'));
const {NextRequest}=require('next/server');
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ids={context:id(1),a:id(2),b:id(3),offering:id(4),revision:id(5),provider:id(6),agreement:id(7),actor:id(8)};
const snapshots=[];
function ports(workspace){return{async loadOffering(){snapshots.push(workspace);return{workspace_id:workspace,offering_id:ids.offering,offering_version:1,published_revision_id:ids.revision,published_revision_version:1,provider_party_id:ids.provider,provider_agreement_id:ids.agreement,provider_agreement_version:1,status:'published',acquisition_mode:'direct',valid_from:'2026-11-01T00:00:00.000000Z',valid_until:null,coverage:{kind:'workspace'},eligibility:{policy_version:1,required_resource_types:[],required_capabilities:[],required_policy_codes:[]},current_actor_can_request:true};},async resolvePrincipal(){return{actor_id:ids.actor,authority_version:1};},async resolveProviderAgreement(input){return{contract_version:'provider-agreement-verification.v1',agreement_status:'effective',tenant_id:id(9),workspace_id:workspace,provider_party_id:ids.provider,provider_agreement_id:ids.agreement,provider_agreement_version:1,valid_from:'2026-01-01',valid_until:null,allowed_service_scope:input.requested_service_scope,evaluated_at:'2026-11-02T00:00:00Z',action_authorization:'not_evaluated'};},async resolveCanonicalResource(){throw new Error('not used');},transactionalReaders:{async resolveProviderAgreement(){throw new Error('not used');},async resolveCanonicalResource(){throw new Error('not used');}},host:{async execute(){throw new Error('not used');}},now(){return'2026-11-02T00:00:00.000000Z';}};}
let binds=0;
const handlers=createServiceOfferingRequestFlowHandlers(async request=>{binds++;const workspace=request.nextUrl.searchParams.get('workspace_id');return workspace===ids.a||workspace===ids.b?ports(workspace):null;});
const query=workspace=>new URLSearchParams({context_id:ids.context,workspace_id:workspace,offering_id:ids.offering,published_revision_id:ids.revision});
for(const workspace of [ids.a,ids.b]){const response=await handlers.GET(new NextRequest(`http://localhost/api/customer/v1/services/offering-request-flow?${query(workspace)}`));assert.equal(response.status,200);const body=await response.json();assert.equal(body.status,'ready');}
assert.deepEqual(snapshots,[ids.a,ids.a,ids.b,ids.b]);assert.equal(binds,2,'binding must be request-local');
const malformed=await handlers.GET(new NextRequest('http://localhost/api/customer/v1/services/offering-request-flow?workspace_id=bad'));
assert.equal(malformed.status,400);assert.equal(binds,2,'invalid input must not reach runtime binding');
const failed=createServiceOfferingRequestFlowHandlers(async()=>{throw new Error('private connection detail');});
const response=await failed.GET(new NextRequest(`http://localhost/api/customer/v1/services/offering-request-flow?${query(ids.a)}`));
assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'RUNTIME_BINDING_INACTIVE'}});
const inactive=runtime.getServiceOfferingRequestRuntimeBinding();assert.equal(await inactive(new NextRequest('http://localhost')),null);
assert.equal(runtime.SERVICE_FUNCTIONAL_REQUEST_RUNTIME_CONTRACT_V1,'service-functional-request-runtime.v1');
console.log(JSON.stringify({task:'SERVICE-FUNCTIONAL-REQUEST-09',cases:4,status:'PASS',connected_runtime:'NOT_RUN_NOT_PASS'}));
