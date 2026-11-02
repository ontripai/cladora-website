/** New S01 controlled-transport tests; no old suites, real SQL/Auth or DB. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const selectedCase=process.argv.includes('--case')?process.argv[process.argv.indexOf('--case')+1]:null;
const predecessorMode=process.argv.includes('--prove-predecessor');
const serializationOnly=process.argv.includes('--serialization-integration-only');
const closeoutOnly=predecessorMode||process.argv.includes('--closeout-only');
const consumer='4c0dcc075797ce8fc08d0e80ddb531370ebfc46f';
const require=createRequire(import.meta.url);const cache=new Map();
const show=path=>execFileSync('git',['show',`${consumer}:${path}`],{cwd:root,encoding:'utf8'});
for (const path of ['src/lib/core/resource-contracts-v1.ts','src/lib/core/current-authority-transaction-port-v1.ts',
 'src/lib/core/current-authority-postgres-provider-v1.ts','src/lib/core/postgres-transaction-host-v1.ts']) {
 assert.equal(show(path),readFileSync(resolve(root,path),'utf8'),`shared consumer ABI pin ${path}`);
}
function load(path) {
 path=extname(path)?path:`${path}.ts`;path=resolve(root,path);
 if(cache.has(path))return cache.get(path).exports;
 const relative=path.slice(root.length+1);
 const source=relative==='src/lib/customer/service-offering-disclosure-source-v1.ts'?execFileSync('git',['show',`4c0dcc075797ce8fc08d0e80ddb531370ebfc46f:${relative}`],{cwd:root,encoding:'utf8'}):predecessorMode&&relative==='src/lib/core/service-s01/provider-agreement-reader-v1.ts'?execFileSync('git',['show',`681a3743ff49c48adc00a737d59d2b5a4c848c04:${relative}`],{cwd:root,encoding:'utf8'}):relative.startsWith('src/lib/customer/')?show(relative):readFileSync(path,'utf8');
 const mod={exports:{}};cache.set(path,mod);
 const compiled=ts.transpileModule(source,{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,
  target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const local=specifier=>specifier.startsWith('@/')?load(resolve(root,'src',specifier.slice(2))):specifier.startsWith('.')?load(resolve(dirname(path),specifier)):require(specifier);
 new Function('require','module','exports',compiled)(local,mod,mod.exports);
 return mod.exports;
}
globalThis.fetch=async()=>{throw Error('OUTBOUND_FORBIDDEN');};
const {createCoreS01ProviderAgreementReaderV1,bindCoreS01PreflightReaderV1,CORE_S01_SQL,CORE_S01_RUNTIME_BINDING,createCoreS01AuthorityCaptureV1}=load('src/lib/core/service-s01/provider-agreement-reader-v1.ts');
const {CORE_S01_OFFERING_SOURCE_PIN,createCoreS01OfferingDisclosurePolicyV1}=load('src/lib/core/service-s01/offering-disclosure-policy-v1.ts');
const sourceBytes=execFileSync('git',['show',`${CORE_S01_OFFERING_SOURCE_PIN.commit}:${CORE_S01_OFFERING_SOURCE_PIN.path}`],{cwd:root});
assert.equal(require('node:crypto').createHash('sha256').update(sourceBytes).digest('hex'),CORE_S01_OFFERING_SOURCE_PIN.sha256);
assert.equal(execFileSync('git',['rev-parse',`${CORE_S01_OFFERING_SOURCE_PIN.commit}:${CORE_S01_OFFERING_SOURCE_PIN.path}`],{cwd:root,encoding:'utf8'}).trim(),CORE_S01_OFFERING_SOURCE_PIN.git_blob);
const {projectServiceOfferingDisclosureSourceV1,createServiceOfferingDisclosureCanDiscloseV1,SERVICE_OFFERING_DISCLOSURE_SQL}=load('src/lib/customer/service-offering-disclosure-source-v1.ts');
const {preflightServiceOfferingRequestV1}=load('src/lib/customer/service-v14-execution/application-flow.ts');
const {createCorePostgresTransactionHostV1}=load('src/lib/core/postgres-transaction-host-v1.ts');
const {prepareServiceV14Execution}=load('src/lib/customer/service-v14-execution/provider-binding.ts');
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ids={actor:id(1),tenant:id(2),workspace:id(3),context:id(4),agreement:id(5),party:id(6),tx:id(7),command:id(8),decision:id(9),offering:id(10),revision:id(11),request:id(12)};
const now='2026-11-02T12:00:00.000Z';
const input={contract_version:'provider-agreement-verification.v1',context_id:ids.context,workspace_id:ids.workspace,
 provider_agreement_id:ids.agreement,provider_agreement_version:3,requested_service_scope:['service.request.create'],permission_code:'services.orders.request'};
function setup() {
 const state={calls:[],disclose:true,allowed:true,session:true,postLock:()=>{},clock:now,
  head:{id:ids.agreement,tenant_id:ids.tenant,workspace_id:ids.workspace,provider_party_id:ids.party,current_version:3,revision:4,status:'effective'},
  row:{agreement_id:ids.agreement,tenant_id:ids.tenant,workspace_id:ids.workspace,provider_party_id:ids.party,version:3,
   valid_from:'2026-01-01',valid_until:'2027-01-01',allowed_service_scope:['service.request.create']}};
 const row=rows=>({rows:structuredClone(rows),rowCount:rows.length});
 const scope={transaction_id:ids.tx,database_transaction_id:'55',workspace_id:ids.workspace,tenant_id:ids.tenant,actor_id:ids.actor,attempt:1,
  async query(sql,params) {
   state.calls.push({sql,params:structuredClone(params)});
   if(Object.values(SERVICE_OFFERING_DISCLOSURE_SQL).includes(sql)){
    const rows={offering:{tenant_id:ids.tenant,workspace_id:ids.workspace,offering_id:ids.offering,offering_version:2,published_revision_id:ids.revision,provider_party_id:ids.party,definition_id:id(71)},
      revision:{tenant_id:ids.tenant,workspace_id:ids.workspace,offering_id:ids.offering,published_revision_id:ids.revision,published_revision_version:1,provider_agreement_id:ids.agreement,provider_agreement_version:3,revision_status:'published',valid_from:'2026-01-01T00:00:00.000Z',valid_until:null,acquisition_mode:'direct',coverage:{kind:'workspace'},eligibility:{policy_version:1,required_resource_types:[],required_capabilities:[],required_policy_codes:[]}},
      definition:{definition_id:id(71),tenant_id:ids.tenant,workspace_id:ids.workspace,definition_current:true},
      provider:{provider_party_id:ids.party,tenant_id:ids.tenant,provider_current:true},
      clock:{database_transaction_id:'55',actor_id:ids.actor,evaluated_at:state.clock}};
    if(state.sourceFault)state.sourceFault(rows);
    const key=Object.entries(SERVICE_OFFERING_DISCLOSURE_SQL).find(([,v])=>v===sql)[0];
    return row(state.sourceDuplicate&&key==='offering'?[rows[key],rows[key]]:[rows[key]]);
   }
   if(sql===CORE_S01_SQL.clock)return row([{database_transaction_id:'55',actor_id:ids.actor,isolation:'serializable',evaluated_at:state.clock}]);
   if(sql===CORE_S01_SQL.final){assert.deepEqual(params,[ids.context,ids.workspace,'services.orders.request','services_orders']);if(!state.session)throw Object.assign(Error('private_session'),{code:'42501'});return row([{database_transaction_id:'55',actor_id:ids.actor,isolation:'serializable',evaluated_at:state.clock,allowed:state.allowed,session_guard:'',authority_revision:'9'}]);}
   if(sql===CORE_S01_SQL.session){if(!state.session)throw Object.assign(Error('private_session'),{code:'42501'});return row([{session:null}]);}
   if(sql===CORE_S01_SQL.head||sql===CORE_S01_SQL.discover){assert.deepEqual(params,[ids.agreement,ids.tenant,ids.workspace]);return row(state.head===null?[]:[state.head]);}
   if(sql===CORE_S01_SQL.version){assert.deepEqual(params,[ids.agreement,ids.tenant,ids.workspace,state.head.current_version]);return row([state.row]);}
   if(sql===CORE_S01_SQL.party)return row([{id:ids.party,tenant_id:ids.tenant,current:true}]);
   if(sql===CORE_S01_SQL.workspace){state.postLock();return row([{id:ids.workspace,tenant_id:ids.tenant,current:true}]);}
   // Execute the actual accepted authority provider algorithm on controlled rows.
   if(sql.includes('select txid_current()'))return row([{transaction_id:'55',actor_id:ids.actor,isolation:'serializable',evaluated_at:state.clock}]);
   if(sql.includes('canonical_authority_revision_v1'))return row([{revision:'9'}]);
   if(sql.includes('identity.context_grants'))return row([{tenant_id:ids.tenant,actor_id:ids.actor,status:'active',current:true}]);
   if(sql.includes('app_private.check_workspace_native_permission_v2'))return row([{allowed:state.allowed,evaluated_at:state.clock,module_definition_id:id(20),entitlement_key:null}]);
   if(sql.includes('platform.customer_workspaces'))return row([{tenant_id:ids.tenant}]);
   if(sql.includes('resolve_service_v14_execution_source_v1'))return row([{source:{workspace_id:ids.workspace,offering_id:ids.offering,revision_id:ids.revision,
     offering_version:2,revision_version:1,provider_party_id:ids.party,provider_agreement_id:ids.agreement,provider_agreement_version:3,
     status:'published',offering_available:true,coverage_kind:'workspace',coverage:{kind:'workspace'},required_resource_types:[],requires_capability_policy_resolution:false}}]);
   throw Error('UNEXPECTED_SQL');
  }};
 const authorityRequest={contract_version:'core-current-authority-transaction-port-request.v1',decision_id:ids.decision,
  context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:9,permission_code:'services.orders.request',module_code:'services_orders',evaluation_purpose:'service.create_request',
  transaction_context:{transaction_id:ids.tx,command_id:ids.command,attempt:1,isolation_level:'serializable',
   lock:{kind:'command_aggregate',workspace_id:ids.workspace,aggregate_type:'service_request',aggregate_id:ids.request,acquired_at:'2026-11-02T11:59:00.000Z'}}};
 const bindings={source:{contract:predecessorMode?'core-provider-agreement-store-proposal.v1':'core-provider-agreement-store.v1',date_policy:predecessorMode?'utc_start_inclusive_end_exclusive.proposal.v1':'utc_start_inclusive_end_exclusive.operational.v1'},
  authorityRequestFor:()=>structuredClone(authorityRequest),canDisclose:async()=>state.disclose?'disclose':'withhold'};
 bindings.offeringPolicy=createCoreS01OfferingDisclosurePolicyV1({pin:CORE_S01_OFFERING_SOURCE_PIN,createServiceOfferingDisclosureCanDiscloseV1(binding,ports){const actual=createServiceOfferingDisclosureCanDiscloseV1(binding,ports);return async(scope,input)=>{const decision=await actual(scope,input);if(decision!=='disclose')return decision;return await bindings.canDisclose(scope,input)==='disclose'?decision:'withhold';};},
  binding:{contract_version:'service-offering-disclosure-source.v1',context_id:ids.context,workspace_id:ids.workspace,offering_id:ids.offering,offering_version:2,published_revision_id:ids.revision,published_revision_version:1,provider_party_id:ids.party,provider_agreement_id:ids.agreement,provider_agreement_version:3,requested_service_scope:'service.request.create',permission_code:'services.orders.request'},
  authorityRequestFor:bindings.authorityRequestFor,
  projectServiceOfferingDisclosureSourceV1});
 return {state,scope,authorityRequest,bindings,reader:createCoreS01ProviderAgreementReaderV1(bindings)};
}
let count=0;async function check(name,fn){if(selectedCase&&name!==selectedCase)return;if(serializationOnly&&!name.startsWith('serialization:'))return;if(closeoutOnly&&!name.startsWith('closeout:'))return;if(predecessorMode&&!name.startsWith('closeout: last disclosure')&&name!=='closeout: final disclosure allowed control')return;await fn();count++;console.log(`PASS ${name}`);}
function redacted(answer){assert.equal(answer.agreement_status,'withheld');for(const key of ['tenant_id','workspace_id','provider_party_id','provider_agreement_id','provider_agreement_version','valid_from','valid_until'])assert.equal(answer[key],null);assert.deepEqual(answer.allowed_service_scope,[]);assert.equal(answer.action_authorization,'not_evaluated');}
await check('default source is inactive',async()=>{assert.equal(CORE_S01_RUNTIME_BINDING,null);const x=setup();x.bindings.source=null;await assert.rejects(createCoreS01ProviderAgreementReaderV1(x.bindings)(x.scope,input),e=>e.code==='SOURCE_NOT_READY');assert.equal(x.state.calls.length,0);});
await check('real producer reads locked rows, exact tuple and disclosure-only output',async()=>{const x=setup();const result=await x.reader(x.scope,input);assert.equal(result.agreement_status,'effective');assert.equal(result.provider_party_id,ids.party);assert.equal(result.provider_agreement_version,3);assert.equal(result.action_authorization,'not_evaluated');assert.equal(x.state.calls.filter(x=>x.sql===CORE_S01_SQL.head).length,2);assert.ok(x.state.calls.filter(x=>x.sql===CORE_S01_SQL.session).length>=2);});
for (const [name,mutate,status] of [
 ['expired',x=>{x.state.row.valid_until='2026-11-02';},'expired'],
 ['not yet effective',x=>{x.state.row.valid_from='2026-12-01';},'not_effective'],
 ['revoked',x=>{x.state.head.status='revoked';},'revoked'],
 ['stale version',x=>{x.state.head.current_version=4;x.state.row.version=4;},'withheld'],
 ['scope mismatch',x=>{x.state.row.allowed_service_scope=['service.other'];},'not_effective'],
 ['foreign row',x=>{x.state.row.workspace_id=id(30);},'withheld'],
 ['foreign tenant',x=>{x.state.row.tenant_id=id(31);},'withheld'],
 ['party mismatch',x=>{x.state.row.provider_party_id=id(32);},'withheld'],
 ['authority revoked after locks',x=>{x.state.postLock=()=>{x.state.allowed=false;};},'withheld'],
 ['session revoked after locks',x=>{x.state.postLock=()=>{x.state.session=false;};},'withheld'],
 ['disclosure revoked after locks',x=>{x.state.postLock=()=>{x.state.disclose=false;};},'withheld'],
 ['head drift after locks',x=>{x.state.postLock=()=>{x.state.head.revision++;};},'withheld'],
 ['expiry crossed during lock wait',x=>{x.state.row.valid_until='2026-11-03';x.state.postLock=()=>{x.state.clock='2026-11-03T00:00:00.000Z';};},'expired'],
 ])await check(name,async()=>{const x=setup();mutate(x);const result=await x.reader(x.scope,input);assert.equal(result.agreement_status,status);if(status==='withheld')redacted(result);});
await check('withheld before any private scan',async()=>{const x=setup();x.state.disclose=false;redacted(await x.reader(x.scope,input));assert.equal(x.state.calls.filter(c=>c.sql===CORE_S01_SQL.head).length,0);});
await check('foreign requested Workspace never probes private',async()=>{const x=setup();redacted(await x.reader(x.scope,{...input,workspace_id:id(40)}));assert.equal(x.state.calls.length,1);});
await check('request actor and user_metadata are rejected',async()=>{for(const extra of [{actor_id:ids.actor},{user_metadata:{allowed:true}}]){const x=setup();await assert.rejects(x.reader(x.scope,{...input,...extra}),e=>e.code==='INVALID_INPUT');assert.equal(x.state.calls.length,0);}});
await check('server Context mismatch cannot disclose',async()=>{const x=setup();x.authorityRequest.context_id=id(41);redacted(await x.reader(x.scope,input));assert.equal(x.state.calls.filter(c=>c.sql===CORE_S01_SQL.head).length,0);});
await check('malformed source does not become empty/effective',async()=>{const x=setup();x.state.row.version=0;await assert.rejects(x.reader(x.scope,input),e=>e.code==='SOURCE_UNAVAILABLE');});
await check('duplicate head cardinality is unavailable',async()=>{const x=setup();const query=x.scope.query.bind(x.scope);x.scope.query=async(sql,params)=>{const result=await query(sql,params);return sql===CORE_S01_SQL.head?{rows:[result.rows[0],result.rows[0]],rowCount:2}:result;};await assert.rejects(x.reader(x.scope,input),e=>e.code==='SOURCE_INVARIANT');});
await check('date clock follows a waiting disclosure recheck',async()=>{const x=setup();x.state.row.valid_until='2026-11-03';let probes=0;x.bindings.canDisclose=async()=>{if(++probes===2)x.state.clock='2026-11-03T00:00:00.000Z';return 'disclose';};assert.equal((await x.reader(x.scope,input)).agreement_status,'expired');});
await check('timeout is not a successful response and no raw detail leaks',async()=>{const x=setup();x.scope.query=async()=>{throw Object.assign(Error('PRIVATE_DIAGNOSTIC'),{code:'57014'});};await assert.rejects(x.reader(x.scope,input),e=>e.message==='SOURCE_UNAVAILABLE'&&!JSON.stringify(e).includes('PRIVATE_DIAGNOSTIC'));});
const snapshot={workspace_id:ids.workspace,offering_id:ids.offering,offering_version:2,published_revision_id:ids.revision,published_revision_version:1,
 provider_party_id:ids.party,provider_agreement_id:ids.agreement,provider_agreement_version:3,status:'published',acquisition_mode:'direct',valid_from:'2026-01-01T00:00:00Z',valid_until:null,
 coverage:{kind:'workspace'},eligibility:{policy_version:1,required_resource_types:[],required_capabilities:[],required_policy_codes:[]},current_actor_can_request:true};
function errorPlan(){return{operation:'create_request',context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:9,transaction_id:ids.tx,command_id:ids.command,request_id:ids.request,offering_id:ids.offering,expected_offering_version:2,published_revision_id:ids.revision,published_revision_version:1,provider_party_id:ids.party,provider_agreement_id:ids.agreement,provider_agreement_version:3,requested_service_scope:'service.request.create',resource:null,beneficiary_party_id:id(50),description:'Synthetic nonfinancial source',idempotency_key:'s01-error-boundary-0001'};}
const preflightInput={context_id:ids.context,workspace_id:ids.workspace,offering_id:ids.offering,published_revision_id:ids.revision};
await check('closeout: actual SERVICE preflight consumes source-bound Core policy',async()=>{const x=setup();const ports={loadOffering:async()=>snapshot,resolveProviderAgreement:bindCoreS01PreflightReaderV1(x.reader,x.scope),now:()=>Date.parse(now)};
 assert.equal((await preflightServiceOfferingRequestV1(preflightInput,ports)).status,'ready');x.state.head.status='revoked';assert.equal((await preflightServiceOfferingRequestV1(preflightInput,ports)).status,'denied');});
await check('closeout: actual SERVICE transactional interface source-bound policy',async()=>{const x=setup();const plan={operation:'create_request',context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
 authority_version:9,transaction_id:ids.tx,command_id:ids.command,request_id:ids.request,offering_id:ids.offering,expected_offering_version:2,published_revision_id:ids.revision,published_revision_version:1,
 provider_party_id:ids.party,provider_agreement_id:ids.agreement,provider_agreement_version:3,requested_service_scope:'service.request.create',resource:null,beneficiary_party_id:id(50),description:'Nonfinancial synthetic request',idempotency_key:'core-s01-test-0001'};
 const readers={resolveProviderAgreement:x.reader,resolveCanonicalResource:async()=>{throw Error('S02_NOT_IN_SCOPE');}};
 const dispatch=prepareServiceV14Execution(plan,readers);const authority={decision_id:ids.decision,authority_version:9};
 assert.equal((await dispatch.providers.validateProviders(x.scope,dispatch.command,authority)).decision,'accepted');
 x.state.postLock=()=>{x.state.allowed=false;};assert.equal((await dispatch.providers.validateProviders(x.scope,dispatch.command,authority)).decision,'denied');
 assert.equal(x.state.calls.some(c=>c.sql.includes('apply_service_v14_execution_v1')),false);});
await check('actual SERVICE preflight stays not_ready without source binding',async()=>{const x=setup();x.bindings.source=null;const reader=createCoreS01ProviderAgreementReaderV1(x.bindings);const result=await preflightServiceOfferingRequestV1(preflightInput,{loadOffering:async()=>snapshot,resolveProviderAgreement:bindCoreS01PreflightReaderV1(reader,x.scope),now:()=>Date.parse(now)});assert.deepEqual(result,{status:'not_ready',code:'SERVICE_S01_NOT_READY'});assert.equal(x.state.calls.length,0);});
await check('actual SERVICE preflight withholds version outside Offering binding',async()=>{const x=setup();x.state.head.current_version=4;x.state.row.version=4;const result=await preflightServiceOfferingRequestV1(preflightInput,{loadOffering:async()=>snapshot,resolveProviderAgreement:bindCoreS01PreflightReaderV1(x.reader,x.scope),now:()=>Date.parse(now)});assert.deepEqual(result,{status:'denied',code:'SOURCE_ACCESS_DENIED'});});
await check('reader never dispatches mutation or new receipt',async()=>{const x=setup();await x.reader(x.scope,input);assert.ok(x.state.calls.every(c=>/^select\b/i.test(c.sql.trim())));});
await check('Core capture binds exact accepted server scope, not request metadata',async()=>{const x=setup();const capture=createCoreS01AuthorityCaptureV1();const reader=createCoreS01ProviderAgreementReaderV1({...x.bindings,authorityRequestFor:capture.authorityRequestFor});await assert.rejects(reader(x.scope,input),e=>e.code==='SOURCE_NOT_READY');await capture.resolveAuthority(x.scope,x.authorityRequest);assert.equal((await reader(x.scope,input)).agreement_status,'effective');assert.throws(()=>capture.authorityRequestFor({...x.scope}),e=>e.code==='SOURCE_NOT_READY');x.state.allowed=false;await capture.resolveAuthority(x.scope,x.authorityRequest);assert.throws(()=>capture.authorityRequestFor(x.scope),e=>e.code==='SOURCE_NOT_READY');});
await check('private read privilege failure is unavailable, not user denial',async()=>{const x=setup();assert.equal((await x.reader(x.scope,input)).agreement_status,'effective');const query=x.scope.query.bind(x.scope);x.scope.query=async(sql,params)=>{if(sql===CORE_S01_SQL.head)throw Object.assign(Error('PRIVATE_TABLE_DIAGNOSTIC'),{code:'42501'});return query(sql,params);};await assert.rejects(x.reader(x.scope,input),e=>e.code==='SOURCE_UNAVAILABLE'&&!e.message.includes('PRIVATE_TABLE_DIAGNOSTIC'));});
for (const fault of ['session','authority']) await check(`closeout: last disclosure ${fault} invalidation`,async()=>{const x=setup();let calls=0;let tail=0;x.bindings.canDisclose=async()=>{if(++calls===2){if(fault==='session')x.state.session=false;else x.state.allowed=false;tail=x.state.calls.length;}return 'disclose';};const result=await x.reader(x.scope,input);if(predecessorMode){assert.equal(result.agreement_status,'effective');assert.ok(x.state.calls.slice(tail).every(c=>c.sql===CORE_S01_SQL.clock));console.log(`COUNTEREXAMPLE ${fault} old effective; post-wait clock-only`);}else{redacted(result);assert.ok(x.state.calls.slice(tail).some(c=>c.sql===CORE_S01_SQL.session));}});
await check('closeout: final disclosure allowed control',async()=>{const x=setup();const result=await x.reader(x.scope,input);assert.equal(result.agreement_status,'effective');assert.equal(result.action_authorization,'not_evaluated');});
await check('closeout: unbound Offering source remains NOT_READY',async()=>{const x=setup();x.bindings.offeringPolicy=createCoreS01OfferingDisclosurePolicyV1();await assert.rejects(x.reader(x.scope,input),e=>e.code==='SOURCE_NOT_READY');assert.equal(x.state.calls.filter(c=>c.sql===CORE_S01_SQL.discover).length,0);});
await check('closeout: source absence and timeout are not successful disclosure',async()=>{const x=setup();x.bindings.source=null;await assert.rejects(createCoreS01ProviderAgreementReaderV1(x.bindings)(x.scope,input),e=>e.code==='SOURCE_NOT_READY');const y=setup();y.bindings.offeringPolicy={async readAndCheck(){throw Object.assign(Error('private'),{code:'57014'});}};await assert.rejects(y.reader(y.scope,input),e=>e.code==='SOURCE_UNAVAILABLE');});
await check('closeout: final observation rejects mismatched transaction or revision',async()=>{for(const change of [{database_transaction_id:'999'},{authority_revision:'10'},{actor_id:id(99)}]){const x=setup();const query=x.scope.query.bind(x.scope);x.scope.query=async(sql,params)=>{const r=await query(sql,params);if(sql===CORE_S01_SQL.final)Object.assign(r.rows[0],change);return r;};redacted(await x.reader(x.scope,input));}});
await check('closeout: unrelated scopes are never disclosed',async()=>{const x=setup();x.state.row.allowed_service_scope.push('service.private.finance');const result=await x.reader(x.scope,input);assert.deepEqual(result.allowed_service_scope,['service.request.create']);});
await check('closeout: parent-first lock order and positive no-end validity',async()=>{const x=setup();x.state.row.valid_until=null;assert.equal((await x.reader(x.scope,input)).agreement_status,'effective');const calls=x.state.calls.map(c=>c.sql);assert.ok(calls.indexOf(CORE_S01_SQL.party)<calls.indexOf(CORE_S01_SQL.workspace));assert.ok(calls.indexOf(CORE_S01_SQL.workspace)<calls.indexOf(CORE_S01_SQL.head));assert.ok(calls.indexOf(CORE_S01_SQL.head)<calls.indexOf(CORE_S01_SQL.version));});
await check('closeout: actual Offering source denies incompatible source family',async()=>{for(const mutate of [r=>{r.revision.revision_status='suspended';},r=>{r.definition.definition_current=false;},r=>{r.provider.provider_current=false;},r=>{r.revision.coverage={kind:'resources',resources:[]};},r=>{r.revision.acquisition_mode='reservation';},r=>{r.revision.provider_agreement_version=2;},r=>{r.offering.provider_party_id=id(90);},r=>{r.revision.valid_until='2026-11-02T12:00:00.000Z';}]){const x=setup();x.state.sourceFault=mutate;let result;try{result=await x.reader(x.scope,input);}catch(error){assert.ok(['SOURCE_NOT_READY','SOURCE_UNAVAILABLE','SOURCE_INVARIANT'].includes(error.code));continue;}redacted(result);}});
await check('closeout: actual Offering ambiguous/malformed source never selects first',async()=>{const x=setup();x.state.sourceDuplicate=true;await assert.rejects(x.reader(x.scope,input),e=>e.code==='SOURCE_NOT_READY');const y=setup();y.state.sourceFault=r=>{r.revision.provider_agreement_version=null;};await assert.rejects(y.reader(y.scope,input),e=>e.code==='SOURCE_NOT_READY');});
await check('closeout: Offering expiry during final disclosure remains withheld',async()=>{const x=setup();x.state.sourceFault=r=>{r.revision.valid_until='2026-11-02T12:00:01.000Z';};let count=0;x.bindings.canDisclose=async()=>{if(++count===2)x.state.clock='2026-11-02T12:00:02.000Z';return 'disclose';};redacted(await x.reader(x.scope,input));});
await check('closeout: current agreement version outside Offering binding is redacted',async()=>{const x=setup();x.state.head.current_version=4;x.state.row.version=4;redacted(await x.reader(x.scope,input));assert.equal(x.state.calls.filter(c=>c.sql===CORE_S01_SQL.version).length,0);});
await check('closeout: Core wrapper preserves original 40001 at every reader stage',async()=>{for(const sql of [CORE_S01_SQL.clock,CORE_S01_SQL.session,CORE_S01_SQL.discover,CORE_S01_SQL.party,CORE_S01_SQL.workspace,CORE_S01_SQL.head,CORE_S01_SQL.version,CORE_S01_SQL.final]){const x=setup();const driver=Object.assign(Error('synthetic serialization'),{code:'40001'});const query=x.scope.query.bind(x.scope);x.scope.query=async(text,params)=>{if(text===sql)throw driver;return query(text,params);};await assert.rejects(x.reader(x.scope,input),error=>error===driver);}});
async function exerciseHost40001(useService=false,faultBoundary='core'){const x=setup();const capture=createCoreS01AuthorityCaptureV1();const sourcePolicy=createCoreS01OfferingDisclosurePolicyV1({pin:CORE_S01_OFFERING_SOURCE_PIN,createServiceOfferingDisclosureCanDiscloseV1,binding:{contract_version:'service-offering-disclosure-source.v1',context_id:ids.context,workspace_id:ids.workspace,offering_id:ids.offering,offering_version:2,published_revision_id:ids.revision,published_revision_version:1,provider_party_id:ids.party,provider_agreement_id:ids.agreement,provider_agreement_version:3,requested_service_scope:'service.request.create',permission_code:'services.orders.request'},projectServiceOfferingDisclosureSourceV1,authorityRequestFor:capture.authorityRequestFor});const reader=createCoreS01ProviderAgreementReaderV1({...x.bindings,offeringPolicy:sourcePolicy,authorityRequestFor:capture.authorityRequestFor});const wire=[];let connects=0;let faults=0;const pool={async connect(){connects++;return{async query(sql,params){wire.push(sql);if(/^begin|^set local|^rollback$/i.test(sql))return{rows:[],rowCount:0};if(sql.includes('pg_advisory_xact_lock'))return{rows:[],rowCount:1};if(sql.includes('as id, clock_timestamp()'))return{rows:[{id:'55',now}],rowCount:1};if(sql.includes('as actor_bound'))return{rows:[{actor_bound:true,allowed:true}],rowCount:1};if(sql.includes('response_ref,expires_at'))return{rows:[],rowCount:0};if(sql.includes('select tenant_id from platform.customer_workspaces'))return{rows:[{tenant_id:ids.tenant}],rowCount:1};if(sql===(faultBoundary==='source'?SERVICE_OFFERING_DISCLOSURE_SQL.offering:CORE_S01_SQL.final)){faults++;throw Object.assign(Error('synthetic serialization'),{code:'40001'});}return x.scope.query(sql,params);},release(){}};}};const host=createCorePostgresTransactionHostV1(pool);const command={contract_version:'core-transaction-command.v1',transaction_id:ids.tx,command_id:ids.command,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:9,permission_code:'services.orders.request',module_code:'services_orders',evaluation_purpose:'service.create_request',aggregate_type:'service_request',aggregate_id:ids.request,aggregate_version:1,provider_source_ids:[ids.agreement],idempotency_key:'s01-original-host-40001',input_fingerprint:'sha256:'+'a'.repeat(64)};let selectedCommand=command;let selectedProviders={resolveAuthority:capture.resolveAuthority,async validateProviders(scope){await reader(scope,input);throw Error('fault should already throw');},async mutate(){throw Error('MUTATION_FORBIDDEN');}};if(useService){const dispatch=prepareServiceV14Execution(errorPlan(),{resolveProviderAgreement:reader,async resolveCanonicalResource(){throw Error('OUT_OF_SCOPE');}});selectedCommand=dispatch.command;selectedProviders={...dispatch.providers,resolveAuthority:capture.resolveAuthority};}const result=await host.execute(selectedCommand,selectedProviders);assert.equal(connects,3);assert.equal(faults,3);assert.equal(wire.filter(q=>q==='rollback').length,3);assert.deepEqual(result,{status:'denied',code:'TRANSACTION_FAILED'});assert.ok(wire.every(q=>!/^insert|^update|^delete|^commit/i.test(q)));}
await check('closeout: original Core host receives 40001 and owns bounded attempts',()=>exerciseHost40001());
await check('serialization: actual SERVICE provider reaches original host retry',()=>exerciseHost40001(true));
for (const boundary of ['preflight','transactional','replay']) await check(`serialization: ${boundary} preserves original Core 40001`,async()=>{
 const x=setup();const driver=Object.assign(Error('synthetic serialization'),{code:'40001'});
 const query=x.scope.query.bind(x.scope);let faults=0;
 x.scope.query=async(sql,params)=>{if(sql===CORE_S01_SQL.final){faults++;throw driver;}return query(sql,params);};
 if(boundary==='preflight')await assert.rejects(preflightServiceOfferingRequestV1(preflightInput,{loadOffering:async()=>snapshot,resolveProviderAgreement:bindCoreS01PreflightReaderV1(x.reader,x.scope),now:()=>Date.parse(now)}),error=>error===driver);
 else {
  const dispatch=prepareServiceV14Execution(errorPlan(),{resolveProviderAgreement:x.reader,async resolveCanonicalResource(){throw Error('OUT_OF_SCOPE');}});
  const authority={decision_id:ids.decision,authority_version:9};
  // Actual validateReplay revalidates the provider before inspecting the stored
  // receipt. This sentinel must not be accessed after the exact reader failure.
  const receipt=new Proxy({},{get(){throw Error('REPLAY_RECEIPT_MUST_NOT_BE_CONSUMED_AFTER_40001');}});
  await assert.rejects(boundary==='replay'?dispatch.providers.validateReplay(x.scope,dispatch.command,authority,receipt):dispatch.providers.validateProviders(x.scope,dispatch.command,authority),error=>error===driver);
 }
 assert.equal(faults,1);assert.ok(x.state.calls.every(({sql})=>!/^\s*(insert|update|delete|commit)\b/i.test(sql)));
});
await check('closeout: accepted actual canDisclose propagates 40001 through Core to existing host',()=>exerciseHost40001(false,'source'));
console.log(JSON.stringify({status:'CONTROLLED_SOURCE_CONNECTION_PASS',checks:count,consumer,offering_source:CORE_S01_OFFERING_SOURCE_PIN.commit,sql:'NOT_RUN',runtime_binding:CORE_S01_RUNTIME_BINDING}));
