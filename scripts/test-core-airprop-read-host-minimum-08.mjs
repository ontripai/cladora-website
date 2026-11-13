/** Actual owner consumer + Core host, controlled pg/SSR; no network/DB/Auth. */
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),consumer='2981ec440e5978724c8da373800e9b1913f63905';
const require=createRequire(import.meta.url),cache=new Map();let active;
globalThis.fetch=async()=>{throw Error('OUTBOUND_FORBIDDEN');};
function load(file){
 const path=resolve(root,extname(file)?file:`${file}.ts`);
 if(path===resolve(root,'src/lib/supabase/server.ts'))return{async createClient(){return active.auth;}};
 if(cache.has(path))return cache.get(path).exports;
 const rel=path.slice(root.length+1),source=rel.startsWith('src/lib/airprop/')?execFileSync('git',['show',`${consumer}:${rel}`],{cwd:root,encoding:'utf8'}):readFileSync(path,'utf8');
 const loaded={exports:{}};cache.set(path,loaded);
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const local=name=>name==='server-only'?{}:name.startsWith('.')?load(resolve(dirname(path),name)):name.startsWith('@/')?load(resolve(root,'src',name.slice(2))):require(name);
 new Function('require','module','exports',js)(local,loaded,loaded.exports);return loaded.exports;
}
const {createCoreAirpropReadHostV1:createHost,coreReadFailureInfoV1:info,CORE_READ_HOST_SQL:sql,CORE_READ_HOST_BUDGETS:budgets,CORE_AIRPROP_READ_HOST_RUNTIME_BINDING:binding}=load('src/lib/core/airprop-read-host-v1.ts');
const {queryListingNativePageV1:page,createListingNativeReadV1:createRead,LISTING_NATIVE_PAGE_SQL:pageSql}=load('src/lib/airprop/listing-native-read-v1.ts');
const {selectCurrentUnitPropertyV1:selector,currentUnitPropertySelectorRequestV1Schema:selectorSchema}=load('src/lib/core/current-unit-property-selector-v1.ts');
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ids={actor:id(1),tenant:id(2),workspace:id(3),context:id(4),membership:id(5),session:id(6)};
const requested={context_id:ids.context,workspace_id:ids.workspace};
const originalTimer=globalThis.setTimeout;
globalThis.setTimeout=(fn,ms,...args)=>originalTimer(fn,active?.fastTimeout&&(ms===15000||ms===5000)?0:ms,...args);
function fixture(){
 const state={events:[],calls:[],connects:0,clients:[],guardCount:0,clock:'2026-11-02T12:00:00.000100Z',complete:'2026-11-02T12:00:00.000900Z',expires:'2026-11-02T13:00:00.000000Z',actor:ids.actor};
 const principal={executor:'test_read_executor',runtime:'test_read_runtime'};
 state.auth={auth:{async getUser(){return{data:{user:{id:state.actor}},error:null};},async getClaims(){return{data:{claims:{sub:state.actor,session_id:ids.session,exp:2000000000,aal:'aal2',role:'authenticated',...(state.claimPatch??{})}},error:null};}}};
 const pool={async connect(){state.connects++;if(state.acquire)await state.acquire;
  const client=new EventEmitter();state.clients.push(client);client.pending=[];
  client.release=destroy=>{state.events.push('cleanup');assert.equal(destroy,true);if(state.cleanupError)throw state.cleanupError;
   for(const reject of client.pending)reject(Error('synthetic socket closed'));
   if(!state.noEnd)queueMicrotask(()=>client.emit('end'));
  };
  client.query=async(text,params=[])=>{
   state.calls.push({text,params:structuredClone(params)});state.events.push(text);
   if(state.failSql===text)throw state.driver;
   const result=(rows,command='SELECT')=>({rows,rowCount:rows.length,command});
   if(text===sql.principal)return result([{...principal,rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,...state.principalPatch}]);
   if(text.startsWith('set '))return result([],'SET');
   if(text==='begin isolation level serializable')return result([],'BEGIN');
   if(text==='commit'){if(state.commitBarrier)await state.commitBarrier;return result([],state.commitTag??'COMMIT');}
   if(text==='rollback')return result([],'ROLLBACK');
   if(text===sql.identity){const claims=JSON.parse(params[0]);assert.equal(claims.sub,ids.actor);assert.equal(claims.session_id,ids.session);assert.equal(claims.role,'authenticated');assert.equal(Object.hasOwn(claims,'user_metadata'),false);return result([{}]);}
   if(text===sql.session)return result([{}]); // Controlled response to the real C01 session-barrier call.
   if(text===sql.revision)return result([{revision:'9'}]);
   if(text===sql.resolve){assert.deepEqual(params,[requested.context_id,requested.workspace_id]);return result([{tenant_id:ids.tenant,workspace_id:ids.workspace,membership_id:ids.membership,...state.resolvePatch}]);}
   if(text===sql.lock){if(state.lockBarrier)await state.lockBarrier;return result([{...requested,tenant_id:ids.tenant,membership_id:ids.membership,actor_id:ids.actor,...state.lockPatch}]);}
   if(text===sql.guard){state.guardCount++;if(state.guardCount===2&&state.clientError)client.emit('error',state.clientError);if(state.finalBarrier&&state.guardCount===2)await state.finalBarrier;
    if(state.guardError&&state.guardCount===2)throw state.guardError;
    return result([{...requested,tenant_id:ids.tenant,membership_id:ids.membership,actor_id:ids.actor,database_transaction_id:'77',backend_pid:80,authority_revision:'9',allowed:true,scope_current:true,checked_at:state.clock,scope_expires_at:state.expires,session_guard:'',...(state.guardCount===2?state.finalPatch:state.initialPatch)}]);}
   if(text===sql.completed){assert.deepEqual(params,[state.expires]);return result([{backend_pid:80,completed_at:state.complete,unexpired:true,...state.completionPatch}]);}
   if(text===pageSql){if(state.hangPage){state.fastTimeout=true;return new Promise((_,reject)=>client.pending.push(reject));}
    return result([{listing_id:id(10),tenant_id:ids.tenant,workspace_id:ids.workspace,property_id:id(11),unit_id:id(12),listing_version:2,status:'published',available_from:'2026-11-01T00:00:00.000000Z',available_until:null}]);}
   throw Error('UNEXPECTED_DRIVER_SQL');
  };
  return client;
 }};
 const host=createHost({pool,principal});active=state;return{state,host};
}
let count=0;async function check(name,fn){try{await fn();count++;console.log(`PASS ${name}`);}finally{active=undefined;}}
async function run(x,read=(scope,server)=>page(scope,server)){active=x.state;return x.host.withScope(ids.actor,requested,read);}
function noWrites(state){for(const {text} of state.calls){assert.ok(/^(select|set |begin |commit$|rollback$)/i.test(text));assert.doesNotMatch(text,/\b(insert|update|delete|platform\.idempotency_keys|audit\.events|platform\.outbox_events)\b/i);assert.doesNotMatch(text,/read only/i);}if(state.calls.some(c=>c.text==='begin isolation level serializable')){assert.ok(state.calls.some(c=>c.text==="set lock_timeout = '5s'"));assert.ok(state.calls.some(c=>c.text==="set statement_timeout = '10s'"));}}
await check('actual AIRPROP page + Core minimum host positive; same backend and microseconds',async()=>{const x=fixture();const r=await run(x);assert.equal(r.value.length,1);assert.equal(r.completed_at,x.state.complete);assert.equal(x.state.connects,1);assert.equal(x.state.guardCount,2);assert.ok(x.state.events.indexOf('commit')<x.state.events.indexOf(sql.completed));assert.equal(x.state.events.at(-1),'cleanup');assert.equal(binding,null);noWrites(x.state);});
await check('no completion or result before positive COMMIT settlement',async()=>{const x=fixture();let release;x.state.commitBarrier=new Promise(r=>{release=r;});let done=false;const pending=run(x).then(r=>{done=true;return r;});for(let i=0;i<100&&!x.state.events.includes('commit');i++)await Promise.resolve();assert.equal(done,false);assert.equal(x.state.events.includes(sql.completed),false);release();await pending;assert.equal(done,true);});
for(const [name,change] of [
 ['foreign tenant',s=>s.lockPatch={tenant_id:id(90)}],['foreign Workspace',s=>s.resolvePatch={workspace_id:id(90)}],
 ['foreign actor',s=>s.lockPatch={actor_id:id(90)}],['revoked canonical scope',s=>s.initialPatch={allowed:false}],
 ['expired initial scope',s=>s.initialPatch={scope_current:false}],['revoked final scope',s=>s.finalPatch={allowed:false}],
 ['expired after callback waits',s=>s.finalPatch={scope_current:false}],['revision drift',s=>s.finalPatch={authority_revision:'10'}],
 ['backend drift',s=>s.finalPatch={backend_pid:81}],['expired post-COMMIT completion',s=>s.completionPatch={unexpired:false}],
 ['bad completed timestamp',s=>s.complete='not-a-time'],['completion backend mismatch',s=>s.completionPatch={backend_pid:81}],
 ['completion before final observation',s=>s.complete='2026-11-02T11:59:59.999999Z'],
 ['superuser principal',s=>s.principalPatch={rolsuper:true}],
])await check(name,async()=>{const x=fixture();change(x.state);await assert.rejects(run(x));noWrites(x.state);});
await check('client scope/allow JSON is never trusted',async()=>{const x=fixture();await assert.rejects(x.host.withScope(ids.actor,{...requested,tenant_id:ids.tenant,allow:true},async()=>[]));assert.equal(x.state.connects,0);});
await check('claimed actor differs from actual SSR verified user',async()=>{const x=fixture();await assert.rejects(x.host.withScope(id(90),requested,async()=>[]));assert.equal(x.state.connects,0);});
await check('service-role claims cannot be fallback identity',async()=>{const x=fixture();x.state.claimPatch={role:'service_role'};await assert.rejects(run(x));assert.equal(x.state.connects,0);});
await check('scope and server identity are frozen; mutation suppresses response',async()=>{const x=fixture();await assert.rejects(run(x,async scope=>{scope.workspace_id=id(90);return [];}),TypeError);assert.equal(x.state.calls.some(c=>c.text==='commit'),false);});
await check('scope use-after-settlement and different scope/attempt cannot query',async()=>{const x=fixture();let old;await run(x,async scope=>{old=scope;return [];});const before=x.state.calls.length;await assert.rejects(old.query(pageSql,[ids.tenant,ids.workspace,null,100]));assert.equal(x.state.calls.length,before);
 const y=fixture();await assert.rejects(run(y,async scope=>{await old.query.call(scope,pageSql,[ids.tenant,ids.workspace,null,100]);return [];}));assert.equal(y.state.calls.some(c=>c.text===pageSql),false);});
