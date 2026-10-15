import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';
import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';

const connectionString=process.env.CORE_UNIT_PROPERTY_SELECTOR_TEST_DATABASE_URL;
if(!connectionString||process.env.CORE_UNIT_PROPERTY_SELECTOR_EPHEMERAL!=='1'){
  throw new Error('Explicit disposable target required');
}
const target=new URL(connectionString);
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.pathname!=='/postgres'){
  throw new Error('Local disposable PostgreSQL only');
}

const require=createRequire(import.meta.url),cache=new Map();
function load(url){
  if(cache.has(url.href))return cache.get(url.href);
  const compiled=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  }});
  const mod={exports:{}};cache.set(url.href,mod.exports);
  new Function('require','module','exports',compiled.outputText)(name=>name.startsWith('.')
    ?load(new URL(name.endsWith('.ts')?name:`${name}.ts`,url)):require(name),mod,mod.exports);
  return mod.exports;
}

const selector=load(new URL('../src/lib/core/current-unit-property-selector-v1.ts',import.meta.url));
const authorityPort=load(new URL('../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
const authorityProvider=load(new URL('../src/lib/core/current-authority-postgres-provider-v1.ts',import.meta.url));
const pool=new pg.Pool({connectionString,max:12});
const actor=randomUUID();const driver=createAp10CoreAuthorityDriver(pool);let ids;let checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const revision=async client=>Number((await client.query(
  'select revision::text from app_private.canonical_authority_revision_v1 where singleton')).rows[0].revision);
const effectDigest=async()=>{
  const result=await pool.query(`select
    (select count(*)::text from platform.idempotency_keys) as idempotency,
    (select count(*)::text from audit.events) as audit,
    (select count(*)::text from platform.outbox_events) as outbox,
    (select count(*)::text from airprop.management_action_links) as action_links`);
  return createHash('sha256').update(JSON.stringify(result.rows[0])).digest('hex');
};

async function beginScope({workspaceId=ids.workspaceIds[0],contextId=ids.contextId,
  propertyId=ids.propertyIds[0],unitId=ids.unitIds[0],attempt=1,resolve=true}={}){
  const client=await pool.connect();
  try{
    await client.query('begin isolation level serializable');
    await client.query(`select set_config('request.jwt.claims',$1,true),
      set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal','aal2',true)`,
    [JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'}),actor]);
    const transaction=(await client.query(`select txid_current()::text as id,
      clock_timestamp()::text as acquired_at`)).rows[0];
    const transactionId=randomUUID(),commandId=randomUUID();
    const scope=Object.freeze({transaction_id:transactionId,database_transaction_id:transaction.id,
      workspace_id:workspaceId,tenant_id:ids.tenantId,actor_id:actor,attempt,
      async query(text,values=[]){return client.query(text,values);}});
    const authorityVersion=await revision(client);
    const authorityRequest={contract_version:'core-current-authority-transaction-port-request.v1',
      decision_id:randomUUID(),context_id:contextId,workspace_id:workspaceId,actor_id:actor,
      authority_version:authorityVersion,permission_code:'airprop.asset.read',
      module_code:'airprop_commercial',evaluation_purpose:'airprop.current-unit-property.select',
      transaction_context:{transaction_id:transactionId,command_id:commandId,attempt,
        isolation_level:'serializable',lock:{kind:'command_aggregate',workspace_id:workspaceId,
          aggregate_type:'portfolio.unit',aggregate_id:unitId,
          acquired_at:new Date(transaction.acquired_at).toISOString()}}};
    let authority;
    if(resolve){
      const observation=await authorityProvider.resolveAuthority(scope,authorityRequest);
      authority=authorityPort.bindCanonicalCurrentAuthorityObservationV1(authorityRequest,observation);
    }
    const request={contract_version:selector.CORE_CURRENT_UNIT_PROPERTY_SELECTOR_REQUEST_V1,
      context_id:contextId,workspace_id:workspaceId,actor_id:actor,
      authority_version:authorityVersion,property_id:propertyId,unit_id:unitId};
    return{client,scope,authority,authorityRequest,request};
  }catch(error){
    await client.query('rollback').catch(()=>{});client.release();throw error;
  }
}

async function finish(tx,operation='rollback'){
  await tx.client.query(operation);tx.client.release();
}

async function selectOnce(options={}){
  const tx=await beginScope(options);
  try{
    const decision=await selector.selectCurrentUnitPropertyV1(tx.scope,tx.authority,tx.request);
    await finish(tx,'commit');return decision;
  }catch(error){await finish(tx);throw error;}
}

async function waitForBlockedUpdate(fragment){
  for(let index=0;index<300;index+=1){
    const result=await pool.query(`select count(*)::int as n from pg_stat_activity
      where datname=current_database() and wait_event_type='Lock' and position($1 in query)>0`,[fragment]);
    if(result.rows[0].n>0)return;await sleep(10);
  }
  throw new Error('expected concurrent unit move to block');
}

try{
  await pool.query(`insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
    values($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,now(),now())`,
  [actor,`core-unit-property-${randomUUID()}@example.invalid`]);
  ids=await driver.setup({userId:actor,runId:randomUUID(),target:'local'});

  await check('current active unit is accepted only for its canonical property and Workspace',async()=>{
    const before=await effectDigest();const result=await selectOnce();
    assert.equal(result.decision,'accepted',JSON.stringify(result));
    assert.equal(result.binding.property_id,ids.propertyIds[0]);
    assert.equal(result.binding.unit_id,ids.unitIds[0]);
    assert.equal(result.binding.current_unit_to_property,true);
    assert.equal(result.source_disclosure,'status_only');assert.equal(result.source_reference,null);
    assert.equal(result.reusable_as_command_authority,false);
    for(const field of ['tenant_id','building_id','membership_id','role','permission','authority']){
      assert.ok(!(field in result));
    }
    assert.equal(await effectDigest(),before,'accepted selector must create no durable writes');
  });

  await check('unit moved before selection denies old property with zero writes',async()=>{
    await pool.query('update portfolio.units set building_id=$2 where id=$1',
      [ids.unitIds[0],ids.buildingIds[1]]);
    try{
      const before=await effectDigest();const result=await selectOnce();
      assert.equal(result.decision,'denied');
      assert.equal(result.denial_reason,'CURRENT_UNIT_PROPERTY_DENIED');
      assert.equal(result.binding,null);assert.equal(await effectDigest(),before);
    }finally{
      await pool.query('update portfolio.units set building_id=$2 where id=$1',
        [ids.unitIds[0],ids.buildingIds[0]]);
    }
  });

  await check('shared ancestry locks serialize a concurrent unit move until selection ends',async()=>{
    const tx=await beginScope();let pending;let closed=false;
    try{
      const decision=await selector.selectCurrentUnitPropertyV1(tx.scope,tx.authority,tx.request);
      assert.equal(decision.decision,'accepted');
      pending=pool.query(`update portfolio.units set building_id=$2
        where id=$1 /* core-current-unit-property-concurrent-move */`,
      [ids.unitIds[0],ids.buildingIds[1]]);
      await waitForBlockedUpdate('core-current-unit-property-concurrent-move');
      await finish(tx,'commit');closed=true;await pending;
    }catch(error){
      if(!closed)await finish(tx).catch(()=>{});throw error;
    }finally{
      if(pending)await pending.catch(()=>{});
      await pool.query('update portfolio.units set building_id=$2 where id=$1',
        [ids.unitIds[0],ids.buildingIds[0]]);
    }
  });

  await check('revoked Workspace binding and authority are bounded zero-write denials',async()=>{
    const binding=(await pool.query(`select id from platform.workspace_property_bindings
      where customer_workspace_id=$1 and property_id=$2 and status='active'`,
    [ids.workspaceIds[0],ids.propertyIds[0]])).rows[0];
    await pool.query(`update platform.workspace_property_bindings
      set status='archived',valid_to=statement_timestamp() where id=$1`,[binding.id]);
    try{
      const before=await effectDigest();const result=await selectOnce();
      assert.equal(result.decision,'denied');
      assert.equal(result.denial_reason,'CURRENT_UNIT_PROPERTY_DENIED');
      assert.equal(await effectDigest(),before);
    }finally{
      await pool.query(`update platform.workspace_property_bindings
        set status='active',valid_to=null where id=$1`,[binding.id]);
    }

    await pool.query(`update platform.workspace_entitlements set boolean_value=false
      where customer_workspace_id=$1 and entitlement_key='module.airprop_commercial'`,
    [ids.workspaceIds[0]]);
    try{
      const before=await effectDigest();const result=await selectOnce();
      assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'AUTHORITY_DENIED');
      assert.equal(await effectDigest(),before);
    }finally{
      await pool.query(`update platform.workspace_entitlements set boolean_value=true
        where customer_workspace_id=$1 and entitlement_key='module.airprop_commercial'`,
      [ids.workspaceIds[0]]);
    }
  });

  await check('cross-Workspace, wrong property and missing unit fail closed',async()=>{
    const cases=[
      {workspaceId:ids.workspaceIds[0],propertyId:ids.propertyIds[0],unitId:ids.unitIds[2]},
      {workspaceId:ids.workspaceIds[0],propertyId:ids.propertyIds[1],unitId:ids.unitIds[0]},
      {workspaceId:ids.workspaceIds[0],propertyId:ids.propertyIds[0],unitId:randomUUID()},
    ];
    for(const scenario of cases){
      const before=await effectDigest();const result=await selectOnce(scenario);
      assert.equal(result.decision,'denied');
      assert.equal(result.denial_reason,'CURRENT_UNIT_PROPERTY_DENIED');
      assert.equal(result.binding,null);assert.equal(await effectDigest(),before);
    }
    const tx=await beginScope();
    try{
      const result=await selector.selectCurrentUnitPropertyV1(tx.scope,tx.authority,
        {...tx.request,workspace_id:ids.workspaceIds[1]});
      assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'BINDING_MISMATCH');
    }finally{await finish(tx);}
  });

  await check('inactive and deleted units deny without a durable selector effect',async()=>{
    await pool.query("update portfolio.units set status='inactive' where id=$1",[ids.unitIds[0]]);
    try{
      const before=await effectDigest();const result=await selectOnce();
      assert.equal(result.decision,'denied');
      assert.equal(result.denial_reason,'CURRENT_UNIT_PROPERTY_DENIED');
      assert.equal(await effectDigest(),before);
    }finally{await pool.query("update portfolio.units set status='active' where id=$1",[ids.unitIds[0]]);}
    const deletedUnit=randomUUID();
    await pool.query(`insert into portfolio.units(id,tenant_id,building_id,code,status)
      values($1,$2,$3,$4,'active')`,[deletedUnit,ids.tenantId,ids.buildingIds[0],`DEL-${deletedUnit.slice(0,8)}`]);
    await pool.query('delete from portfolio.units where id=$1',[deletedUnit]);
    const before=await effectDigest();const result=await selectOnce({unitId:deletedUnit});
    assert.equal(result.decision,'denied');
    assert.equal(result.denial_reason,'CURRENT_UNIT_PROPERTY_DENIED');
    assert.equal(await effectDigest(),before);
  });

  await check('historical receipt cannot authorize a later transaction',async()=>{
    const old=await beginScope();await finish(old,'commit');
    const current=await beginScope({resolve:false});
    try{
      const before=await effectDigest();
      const result=await selector.selectCurrentUnitPropertyV1(current.scope,old.authority,current.request);
      assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'BINDING_MISMATCH');
      assert.equal(await effectDigest(),before);
    }finally{await finish(current);}
  });

  await check('real serialization failure is retried in a fresh scope and observes the move',async()=>{
    const first=await pool.connect();let firstCode=null;
    try{
      await first.query('begin isolation level serializable');
      await first.query(`select set_config('request.jwt.claims',$1,true),
        set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal','aal2',true)`,
      [JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'}),actor]);
      await first.query('select count(*) from portfolio.units');
      await pool.query('update portfolio.units set building_id=$2 where id=$1',
        [ids.unitIds[0],ids.buildingIds[1]]);
      const transaction=(await first.query('select txid_current()::text id,clock_timestamp()::text acquired_at')).rows[0];
      const transactionId=randomUUID(),commandId=randomUUID(),authorityVersion=await revision(first);
      const scope={transaction_id:transactionId,database_transaction_id:transaction.id,
        workspace_id:ids.workspaceIds[0],tenant_id:ids.tenantId,actor_id:actor,attempt:1,
        async query(text,values=[]){return first.query(text,values);}};
      const request={contract_version:'core-current-authority-transaction-port-request.v1',
        decision_id:randomUUID(),context_id:ids.contextId,workspace_id:ids.workspaceIds[0],
        actor_id:actor,authority_version:authorityVersion,permission_code:'airprop.asset.read',
        module_code:'airprop_commercial',evaluation_purpose:'airprop.current-unit-property.select',
        transaction_context:{transaction_id:transactionId,command_id:commandId,attempt:1,
          isolation_level:'serializable',lock:{kind:'command_aggregate',workspace_id:ids.workspaceIds[0],
            aggregate_type:'portfolio.unit',aggregate_id:ids.unitIds[0],
            acquired_at:new Date(transaction.acquired_at).toISOString()}}};
      await authorityProvider.resolveAuthority(scope,request);
      assert.fail('expected PostgreSQL serialization failure');
    }catch(error){firstCode=error?.code;assert.equal(firstCode,'40001');}
    finally{await first.query('rollback').catch(()=>{});first.release();}
    try{
      const result=await selectOnce({attempt:2});
      assert.equal(result.decision,'denied');
      assert.equal(result.denial_reason,'CURRENT_UNIT_PROPERTY_DENIED');
    }finally{
      await pool.query('update portfolio.units set building_id=$2 where id=$1',
        [ids.unitIds[0],ids.buildingIds[0]]);
    }
  });
}finally{
  if(ids){
    await driver.revoke({authority:ids});
    assert.equal(await driver.verifyRevoked({authority:ids}),true,'fixture authority cleanup');
  }
  await pool.end();
}

console.log(`Core current unit/property selector PostgreSQL: ${checks}/${checks} PASS; no migration, Remote apply or activation`);
