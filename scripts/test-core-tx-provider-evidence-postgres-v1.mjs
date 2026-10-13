import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';
import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';

const connectionString=process.env.CORE_TX_EVIDENCE_TEST_DATABASE_URL;
if(!connectionString||process.env.CORE_TX_EVIDENCE_EPHEMERAL!=='1') throw new Error('Explicit disposable target required');
const target=new URL(connectionString);
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)
  || !['/core_tx_evidence_test','/postgres'].includes(target.pathname)) throw new Error('Local disposable PostgreSQL only');
const require=createRequire(import.meta.url),cache=new Map();
function load(url){
  if(cache.has(url.href))return cache.get(url.href);
  const compiled=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  const mod={exports:{}};
  new Function('require','module','exports',compiled.outputText)(name=>name.startsWith('.')
    ?load(new URL(name.endsWith('.ts')?name:`${name}.ts`,url)):require(name),mod,mod.exports);
  cache.set(url.href,mod.exports);return mod.exports;
}
const {resolveAuthority}=load(new URL('../src/lib/core/current-authority-postgres-provider-v1.ts',import.meta.url));
const {createCorePostgresTransactionHostV1}=load(new URL('../src/lib/core/postgres-transaction-host-v1.ts',import.meta.url));
const {bindCanonicalCurrentAuthorityObservationV1}=load(new URL('../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('../docs/contracts/CORE-AUTHORITY-REVISION-SOURCES-v1.json',import.meta.url),'utf8'));
const pool=new pg.Pool({connectionString,max:12}),host=createCorePostgresTransactionHostV1(pool);
const actor=randomUUID(),otherActor=randomUUID(),driver=createAp10CoreAuthorityDriver(pool);
let passed=0;const check=async(name,fn)=>{await fn();passed+=1;console.log(`ok ${passed} - ${name}`);};
const revision=async()=>Number((await pool.query('select revision::text from app_private.canonical_authority_revision_v1')).rows[0].revision);
let mutations=0,providerCalls=0,authorityCalls=0;
try{
  await pool.query('insert into auth.users(id,email) values($1,$2)',[actor,`tx-evidence-${randomUUID()}@example.invalid`]);
  const ids=await driver.setup({userId:actor,runId:randomUUID(),target:'local'});
  let aggregateVersion=0;
  const command=async(extra={})=>({contract_version:'core-transaction-command.v2',transaction_id:randomUUID(),command_id:randomUUID(),
    context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,authority_version:await revision(),
    permission_code:'airprop.asset.manage',module_code:'airprop_commercial',evaluation_purpose:'tx_provider_evidence_test',
    aggregate_type:'property',aggregate_id:ids.propertyIds[0],aggregate_version:++aggregateVersion,
    provider_source_ids:[ids.workspaceIds[0],ids.workspaceIds[1]],idempotency_key:randomUUID(),input_fingerprint:'tx2:0123456789abcdef',
    subject_reference:{kind:'workspace',id:ids.workspaceIds[0],version:1,relation:'evidence',request_version:1},...extra});
  const callbacks=(options={})=>({provider_code:options.providerCode||'core.subject',
    async resolveAuthority(scope,request){
      authorityCalls+=1;
      await scope.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'})]);
      return resolveAuthority(scope,request);
    },
    async validateProviders(scope,cmd,authority){
      providerCalls+=1;
      assert.equal(authority.decision,'allowed');assert.equal(authority.actor_id,cmd.actor_id);
      assert.equal(authority.authority_version,cmd.authority_version);assert.equal(authority.workspace_id,cmd.workspace_id);
      assert.equal(authority.transaction_context.transaction_id,scope.transaction_id);
      assert.equal(authority.transaction_context.command_id,cmd.command_id);
      assert.equal(authority.transaction_context.attempt,scope.attempt);
      const current=await scope.query(`select txid_current()::text txid,clock_timestamp()::text now,
        w.id::text id,w.version from platform.customer_workspaces w where w.id=$1 and w.tenant_id=$2`,
        [cmd.subject_reference.id,scope.tenant_id]);
      assert.equal(current.rows[0].txid,scope.database_transaction_id);
      assert.ok(Date.parse(current.rows[0].now)>=Date.parse(authority.evaluated_at));
      if(options.authorityTamper)authority.authority_version+=1;
      if(options.boolean)return true;
      if(options.throw)throw new Error('synthetic provider failure');
      const result={contract_version:'core-transaction-provider-evidence.v1',evidence_id:randomUUID(),provider_code:'core.subject',
        transaction_id:cmd.transaction_id,command_id:cmd.command_id,workspace_id:scope.workspace_id,actor_id:scope.actor_id,
        context_id:cmd.context_id,authority_decision_id:authority.decision_id,authority_version:authority.authority_version,
        attempt:scope.attempt,subject_reference:{...cmd.subject_reference,id:current.rows[0].id,
          version:current.rows[0].version,request_version:current.rows[0].version},
        evaluated_at:new Date(current.rows[0].now).toISOString(),source_disclosure:'status_only',source_reference:null,
        decision:'accepted',denial_reason:null,reference_state:'available',current_actor_can_read:true};
      if(options.denied){delete result.reference_state;delete result.current_actor_can_read;result.decision='denied';result.denial_reason='SUBJECT_DENIED';}
      return options.evidence?options.evidence(result):result;
    },
    async mutate(scope,cmd){mutations+=1;await scope.query('update portfolio.properties set name=$2 where id=$1',
      [cmd.aggregate_id,`Evidence ${cmd.command_id}`]);if(options.rollback)throw new Error('synthetic rollback');return {mutation_id:cmd.aggregate_id};}
  });
  const effects=async()=> (await pool.query(`select
    (select coalesce(jsonb_agg(to_jsonb(i) order by key),'[]') from platform.idempotency_keys i where tenant_id=$1) idem,
    (select count(*)::int from audit.events where tenant_id=$1) audit,
    (select count(*)::int from platform.outbox_events where tenant_id=$1) outbox,
    (select to_jsonb(p) from portfolio.properties p where id=$2) property,
    (select revision::text from app_private.canonical_authority_revision_v1) revision`,[ids.tenantId,ids.propertyIds[0]])).rows[0];
  const zero=async(cmd,options={},code)=>{
    const before=await effects(),beforeMutations=mutations;const result=await host.execute(cmd,callbacks(options));
    assert.equal(result.status,'denied');if(code)assert.equal(result.code,code);
    assert.deepEqual(await effects(),before);assert.equal(mutations,beforeMutations);assert.equal('receipt' in result,false);return result;
  };
  const first=await command();let committed;
  await check('typed provider receives exact current authority after locks in same transaction',async()=>{
    committed=await host.execute(first,callbacks());assert.equal(committed.status,'committed');
    assert.equal(committed.receipt.contract_version,'core-transaction-receipt.v2');
    assert.deepEqual(committed.receipt.subject_reference,first.subject_reference);
    assert.equal(committed.receipt.provider_evidence.authority_decision_id,committed.receipt.authority.decision_id);
  });
  await check('valid immutable replay skips provider and mutation but rechecks authority',async()=>{
    const before=await effects(),pc=providerCalls,mc=mutations,ac=authorityCalls;
    const result=await host.execute(first,callbacks());assert.equal(result.status,'exact_replay');assert.deepEqual(result.receipt,committed.receipt);
    assert.deepEqual(await effects(),before);assert.equal(providerCalls,pc);assert.equal(mutations,mc);assert.ok(authorityCalls>ac);
  });
  for(const [field,value] of [['kind','document'],['id',ids.workspaceIds[1]],['version',2],['relation','context'],['request_version',2]]){
    await check(`changed subject ${field} conflicts without writes`,()=>zero({...first,subject_reference:{...first.subject_reference,[field]:value}}, {},'REPLAY_CONFLICT'));
  }
  await check('changed provider identity conflicts on cached replay',()=>zero(first,{providerCode:'other.provider'},'REPLAY_CONFLICT'));
  const tampering=[
    ['subject kind',r=>{r.provider_evidence.subject_reference.kind='document';}],
    ['subject id',r=>{r.provider_evidence.subject_reference.id=ids.workspaceIds[1];}],
    ['subject version',r=>{r.provider_evidence.subject_reference.version+=1;}],
    ['subject relation',r=>{r.provider_evidence.subject_reference.relation='context';}],
    ['request version',r=>{r.provider_evidence.subject_reference.request_version+=1;}],
    ['authority decision',r=>{r.provider_evidence.authority_decision_id=randomUUID();}],
    ['authority version',r=>{r.provider_evidence.authority_version+=1;}],
    ['transaction',r=>{r.provider_evidence.transaction_id=randomUUID();}],
    ['provider identity',r=>{r.provider_evidence.provider_code='other.provider';}],
    ['missing evidence',r=>{delete r.provider_evidence;}],
  ];
  for(const [name,change] of tampering){await check(`tampered stored ${name} is zero-write replay conflict`,async()=>{
    const altered=structuredClone(committed.receipt);change(altered);
    await pool.query('update platform.idempotency_keys set response_ref=$2::jsonb where key=$1',
      [`core-tx.v1:${first.workspace_id}:${first.idempotency_key}`,JSON.stringify(altered)]);
    await zero(first,{},'REPLAY_CONFLICT');
    await pool.query('update platform.idempotency_keys set response_ref=$2::jsonb where key=$1',
      [`core-tx.v1:${first.workspace_id}:${first.idempotency_key}`,JSON.stringify(committed.receipt)]);
  });}
  await check('boolean cannot authorize v2 provider',async()=>zero(await command(),{boolean:true},'PROVIDER_UNAVAILABLE'));
  await check('provider cannot mutate the authoritative decision through its copy',async()=>zero(await command(),{authorityTamper:true},'PROVIDER_UNAVAILABLE'));
  await check('typed provider denial is zero-write',async()=>zero(await command(),{denied:true},'PROVIDER_UNAVAILABLE'));
  await check('provider exception is zero-write',async()=>zero(await command(),{throw:true}));
  for(const [name,change] of [
    ['actor',e=>({...e,actor_id:randomUUID()})],['Workspace',e=>({...e,workspace_id:ids.workspaceIds[1]})],
    ['authority decision',e=>({...e,authority_decision_id:randomUUID()})],['authority version',e=>({...e,authority_version:e.authority_version+1})],
    ['transaction',e=>({...e,transaction_id:randomUUID()})],['attempt',e=>({...e,attempt:e.attempt+1})],
    ['subject version',e=>({...e,subject_reference:{...e.subject_reference,version:2}})],
    ['before authority time',e=>({...e,evaluated_at:'2000-01-01T00:00:00Z'})],
    ['future time',e=>({...e,evaluated_at:'2099-01-01T00:00:00Z'})],
    ['private payload',e=>({...e,source_reference:'forbidden'})],
  ])await check(`provider evidence ${name} mismatch zero-write`,async()=>zero(await command(),{evidence:change},'PROVIDER_UNAVAILABLE'));
  await check('stale authority never reaches typed provider',async()=>{
    const pc=providerCalls;const result=await zero(await command({authority_version:await revision()+1}));
    assert.equal(result.authority.denial_reason,'STALE_AUTHORITY_VERSION');assert.equal(providerCalls,pc);
  });
  await check('subject outside lock set fails before effects',async()=>zero(await command({provider_source_ids:[]}),{},'INVALID_COMMAND'));
  await check('missing subject fails closed',async()=>{const c=await command();delete c.subject_reference;await zero(c,{},'INVALID_COMMAND');});
  await check('typed domain failure rolls back all canonical ledgers',async()=>{
    const before=await effects();const result=await host.execute(await command(),callbacks({rollback:true}));assert.equal(result.status,'denied');assert.deepEqual(await effects(),before);
  });
  await check('concurrent duplicate commits one mutation and one replay',async()=>{
    const c=await command(),before=mutations;const results=await Promise.all([host.execute(c,callbacks()),host.execute(c,callbacks())]);
    assert.deepEqual(results.map(r=>r.status).sort(),['committed','exact_replay']);assert.equal(mutations,before+1);
    assert.deepEqual(results[0].receipt,results[1].receipt);
  });
  await check('revoked authority denies before provider, including replay',async()=>{
    await pool.query("update identity.memberships set status='revoked',ends_at=clock_timestamp() where id=$1",[ids.membershipId]);
    const pc=providerCalls;await zero(await command());await zero(first);assert.equal(providerCalls,pc);
  });
}finally{await pool.end();}
console.log(`Typed TX provider evidence PostgreSQL: ${passed}/${passed} PASS`);