for(const text of ['select 1','select set_config(\'request.jwt.claims\',\'{}\',true)','select side_effecting_function()','with x as (delete from anything) select 1','update anything set id=1'])await check(`unadmitted SQL rejected: ${text.split(' ')[0]} ${text.length}`,async()=>{const x=fixture();await assert.rejects(run(x,async scope=>{try{await scope.query(text);}catch{}return [];}));assert.equal(x.state.calls.some(c=>c.text===text),false);assert.equal(x.state.calls.some(c=>c.text==='commit'),false);});
await check('foreign query parameters rejected before driver',async()=>{const x=fixture();await assert.rejects(run(x,scope=>scope.query(pageSql,[id(90),ids.workspace,null,100])));assert.equal(x.state.calls.some(c=>c.text===pageSql),false);});
await check('callback failure and cleanup failure preserve first object',async()=>{const x=fixture();const error=Error('synthetic callback');x.state.cleanupError=Error('synthetic cleanup');await assert.rejects(run(x,async()=>{throw error;}),e=>e===error);assert.equal(info(error).settlement,'rolled_back');assert.equal(info(error).cleanup_errors[0],x.state.cleanupError);});
await check('successful read discarded on cleanup failure',async()=>{const x=fixture();const error=Error('synthetic cleanup');x.state.cleanupError=error;await assert.rejects(run(x),e=>e===error);assert.equal(info(error).stage,'cleanup');assert.equal(info(error).settlement,'committed');});
await check('ambiguous COMMIT stays unknown despite later ROLLBACK tag',async()=>{const x=fixture();const error=Error('synthetic lost commit ack');x.state.failSql='commit';x.state.driver=error;await assert.rejects(run(x),e=>e===error);assert.equal(info(error).settlement,'unknown');assert.equal(x.state.calls.some(c=>c.text===sql.completed),false);});
await check('COMMIT ROLLBACK tag is never success',async()=>{const x=fixture();x.state.commitTag='ROLLBACK';await assert.rejects(run(x));assert.equal(x.state.calls.some(c=>c.text===sql.completed),false);});
for(const boundary of [sql.guard,pageSql,'commit',sql.completed])await check(`original 40001 escapes at ${boundary==='commit'?'COMMIT':boundary===sql.guard?'authority':boundary===pageSql?'consumer callback':'postclock'}`,async()=>{const x=fixture();const error=Object.assign(Error('synthetic serialization'),{code:'40001'});x.state.failSql=boundary;x.state.driver=error;await assert.rejects(run(x),e=>e===error);assert.equal(x.state.connects,1);assert.equal(info(error).settlement,boundary===sql.completed?'committed':'rolled_back');noWrites(x.state);});
await check('callback wait is bounded; late scope cannot dispatch',async()=>{const x=fixture();let scope;await assert.rejects(run(x,async value=>{scope=value;x.state.fastTimeout=true;return new Promise(()=>{});}),e=>e.code==='READ_HOST_TIMEOUT');const before=x.state.calls.length;await assert.rejects(scope.query(pageSql,[ids.tenant,ids.workspace,null,100]));assert.equal(x.state.calls.length,before);});
await check('in-flight driver timeout is unknown, destroyed, no queued blind retry',async()=>{const x=fixture();x.state.hangPage=true;let error;await assert.rejects(run(x),e=>{error=e;return e.code==='READ_HOST_TIMEOUT';});assert.equal(info(error).settlement,'unknown');assert.equal(x.state.connects,1);assert.equal(x.state.calls.some(c=>c.text==='rollback'||c.text==='commit'),false);assert.equal(x.state.events.at(-1),'cleanup');});
await check('cleanup acknowledgement is bounded and required',async()=>{const x=fixture();x.state.noEnd=true;x.state.fastTimeout=true;await assert.rejects(run(x),e=>e.code==='READ_HOST_TIMEOUT');});
await check('actual consumer with no producer stays CANONICAL_PRODUCER_NOT_READY',async()=>{const x=fixture();await assert.rejects(createRead(x.host,null)(ids.actor,requested),e=>e.reason==='CANONICAL_PRODUCER_NOT_READY');assert.equal(x.state.connects,0);});
await check('selector command-lock ABI rejects read scope; no fabricated receipt',async()=>{const x=fixture();await run(x,async(scope,server)=>{const request={contract_version:'core-current-unit-property-selector-request.v1',context_id:server.context_id,workspace_id:server.workspace_id,actor_id:server.actor_id,property_id:id(11),unit_id:id(12),transaction_id:scope.transaction_id,attempt:1,permission_code:'airprop.asset.read',module_code:'airprop_commercial',evaluation_purpose:'airprop.current-unit-property.select'};assert.equal(selectorSchema.safeParse(request).success,false);const decision=await selector(scope,{},request);assert.equal(decision.decision,'denied');assert.equal(decision.denial_reason,'BINDING_MISMATCH');return [];});assert.equal(x.state.calls.some(c=>c.text===pageSql),false);});
await check('rollback failure keeps callback error and unknown settlement',async()=>{const x=fixture();const first=Error('synthetic callback');x.state.failSql='rollback';x.state.driver=Error('synthetic rollback');await assert.rejects(run(x,async()=>{throw first;}),e=>e===first);assert.equal(info(first).settlement,'unknown');assert.equal(info(first).cleanup_errors[0],x.state.driver);assert.equal(info(first).cleanup_status,'acknowledged');});
await check('authenticated user API failure never checks out a client',async()=>{const x=fixture();x.state.auth.auth.getUser=async()=>({data:{user:null},error:Error('synthetic user denial')});await assert.rejects(run(x));assert.equal(x.state.connects,0);});
await check('canonical resolver 42501 remains fail-closed',async()=>{const x=fixture();const error=Object.assign(Error('synthetic scope denial'),{code:'42501'});x.state.failSql=sql.resolve;x.state.driver=error;await assert.rejects(run(x),e=>e===error);assert.equal(info(error).settlement,'rolled_back');assert.equal(x.state.calls.some(c=>c.text===pageSql||c.text==='commit'),false);});
await check('active scope method cannot be rebound to another attempt',async()=>{const x=fixture();await assert.rejects(run(x,async scope=>{await scope.query.call({...scope,attempt:2},pageSql,[ids.tenant,ids.workspace,null,100]);return [];}));assert.equal(x.state.calls.some(c=>c.text===pageSql||c.text==='commit'),false);});
await check('callback-owned mutable values detach before COMMIT waits',async()=>{const x=fixture();let release;const raw={label:'synthetic projection'};x.state.commitBarrier=new Promise(r=>{release=r;});const pending=run(x,async()=>raw);for(let i=0;i<100&&!x.state.events.includes('commit');i++)await Promise.resolve();raw.label='changed after callback';release();const r=await pending;assert.equal(r.value.label,'synthetic projection');});
await check('late checkout after timeout is destroyed; no transaction is started',async()=>{const x=fixture();let release;x.state.fastTimeout=true;x.state.acquire=new Promise(r=>{release=r;});let first;await assert.rejects(run(x),e=>{first=e;return e.code==='READ_HOST_TIMEOUT';});assert.equal(info(first).cleanup_status,'unknown');assert.equal(info(first).settlement,'not_started');release();await new Promise(resolve=>originalTimer(resolve,0));assert.ok(x.state.events.includes('cleanup'));assert.equal(x.state.calls.length,0);});
await check('physical client error preserves first failure and prevents COMMIT',async()=>{const x=fixture();const error=Error('synthetic physical client error');x.state.clientError=error;await assert.rejects(run(x),e=>e===error);assert.equal(info(error).settlement,'rolled_back');assert.equal(x.state.calls.some(c=>c.text==='commit'),false);});
globalThis.setTimeout=originalTimer;
console.log(JSON.stringify({task:'AIRPROP-READ-HOST-MINIMUM-08',checks:count,result:'PASS',runtime_binding:binding,consumer,canonical_producer:'NOT_READY',selector:'CONTRACT_DELTA_REQUIRED',database:'NOT_RUN',business_c03_audit_outbox_writes:0,budgets}));
