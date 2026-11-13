/** Exact successor modules + actual Core transports. Synthetic PG/Auth only. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const SERVICE='cf3d1e3349298c4cc4cf8f6f771c78179cc2bc52',AIRPROP='dc3fcceaf1439e7bf91fb257d449b2b4e1ace4b0';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=(file,encoding)=>{const path=String(file),rel=path.startsWith(root+'/')?path.slice(root.length+1):path;
 const ref=rel.startsWith('src/lib/customer/')?SERVICE:rel.startsWith('src/lib/airprop/')?AIRPROP:null;
 return ref?execFileSync('git',['show',`${ref}:${rel}`],{cwd:root,encoding:'utf8'}):readFileSync(file,encoding);};
const url=new URL('./test-core-functional-runtime-v1.mjs',import.meta.url),old=readFileSync(url,'utf8');
const prefix=old.slice(old.indexOf('const original='),old.indexOf('\nlet n=0;')).replace("new URL('./test-core-ce012-replay-joint-seal-13.mjs',import.meta.url)","new URL('./test-core-ce012-replay-joint-seal-13.mjs',setupUrl)");
const {fixture,env,target,id,auth,runtimeModule}=new Function('assert','readFileSync','execFileSync','createRequire','resolve','dirname','extname','fileURLToPath','ts','setupUrl',prefix+'\nreturn{fixture,env,target,id,auth,runtimeModule};')(assert,read,execFileSync,createRequire,resolve,dirname,extname,fileURLToPath,ts,url.href);
globalThis.fetch=async()=>{throw Error('OUTBOUND_FORBIDDEN');};
const quote=env.load('src/lib/customer/service-quote-command-v1.ts');
const offering=env.load('src/lib/customer/service-v14-execution/offering-authoring-composition-v1.ts');
const quoteBinding=env.load('src/lib/core/service-quote-command-binding-v1.ts');
const identityPort=env.load('src/lib/core/service-authoring-identity-port-v1.ts');
const selected={context_id:id(4),workspace_id:id(3)};
const input={...selected,request_id:id(60),expected_request_version:3,published_revision_id:id(61),scope:'Synthetic non-binding quote',total_minor:'12000',currency:'RON',payer_shares:[{party_id:id(62),amount_minor:'12000'}],valid_until:'2026-12-01T00:00:00.000000Z',idempotency_key:'successor-quote-test-001'};
const source_binding={quote_version:1,provider_party_id:id(72),provider_agreement_id:id(73),provider_agreement_version:1,beneficiary_party_id:id(62)};
const source={workspace_id:id(3),request_id:id(60),request_version:3,published_revision_id:id(61),request_status:'submitted',provider_party_id:id(72),provider_agreement_id:id(73),provider_agreement_version:1,beneficiary_party_id:id(62),membership_id:id(6),next_quote_version:1,allowed_payer_party_ids:[id(62)]};
const revision={labels:{en:'Service',fa:'خدمت',ro:'Serviciu'},description:{en:'Synthetic',fa:'مصنوعی',ro:'Sintetic'},acquisition_mode:'pre_quote',price:{kind:'quote_required'},valid_from:'2026-01-01T00:00:00.000000Z',valid_until:null,cancellation_terms:{en:'Terms',fa:'شرایط',ro:'Termeni'},acceptance_criteria:{en:'Acceptance',fa:'تأیید',ro:'Acceptare'},document_version_ids:[]};
async function setup(){const x=await fixture();x.request=new Request('http://localhost/service');x.binding=await quoteBinding.createCoreServiceQuoteCommandBindingV1({pool:x.f.pool,target}).bind(x.request);x.readers=runtimeModule.createCoreFunctionalCommandRuntimeV1({pool:x.f.pool,target,offering:null,request:x.request}).readers;return x;}
async function plan(x){return{transaction_id:id(80),command_id:id(81),quote_id:id(82),identity:await x.binding.resolveIdentity(selected),source_binding,input};}
let n=0;async function check(name,fn){await fn();console.log(`PASS ${++n} ${name}`);}
await check('actual SERVICE Offering composer consumes actual Core identity; no caller actor or authority',async()=>{
 const x=await setup(),port=identityPort.createCoreServiceAuthoringIdentityPortV1({pool:x.f.pool,target,request:x.request});
 const composer=offering.createServiceOfferingAuthoringCompositionV1({identity:port,readers:x.readers});
 const prepared=await composer.prepareCreate({transaction_id:id(80),command_id:id(81),offering_id:id(70),revision_id:id(71),input:{...selected,definition_id:id(74),provider_party_id:id(72),provider_agreement:{agreement_id:id(73),agreement_version:1},coverage:{kind:'workspace'},eligibility:{policy_version:1,required_resource_types:[],required_capabilities:[],required_policy_codes:[]},revision,idempotency_key:'successor-offering-001'}});
 assert.equal(prepared.command.actor_id,id(1));assert.equal(prepared.command.permission_code,'services.catalog.manage');assert.equal(prepared.command.module_code,'services_catalog');assert.equal(prepared.command.authority_version,1);
 assert.equal(x.calls.includes('commit'),false);
});
await check('actual Offering publish gets canonical publish permission, not Quote/Listing/manage alias',async()=>{
 const x=await setup(),port=identityPort.createCoreServiceAuthoringIdentityPortV1({pool:x.f.pool,target,request:x.request});
 const p=await offering.createServiceOfferingAuthoringCompositionV1({identity:port,readers:x.readers}).prepareTransition({transaction_id:id(80),command_id:id(81),...selected,offering_id:id(70),revision_id:id(71),expected_offering_version:1,expected_revision_version:1,provider_party_id:id(72),provider_agreement:{agreement_id:id(73),agreement_version:1},action:'publish',reason:'Synthetic approval',idempotency_key:'successor-publish-001'});
 assert.equal(p.command.permission_code,'services.catalog.publish');assert.equal(p.command.module_code,'services_catalog');
});
await check('actual SERVICE Quote schema consumes request-local Core server identity with its exact profile',async()=>{
 const x=await setup(),p=await plan(x),prepared=quote.prepareServiceQuoteCommandV1(p,{loadSource:async()=>null,resolveProviderAgreement:x.readers.resolveProviderAgreement,async insertDraft(){assert.fail('no execution');}});
 assert.equal(p.identity.contract_version,'service-quote-command-identity.v1');assert.equal(p.identity.actor_id,id(1));assert.equal(p.identity.reusable_as_authority,false);assert.equal(prepared.command.evaluation_purpose,'service.create_quote');assert.equal(prepared.command.permission_code,'services.quotes.manage');assert.equal(prepared.command.module_code,'services_orders');assert.equal(x.calls.includes('commit'),false);
});
await check('actual Quote provider + Core C03 cannot turn missing authoring S01 into a write',async()=>{
 const x=await setup(),p=await plan(x),before=structuredClone(x.f.writes);let insert=0;
 const prepared=quote.prepareServiceQuoteCommandV1(p,{loadSource:async()=>source,resolveProviderAgreement:x.readers.resolveProviderAgreement,async insertDraft(){insert++;assert.fail('missing approved disclosure');}});
 const result=await x.binding.host.execute(prepared.command,prepared.providers);assert.equal(result.status,'denied');assert.equal(insert,0);assert.deepEqual(x.f.writes,before);assert.equal(x.calls.includes('commit'),false);
});
await check('Quote current authority/actor/Context is canonical, exact40001 identity is preserved',async()=>{
 const x=await setup(),error=Object.assign(Error('controlled serialization'),{code:'40001'});x.checkpointFault=error;await assert.rejects(x.binding.resolveIdentity(selected),e=>e===error);
 const y=await setup();await y.binding.resolveIdentity(selected);await assert.rejects(y.binding.resolveIdentity({...selected,context_id:id(99)}));
 const z=await setup();auth.claims.aal='aal1';await assert.rejects(z.binding.resolveIdentity(selected));
});
await check('Quote command port rejects Offering/Guide/Listing purpose before domain dispatch',async()=>{
 const x=await setup(),p=quote.prepareServiceQuoteCommandV1(await plan(x),{loadSource:async()=>null,resolveProviderAgreement:x.readers.resolveProviderAgreement,async insertDraft(){assert.fail();}});
 const before=structuredClone(x.f.writes);for(const patch of [{permission_code:'services.catalog.manage'},{module_code:'airprop_commercial'},{evaluation_purpose:'experience.guide.command'}])await assert.rejects(x.binding.host.execute({...p.command,...patch},p.providers));assert.deepEqual(x.f.writes,before);
});
await check('actual AIRPROP mutator is loadable unchanged and rejects mismatched command before SQL',async()=>{
 const owner=env.load('src/lib/airprop/listing-selected-binding-v1.ts');let writes=0;
 const scope={actor_id:id(1),workspace_id:id(3),transaction_id:id(80),async query(){writes++;assert.fail('must not dispatch');}};
 const plan={request:{command:{...selected,idempotency_key:'same-wire-key'},selection:{}}};
 await assert.rejects(owner.mutateListingWithSelectedBindingV1(scope,{actor_id:id(99),workspace_id:id(3),transaction_id:id(80)},plan,async()=>{assert.fail('must not probe');}),/LISTING_BINDING_COMMAND/);assert.equal(writes,0);
});
await check('actual AIRPROP V1 mutator reaches missing-source boundary through Core C03 and rolls back',async()=>{
 const x=await setup(),port=await env.load('src/lib/core/listing-command-binding-v1.ts').createCoreListingCommandBindingV1({pool:x.f.pool,target}).bind(x.request);
 const owner=env.load('src/lib/airprop/listing-selected-binding-v1.ts'),publication=env.load('src/lib/airprop/listing-publication-v1.ts');
 const selection={property_id:id(11),unit_id:id(12),resource_id:id(12),resource_version:3,resource_type:'unit',party_id:id(72),party_kind:'person',relationship_id:id(75),relationship_version:2,relationship_kind:'ownership'};
 const wire=JSON.stringify({contract:'airprop-listing-publication.v1',selection,command:{version:1,...selected,action:'publish_listing',opportunity_id:id(76),property_id:id(11),unit_id:id(12),kind:'resale',available_from:'2026-11-08T12:00:00Z',available_until:null,idempotency_key:'successor-listing-001'}});
 const plan=publication.prepareListingPublicationV1(wire,selected),before=structuredClone(x.f.writes);let reached=0;
 const command={contract_version:'core-transaction-command.v1',transaction_id:id(80),command_id:id(81),...selected,actor_id:id(1),authority_version:1,permission_code:'airprop.opportunity.manage',module_code:'airprop_commercial',evaluation_purpose:'airprop.b2',aggregate_type:'portfolio.unit',aggregate_id:id(12),aggregate_version:3,provider_source_ids:[id(12),id(11),id(72),id(75),id(77)],idempotency_key:'successor-listing-001',input_fingerprint:'sha256:'+createHash('sha256').update(wire).digest('hex')};
 const r=await port.host.execute(command,{async resolveAuthority(){assert.fail('Core must bind authority');},
  // TEST ONLY entry to the actual domain mutator, not a production allow/provider.
  async validateProviders(){return true;},mutate:owner.createListingSelectedBindingMutatorV1(plan,async()=>{reached++;throw Error('CANONICAL_PARTY_RELATIONSHIP_NOT_READY');})});
 assert.equal(reached,1);assert.equal(r.status,'denied');assert.deepEqual(x.f.writes,before);assert.equal(x.calls.includes('commit'),false);assert.equal(x.calls.some(q=>q===plan.native.sql||q===owner.LISTING_SELECTED_BINDING_INSERT_SQL),false);
});
await check('exact schema augmentation rejects every cross-domain pair',async()=>{
 const schema=env.load('src/lib/core/domain-command-identity-v1.ts').coreDomainCommandIdentitySelectionV1Schema;
 const pairs=[['services.catalog.manage','services_catalog'],['services.catalog.publish','services_catalog'],['services.quotes.manage','services_orders'],['airprop.opportunity.manage','airprop_commercial']];
 for(const [permission_code,correct] of pairs)for(const module_code of ['services_catalog','services_orders','airprop_commercial'])assert.equal(schema.safeParse({...selected,permission_code,module_code}).success,module_code===correct);
});
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/successor-coupling-r2',SERVICE,AIRPROP,new_groups:n,transport:'CONTROLLED_REAL_MODULES',native:'NOT_RUN_NOT_PASS',authoring_agreement:'NOT_READY',listing_companion:'NOT_READY',target_calls:0}));
